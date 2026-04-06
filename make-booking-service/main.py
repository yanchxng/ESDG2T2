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

class BookingRequest(BaseModel):
    PatientID: str
    timeslot: str

@app.get("/api/booking/capacity")
async def get_booking_capacity(date: str):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            doctors_res = await client.get(f"{DOCTOR_SERVICE_URL}/doctor/")
            if doctors_res.status_code != 200:
                return {"full_slots": []}
            
            all_doctors = doctors_res.json().get("Data", [])
            total_doctors = len(all_doctors)
            
            if total_doctors == 0:
                return {"full_slots": []}

            slot_counts = {}
            for doctor in all_doctors:
                doc_id = doctor.get("DoctorID")
                slots_res = await client.get(f"{CONSULT_SERVICE_URL}/api/consults/slots?DoctorID={doc_id}&date={date}")
                
                if slots_res.status_code == 200:
                    unavailable = slots_res.json().get("unavailable_slots", [])
                    for slot_iso in unavailable:
                        try:
                            normalized = slot_iso.replace(" ", "T")
                            if "T" in normalized:
                                time_part = normalized.split("T")[1][:5]
                                slot_counts[time_part] = slot_counts.get(time_part, 0) + 1
                        except IndexError:
                            pass
            
            full_slots = [time for time, count in slot_counts.items() if count >= total_doctors]
            
            return {"full_slots": full_slots}
            
        except Exception as e:
            print(f"Capacity Check Error: {str(e)}")
            return {"full_slots": []}


@app.post("/api/booking")
async def make_booking(request: BookingRequest):
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            patient_res = await client.get(f"{PATIENT_SERVICE_URL}/patient/{request.PatientID}/")
            patient_res.raise_for_status()
            patient_data = patient_res.json().get("Data", {})

            doctors_res = await client.get(f"{DOCTOR_SERVICE_URL}/doctor/")
            doctors_res.raise_for_status()
            all_doctors = doctors_res.json().get("Data", [])

            if not all_doctors:
                raise HTTPException(status_code=400, detail="No doctors available in the system.")

            random.shuffle(all_doctors)
            
            selected_doctor_id = None
            date_str = request.timeslot.split("T")[0]

            for doctor in all_doctors:
                doc_id = doctor.get("DoctorID")
                slots_res = await client.get(f"{CONSULT_SERVICE_URL}/api/consults/slots?DoctorID={doc_id}&date={date_str}")
                if slots_res.status_code == 200:
                    unavailable = slots_res.json().get("unavailable_slots", [])

                    req_time_str = request.timeslot.replace('Z', '').split('+')[0]
                    if len(req_time_str.split(':')) == 2:
                        req_time_str += ':00'

                    is_unavailable = False
                    for u_slot in unavailable:
                        u_slot_str = u_slot.replace('Z', '').split('+')[0]
                        if req_time_str == u_slot_str:
                            is_unavailable = True
                            break

                    if not is_unavailable:
                        selected_doctor_id = doc_id
                        doctor_data = doctor
                        break
            
            if not selected_doctor_id:
                raise HTTPException(status_code=400, detail="No doctors available for this timeslot.")

            consult_payload = {
                "PatientID": request.PatientID,
                "DoctorID": selected_doctor_id,
                "timeslot": request.timeslot
            }
            consult_res = await client.post(f"{CONSULT_SERVICE_URL}/api/consults", json=consult_payload)
            consult_res.raise_for_status()
            consult_data = consult_res.json()

            connection = await aio_pika.connect_robust(AMQP_URL)
            async with connection:
                channel = await connection.channel()
                queue = await channel.declare_queue("email_notifications", durable=True)
                
                notification_payload = {
                    "to": patient_data.get("Email"),
                    "from": "medilink.notifications@gmail.com",
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
            import traceback
            traceback.print_exc()
            print(f"Error response {exc.response.status_code} while requesting {exc.request.url}")
            raise HTTPException(status_code=500, detail="Failed to process booking request due to internal service error.")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Orchestration Error: {str(e)}")
            raise HTTPException(status_code=500, detail="An unexpected error occurred.")

