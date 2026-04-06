from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import aio_pika
import html
import json
import os
from dotenv import load_dotenv

load_dotenv()

PATIENT_SERVICE_URL = os.getenv("PATIENT_SERVICE_URL")
CONSULT_SERVICE_URL = os.getenv("CONSULT_SERVICE_URL")
DIAGNOSIS_SERVICE_URL = os.getenv("DIAGNOSIS_SERVICE_URL")
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL")
AMQP_URL = os.getenv("AMQP_URL")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConsultCompleteRequest(BaseModel):
    PatientID: str
    ConsultID: str
    diagnosis: str
    prescription: str
    amount: float

@app.post("/api/consultation/complete")
async def complete_consultation(request: ConsultCompleteRequest):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            patient_res = await client.get(f"{PATIENT_SERVICE_URL}/patient/{request.PatientID}/")
            patient_res.raise_for_status()
            patient_data = patient_res.json().get("Data", {})

            consult_res = await client.get(f"{CONSULT_SERVICE_URL}/api/consults/{request.ConsultID}")
            consult_res.raise_for_status()

            diag_payload = {
                "PatientID": request.PatientID,
                "ConsultID": request.ConsultID,
                "diagnosis": request.diagnosis,
                "prescription": request.prescription
            }
            diag_res = await client.post(f"{DIAGNOSIS_SERVICE_URL}/api/diagnoses", json=diag_payload)
            diag_res.raise_for_status()
            diag_data = diag_res.json()

            payment_payload = {
                "PatientID": request.PatientID,
                "ConsultID": request.ConsultID,
                "amount": request.amount
            }
            payment_res = await client.post(f"{PAYMENT_SERVICE_URL}/api/payments", json=payment_payload)
            payment_res.raise_for_status()
            payment_data = payment_res.json()

            update_res = await client.post(f"{CONSULT_SERVICE_URL}/api/consults/complete?consult_id={request.ConsultID}")
            update_res.raise_for_status()

            connection = await aio_pika.connect_robust(AMQP_URL)
            async with connection:
                channel = await connection.channel()
                queue = await channel.declare_queue("email_notifications", durable=True)
                
                checkout_url = payment_data.get("checkout_url") or ""
                pay_line = (
                    f'<p><a href="{html.escape(checkout_url)}">Pay ${request.amount:.2f} with PayPal</a>.</p>'
                    if checkout_url
                    else "<p>Please open MediLink, go to <b>My Consultations</b>, and use <b>Pay with PayPal</b> for this visit.</p>"
                )
                notification_payload = {
                    "to": patient_data.get("Email") or patient_data.get("email") or "test@example.com",
                    "from": "medilink.notifications@gmail.com",
                    "subject": "Consultation complete — please complete payment",
                    "details": (
                        f"<p>Your consultation is complete.</p>"
                        f"<p><b>Diagnosis:</b> {html.escape(request.diagnosis)}<br>"
                        f"<b>Prescription:</b> {html.escape(request.prescription)}</p>"
                        f"{pay_line}"
                        f"<p><small>Consultation ID: {html.escape(request.ConsultID)}</small></p>"
                    ),
                }
                
                await channel.default_exchange.publish(
                    aio_pika.Message(body=json.dumps(notification_payload).encode()),
                    routing_key=queue.name,
                )

            return {
                "status": "success",
                "PaymentID": payment_data.get("PaymentID"),
                "DiagnosisID": diag_data.get("DiagnosisID"),
                "paymentStatus": payment_data.get("status"),
                "checkout_url": payment_data.get("checkout_url")
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Orchestration Error: {repr(e)}")
            raise HTTPException(status_code=500, detail="Failed to finalize consultation.")
