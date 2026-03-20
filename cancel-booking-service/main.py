from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import aio_pika
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

PATIENT_SERVICE_URL = os.getenv("PATIENT_SERVICE_URL")
DOCTOR_SERVICE_URL = os.getenv("DOCTOR_SERVICE_URL")
CONSULT_SERVICE_URL = os.getenv("CONSULT_SERVICE_URL")
PAYMENT_SERVICE_URL = os.getenv("PAYMENT_SERVICE_URL")
AMQP_URL = os.getenv("AMQP_URL")

app = FastAPI()

# Define the expected JSON payload from the UI
class CancelRequest(BaseModel):
    PatientID: str
    ConsultID: str

@app.post("/api/booking/cancel")
async def cancel_booking(request: CancelRequest):
    async with httpx.AsyncClient() as client:
        try:
            # 1. GET Patient Details (for notification)
            patient_res = await client.get(f"{PATIENT_SERVICE_URL}/api/patients/{request.PatientID}")
            patient_res.raise_for_status()
            patient_data = patient_res.json()

            # 2. GET Consult Details (Need this to know which Doctor and Payment to reverse)
            consult_res = await client.get(f"{CONSULT_SERVICE_URL}/api/consults/{request.ConsultID}")
            consult_res.raise_for_status()
            consult_data = consult_res.json()
            
            doctor_id = consult_data.get("DoctorID")
            payment_id = consult_data.get("PaymentID")
            amount = consult_data.get("amount")

            # 3. GET Doctor Details (for notification)
            doctor_res = await client.get(f"{DOCTOR_SERVICE_URL}/api/doctors/{doctor_id}")
            doctor_res.raise_for_status()
            doctor_data = doctor_res.json()

            # 4. POST to Consult Service to delete the Zoom meeting and update DB status
            cancel_consult_payload = {
                "ConsultID": request.ConsultID,
                "action": "delete_booking"
            }
            cancel_res = await client.post(f"{CONSULT_SERVICE_URL}/api/consults/cancel", json=cancel_consult_payload)
            cancel_res.raise_for_status()

            # 5. POST to Payment Service to issue a refund via PayPal
            if payment_id:
                refund_payload = {
                    "PaymentID": payment_id,
                    "amount": amount,
                    "action": "refund"
                }
                refund_res = await client.post(f"{PAYMENT_SERVICE_URL}/api/payments/refund", json=refund_payload)
                refund_res.raise_for_status()

            # 6. AMQP Notification (Send cancellation emails to BOTH parties)
            connection = await aio_pika.connect_robust(AMQP_URL)
            async with connection:
                channel = await connection.channel()
                queue = await channel.declare_queue("email_notifications", durable=True)
                
                # Payload for Patient
                patient_email_payload = {
                    "to": patient_data.get("email"),
                    "from": "appointments@medilink.com",
                    "subject": "Cancellation Confirmed & Refund Initiated",
                    "details": f"Hi {patient_data.get('Name')}, your consult ({request.ConsultID}) has been cancelled. A refund of ${amount} has been initiated."
                }
                
                # Payload for Doctor
                doctor_email_payload = {
                    "to": doctor_data.get("email"),
                    "from": "appointments@medilink.com",
                    "subject": "Appointment Cancelled by Patient",
                    "details": f"Dr. {doctor_data.get('Name')}, please note that your appointment ({request.ConsultID}) has been cancelled by the patient."
                }
                
                # Publish both messages to the queue
                await channel.default_exchange.publish(
                    aio_pika.Message(body=json.dumps(patient_email_payload).encode()),
                    routing_key=queue.name,
                )
                await channel.default_exchange.publish(
                    aio_pika.Message(body=json.dumps(doctor_email_payload).encode()),
                    routing_key=queue.name,
                )

            # Return final success status to the UI
            return {
                "ConsultID": request.ConsultID,
                "status": "cancelled",
                "refund_status": "initiated" if payment_id else "no_payment_found"
            }

        except httpx.HTTPStatusError as exc:
            print(f"Error response {exc.response.status_code} while requesting {exc.request.url}")
            raise HTTPException(status_code=500, detail="Failed to cancel booking due to downstream service error.")
        except Exception as e:
            print(f"Orchestration Error: {str(e)}")
            raise HTTPException(status_code=500, detail="An unexpected error occurred during cancellation.")

