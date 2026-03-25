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
PAYPAL_CURRENCY = os.getenv("PAYPAL_CURRENCY", "USD")


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
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    # Create and immediately capture (CAPTURE intent).
    order_payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {
                    "currency_code": PAYPAL_CURRENCY,
                    "value": str(amount_dec),
                }
            }
        ],
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
        if not order_id:
            raise HTTPException(status_code=502, detail="PayPal order id missing in response")

        capture_res = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            json={},
            headers=headers,
        )
        capture_res.raise_for_status()
        capture_data = capture_res.json()

    paypal_status = (capture_data.get("status") or "").upper()
    capture_id = _extract_capture_id(capture_data) or order_id

    # Persist payment state for downstream refund logic.
    db_status = "PAID" if paypal_status == "COMPLETED" else "PENDING"

    conn = await get_db_connection()
    try:
        await conn.execute(
            """
            INSERT INTO payments (payment_id, consult_id, patient_id, amount, status, paypal_transaction_id, refund_id)
            VALUES ($1, $2, $3, $4, $5, $6, NULL)
            """,
            capture_id,
            request.ConsultID,
            request.PatientID,
            str(amount_dec),
            db_status,
            capture_id,
        )
    except Exception as e:
        # Avoid leaking PayPal response content; provide generic error.
        raise HTTPException(status_code=500, detail=f"Failed to persist payment record: {str(e)}")
    finally:
        await conn.close()

    # Contract needed by `consult-doctor-service`: it expects { PaymentID, status }.
    return {"PaymentID": capture_id, "status": db_status, "amount": float(amount_dec)}


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

