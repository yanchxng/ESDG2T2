from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import aio_pika
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
            # GET Patient
            patient_res = await client.get(f"{PATIENT_SERVICE_URL}/patient/{request.PatientID}/")
            patient_res.raise_for_status()
            patient_data = patient_res.json().get("Data", {})

            # GET Consult info
            consult_res = await client.get(f"{CONSULT_SERVICE_URL}/api/consults/{request.ConsultID}")
            consult_res.raise_for_status()

            # POST to Diagnosis Service
            diag_payload = {
                "PatientID": request.PatientID,
                "ConsultID": request.ConsultID,
                "diagnosis": request.diagnosis,
                "prescription": request.prescription
            }
            diag_res = await client.post(f"{DIAGNOSIS_SERVICE_URL}/api/diagnoses", json=diag_payload)
            diag_res.raise_for_status()
            diag_data = diag_res.json()

            # POST to Payment Service
            payment_payload = {
                "PatientID": request.PatientID,
                "ConsultID": request.ConsultID,
                "amount": request.amount
            }
            payment_res = await client.post(f"{PAYMENT_SERVICE_URL}/api/payments", json=payment_payload)
            payment_res.raise_for_status()
            payment_data = payment_res.json()

            # UPDATE Consult Status to Completed
            update_res = await client.post(f"{CONSULT_SERVICE_URL}/api/consults/complete?consult_id={request.ConsultID}")
            update_res.raise_for_status()

            # AMQP Notification
            connection = await aio_pika.connect_robust(AMQP_URL)
            async with connection:
                channel = await connection.channel()
                queue = await channel.declare_queue("email_notifications", durable=True)
                
                notification_payload = {
                    "to": patient_data.get("Email") or patient_data.get("email") or "test@example.com",
                    "from": "medilink.notifications@gmail.com",
                    "subject": "Payment Receipt & Post-Consultation Summary",
                    "details": f"Your consultation has been successfully completed.<br><br><b>Diagnosis:</b> {request.diagnosis}<br><b>Prescription:</b> {request.prescription}<br><br><b>Amount Paid:</b> ${request.amount:.2f}<br><b>Payment ID:</b> {payment_data.get('PaymentID')}"
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
