from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from decimal import Decimal, InvalidOperation
import uuid
import os
import base64
from dotenv import load_dotenv
import httpx

from database import get_db_connection, init_db

load_dotenv()

app = FastAPI(title="Payment Service")


@app.on_event("startup")
async def startup():
    await init_db()


PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")
PAYPAL_CURRENCY = os.getenv("PAYPAL_CURRENCY", "SGD")


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

    # Step 1: Create the Order ONLY (Don't capture yet!)
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
            "return_url": "http://localhost:5173/payment-success", # Your frontend success page
            "cancel_url": "http://localhost:5173/payment-cancelled"
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
        
        # Find the 'approve' link to send to the Frontend
        approve_url = next(link['href'] for link in order_data['links'] if link['rel'] == 'approve')

        # We save it as 'PENDING' in our DB because the user hasn't typed their password yet
        conn = await get_db_connection()
        try:
            await conn.execute(
                """
                INSERT INTO payments (payment_id, consult_id, patient_id, amount, status, paypal_transaction_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                order_id, request.ConsultID, request.PatientID, str(amount_dec), "PENDING", order_id
            )
        finally:
            await conn.close()

    # Return the URL so the Frontend can redirect the user
    return {
        "PaymentID": order_id, 
        "status": "CREATED", 
        "checkout_url": approve_url
    }



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

    # Cancellation orchestrator just needs HTTP 200; return helpful fields anyway.
    return {"PaymentID": request.PaymentID, "status": refund_status, "refundID": refund_id}

