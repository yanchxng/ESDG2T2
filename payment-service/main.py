from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from decimal import Decimal, InvalidOperation
import uuid
import os
import base64
import json
import aio_pika
from dotenv import load_dotenv
import httpx

from database import get_db_connection, init_db

load_dotenv()

app = FastAPI(title="Payment Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()


PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
PAYPAL_CURRENCY = os.getenv("PAYPAL_CURRENCY", "SGD")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
PATIENT_SERVICE_URL = os.getenv("PATIENT_SERVICE_URL")
AMQP_URL = os.getenv("AMQP_URL", "amqp://rabbitmq:5672")


class CreatePaymentRequest(BaseModel):
    PatientID: str
    ConsultID: str
    amount: float


class RefundPaymentRequest(BaseModel):
    PaymentID: str
    amount: float
    action: str = Field(default="refund")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "payment-service"}


def parse_amount(amount: float) -> Decimal:
    try:
        dec = Decimal(str(amount))
    except (InvalidOperation, ValueError) as e:
        raise HTTPException(status_code=400, detail="Invalid amount")
    if dec <= 0:
        raise HTTPException(status_code=400, detail="amount must be > 0")
    return dec


async def paypal_get_access_token() -> str:
    if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET must be set",
        )

    creds = f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode("utf-8")
    basic_token = base64.b64encode(creds).decode("utf-8")

    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            headers={
                "Authorization": f"Basic {basic_token}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        res.raise_for_status()
        data = res.json()
        token = data.get("access_token")
        if not token:
            raise HTTPException(status_code=502, detail="PayPal token missing in response")
        return token


def _extract_capture_id(paypal_capture_response: dict) -> str | None:
    try:
        captures = (
            paypal_capture_response.get("purchase_units", [{}])[0]
            .get("payments", {})
            .get("captures", [])
        )
        if captures and isinstance(captures, list):
            return captures[0].get("id")
    except Exception:
        return None
    return None


@app.post("/api/payments", status_code=201)
async def create_payment(request: CreatePaymentRequest):
    amount_dec = parse_amount(request.amount)
    access_token = await paypal_get_access_token()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {
                    "currency_code": PAYPAL_CURRENCY,
                    "value": str(amount_dec),
                },
                "description": f"Consultation {request.ConsultID}"
            }
        ],
        "application_context": {
            "return_url": f"{FRONTEND_URL}/payment-success",
            "cancel_url": f"{FRONTEND_URL}/payment-cancelled",
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        order_res = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            json=order_payload,
            headers=headers,
        )
        order_res.raise_for_status()
        order_data = order_res.json()
        
        order_id = order_data.get("id")

        approve_url = next(link['href'] for link in order_data['links'] if link['rel'] == 'approve')

        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                INSERT INTO payments (
                    payment_id, consult_id, patient_id, amount, status,
                    paypal_transaction_id, paypal_approve_url
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                order_id,
                request.ConsultID,
                request.PatientID,
                str(amount_dec),
                "PENDING",
                order_id,
                approve_url,
            )
        finally:
            await conn.close()

    return {
        "PaymentID": order_id, 
        "status": "CREATED", 
        "checkout_url": approve_url
    }


@app.get("/api/payments/pending/patient/{patient_id}")
async def list_pending_payments_for_patient(patient_id: str):
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            """
            SELECT consult_id, amount::text AS amount, paypal_approve_url
            FROM payments
            WHERE patient_id = $1
              AND status = 'PENDING'
              AND paypal_approve_url IS NOT NULL
              AND paypal_approve_url <> ''
            ORDER BY created_at DESC
            """,
            patient_id,
        )
    finally:
        await conn.close()

    return {
        "Data": [
            {
                "consult_id": r["consult_id"],
                "amount": r["amount"],
                "checkout_url": r["paypal_approve_url"],
            }
            for r in rows
        ]
    }

@app.post("/api/payments/{payment_id}/capture")
async def capture_payment(payment_id: str):
    conn = await get_db_connection()
    try:
        payment_row = await conn.fetchrow(
            "SELECT status, patient_id, amount, consult_id FROM payments WHERE payment_id = $1",
            payment_id
        )
        if not payment_row:
            raise HTTPException(status_code=404, detail="Payment not found")
        if payment_row["status"] == "PAID":
            return {"status": "PAID", "payment_id": payment_id}

        access_token = await paypal_get_access_token()
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            capture_res = await client.post(
                f"{PAYPAL_BASE_URL}/v2/checkout/orders/{payment_id}/capture",
                headers=headers
            )

            if capture_res.status_code not in (200, 201, 202):
                print(f"PayPal Capture Error: {capture_res.text}")
                if capture_res.status_code == 422 and "ORDER_ALREADY_CAPTURED" in capture_res.text:
                    pass
                else:
                    raise HTTPException(status_code=400, detail="Failed to capture payment with PayPal")

            capture_data = capture_res.json()
            capture_id = _extract_capture_id(capture_data)

        updated_row = await conn.fetchrow(
            """
            UPDATE payments
            SET status = 'PAID',
                paypal_transaction_id = $1,
                updated_at = NOW()
            WHERE payment_id = $2 AND status != 'PAID'
            RETURNING payment_id
            """,
            capture_id or payment_id,
            payment_id
        )

        if updated_row:
            amount_paid = float(payment_row["amount"])

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    patient_res = await client.get(f"{PATIENT_SERVICE_URL}/patient/{payment_row['patient_id']}/")
                    if patient_res.status_code == 200:
                        patient_data = patient_res.json().get("Data", {})
                        patient_email = patient_data.get("Email")
                        patient_name = patient_data.get("Name", "Valued Patient")
                        if patient_email:
                            connection = await aio_pika.connect_robust(AMQP_URL)
                            async with connection:
                                channel = await connection.channel()
                                payload = {
                                    "to": patient_email,
                                    "from": "medilink.notifications@gmail.com",
                                    "subject": "Payment Receipt - MediLink",
                                    "details": f"Hi {patient_name}, your payment of ${amount_paid:.2f} {PAYPAL_CURRENCY} for consultation ({payment_row['consult_id']}) has been successfully processed. Thank you!"
                                }
                                await channel.default_exchange.publish(
                                    aio_pika.Message(body=json.dumps(payload).encode()),
                                    routing_key="email_notifications",
                                )
            except Exception as e:
                print(f"Failed to send email notification to patient: {e}")

        return {"status": "PAID", "payment_id": payment_id, "capture_id": capture_id}
    finally:
        await conn.close()

@app.post("/api/payments/refund")
async def refund_payment(request: RefundPaymentRequest):
    if request.action != "refund":
        raise HTTPException(status_code=400, detail="Invalid action. Expected 'refund'.")

    amount_dec = parse_amount(request.amount)

    conn = await get_db_connection()
    try:
        payment_row = await conn.fetchrow(
            "SELECT payment_id, status FROM payments WHERE payment_id = $1",
            request.PaymentID,
        )
        if not payment_row:
            raise HTTPException(status_code=404, detail="Payment not found")
        if payment_row.get("status") == "REFUNDED":
            return {"PaymentID": request.PaymentID, "status": "REFUNDED", "amount": float(amount_dec)}
    finally:
        await conn.close()

    access_token = await paypal_get_access_token()
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    refund_payload = {
        "amount": {
            "currency_code": PAYPAL_CURRENCY,
            "value": str(amount_dec),
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        refund_res = await client.post(
            f"{PAYPAL_BASE_URL}/v2/payments/captures/{request.PaymentID}/refund",
            json=refund_payload,
            headers=headers,
        )
        refund_res.raise_for_status()
        refund_data = refund_res.json()

    refund_id = refund_data.get("id") or str(uuid.uuid4())
    refund_status = "REFUNDED"

    conn = await get_db_connection()
    try:
        await conn.execute(
            """
            UPDATE payments
            SET status = $1,
                refund_id = $2,
                updated_at = NOW()
            WHERE payment_id = $3
            """,
            refund_status,
            refund_id,
            request.PaymentID,
        )
    finally:
        await conn.close()

    return {"PaymentID": request.PaymentID, "status": refund_status, "refundID": refund_id}

