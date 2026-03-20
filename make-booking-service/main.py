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
AMQP_URL = os.getenv("AMQP_URL")

app = FastAPI()

# Define the expected JSON payload from the UI
class BookingRequest(BaseModel):
    PatientID: str
    DoctorID: str
    timeslot: str

@app.post("/api/booking")
async def make_booking(request: BookingRequest):
    # We use httpx.AsyncClient() exactly like we used Axios
    async with httpx.AsyncClient() as client:
        try:
            # Arrows 2 & 3: GET Patient info
            patient_res = await client.get(f"{PATIENT_SERVICE_URL}/api/patients/{request.PatientID}")
            patient_res.raise_for_status()
            patient_data = patient_res.json()

            # Arrows 4 & 5: GET Doctor info
            doctor_res = await client.get(f"{DOCTOR_SERVICE_URL}/api/doctors/{request.DoctorID}", params={"timeslot": request.timeslot})
            doctor_res.raise_for_status()
            doctor_data = doctor_res.json()

            # Arrows 6-9: POST to Consult Service
            consult_payload = {
                "PatientID": request.PatientID,
                "DoctorID": request.DoctorID,
                "timeslot": request.timeslot
            }
            consult_res = await client.post(f"{CONSULT_SERVICE_URL}/api/consults", json=consult_payload)
            consult_res.raise_for_status()
            consult_data = consult_res.json()

            # Arrow 10: AMQP Notification via RabbitMQ
            connection = await aio_pika.connect_robust(AMQP_URL)
            async with connection:
                channel = await connection.channel()
                queue = await channel.declare_queue("email_notifications", durable=True)
                
                notification_payload = {
                    "to": patient_data.get("email"),
                    "from": "appointments@medilink.com",
                    "subject": "Your Teleconsultation is Confirmed",
                    "details": f"Hello {patient_data.get('Name')}, your consult is booked. Join here: {consult_data.get('url')}"
                }
                
                await channel.default_exchange.publish(
                    aio_pika.Message(body=json.dumps(notification_payload).encode()),
                    routing_key=queue.name,
                )

        
            return {
                "ConsultID": consult_data.get("ConsultID"),
                "timeslot": request.timeslot,
                "url": consult_data.get("url")
            }

        except httpx.HTTPStatusError as exc:
            print(f"Error response {exc.response.status_code} while requesting {exc.request.url}")
            raise HTTPException(status_code=500, detail="Failed to process booking request due to internal service error.")
        except Exception as e:
            print(f"Orchestration Error: {str(e)}")
            raise HTTPException(status_code=500, detail="An unexpected error occurred.")

