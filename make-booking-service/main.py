from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import aio_pika
import json
import random
import os
from dotenv import load_dotenv

load_dotenv()

PATIENT_SERVICE_URL = os.getenv("PATIENT_SERVICE_URL")
DOCTOR_SERVICE_URL = os.getenv("DOCTOR_SERVICE_URL")
CONSULT_SERVICE_URL = os.getenv("CONSULT_SERVICE_URL")
AMQP_URL = os.getenv("AMQP_URL")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the expected JSON payload from the UI
class BookingRequest(BaseModel):
    PatientID: str
    timeslot: str

@app.post("/api/booking")
async def make_booking(request: BookingRequest):
    # We use httpx.AsyncClient() exactly like we used Axios
    async with httpx.AsyncClient() as client:
        try:
            # Arrows 2 & 3: GET Patient info
            patient_res = await client.get(f"{PATIENT_SERVICE_URL}/patient/{request.PatientID}/")
            patient_res.raise_for_status()
            patient_data = patient_res.json().get("Data", {})

            # Fetch all doctors
            doctors_res = await client.get(f"{DOCTOR_SERVICE_URL}/doctor/")
            doctors_res.raise_for_status()
            all_doctors = doctors_res.json().get("Data", [])
            
            if not all_doctors:
                raise HTTPException(status_code=400, detail="No doctors available in the system.")
            
            # Shuffle doctors to pick randomly
            random.shuffle(all_doctors)
            
            selected_doctor_id = None
            date_str = request.timeslot.split("T")[0]
            
            # Loop through doctors to find one available for the timeslot
            for doctor in all_doctors:
                doc_id = doctor.get("DoctorID")
                # Check availability in consult service
                slots_res = await client.get(f"{CONSULT_SERVICE_URL}/api/consults/slots?DoctorID={doc_id}&date={date_str}")
                if slots_res.status_code == 200:
                    unavailable = slots_res.json().get("unavailable_slots", [])
                    # Request.timeslot ends with "Z" or something? Let's assume exact match format comparison
                    # UI sends: 2026-04-01T15:40. If that string is not in unavailable list, pick them
                    # Alternatively, if they're not in the unavailable list, pick them.
                    if request.timeslot not in unavailable and f"{request.timeslot}:00" not in unavailable and f"{request.timeslot}:00Z" not in unavailable:
                        selected_doctor_id = doc_id
                        doctor_data = doctor
                        break
            
            if not selected_doctor_id:
                raise HTTPException(status_code=400, detail="No doctors available for this timeslot.")

            # Arrows 6-9: POST to Consult Service
            consult_payload = {
                "PatientID": request.PatientID,
                "DoctorID": selected_doctor_id,
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
                    "to": patient_data.get("Email"),
                    "from": "appointments@medilink.com",
                    "subject": "Your Teleconsultation is Confirmed",
                    "details": f"Hello {patient_data.get('Name')}, your teleconsultation has been confirmed. Use the link below to join your Zoom session at the scheduled time.",
                    "zoom_url": consult_data.get("url")
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

