from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from database import get_db_connection, init_db
import zoom

load_dotenv()

app = FastAPI()

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

class CreateConsultRequest(BaseModel):
    PatientID: str
    DoctorID:  str
    timeslot:  datetime

class CancelConsultRequest(BaseModel):
    ConsultID: str
    action:    str

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "consult-service"}

# Called by the UI when patient is BROWSING timeslots.
# Returns slots that are booked OR temporarily reserved — UI greys these out.
@app.get("/api/consults/slots")
async def get_unavailable_slots(DoctorID: str, date: str):
    """
    Query params:
        DoctorID — e.g. "D001"
        date     — e.g. "2025-06-15"
    """
    conn = await get_db_connection()
    now  = datetime.now(timezone.utc)
    from datetime import datetime as dt
    parsed_date = dt.strptime(date, "%Y-%m-%d").date()
    try:
        booked_rows = await conn.fetch(
            """
            SELECT timeslot FROM consultations
            WHERE doctor_id      = $1
              AND DATE(timeslot) = $2::date
              AND status        != 'cancelled'
            """,
            DoctorID, parsed_date
        )

        booked   = [row["timeslot"].isoformat() for row in booked_rows]

        return {
            "DoctorID":          DoctorID,
            "date":              date,
            "unavailable_slots": list(set(booked))  
        }
    finally:
        await conn.close()

@app.get("/api/consults/patient/{patient_id}")
async def get_consults_by_patient(patient_id: str):
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            "SELECT * FROM consultations WHERE patient_id = $1 ORDER BY timeslot DESC", patient_id
        )
        return [dict(row) for row in rows]
    finally:
        await conn.close()

@app.get("/api/consults/doctor/{doctor_id}")
async def get_consults_by_doctor(doctor_id: str):
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            "SELECT * FROM consultations WHERE doctor_id = $1 ORDER BY timeslot DESC", doctor_id
        )
        return [dict(row) for row in rows]
    finally:
        await conn.close()

# Called by Consult Doctor composite (Image 1, step 4)
# and Cancel Consult composite (Image 2) to fetch consult details.
@app.get("/api/consults/{consult_id}")
async def get_consult(consult_id: str):
    """Returns {ConsultID, timeslot, url} and full record."""
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM consultations WHERE consult_id = $1", consult_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Consultation not found")
        return dict(row)
    finally:
        await conn.close()

# Called by Make Booking composite (Image 3, step 6).
# Creates Zoom meeting → saves permanent booking.
# Returns {ConsultID, timeslot, url} back to Make Booking composite.
@app.post("/api/consults", status_code=201)
async def create_consult(request: CreateConsultRequest):
    """
    Image 3 steps 6–8:
        6. Receives {PatientID, DoctorID, timeslot} from Make Booking
        7. POST {timeslot} to Zoom API
        8. Zoom returns {url}
        9. Returns {ConsultID, timeslot, url} to Make Booking
    """
    conn = await get_db_connection()
    now  = datetime.now(timezone.utc)
    try:
        existing = await conn.fetchrow(
            """
            SELECT consult_id FROM consultations
            WHERE doctor_id = $1 AND timeslot = $2::timestamptz AND status != 'cancelled'
            """,
            request.DoctorID, request.timeslot
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="This timeslot was just taken. Please select another slot."
            )

        zoom_meeting = await zoom.create_meeting(
            topic      = f"MediLink Consultation",
            start_time = request.timeslot.isoformat(),
            duration   = 30
        )
        zoom_meeting_id = str(zoom_meeting["id"])
        zoom_url        = zoom_meeting["join_url"]

        consult_id = str(uuid.uuid4())
        await conn.execute(
            """
            INSERT INTO consultations
                (consult_id, patient_id, doctor_id, timeslot,
                 status, zoom_meeting_id, zoom_url, created_at, updated_at)
            VALUES ($1, $2, $3, $4::timestamptz, 'booked', $5, $6, $7, $7)
            """,
            consult_id, request.PatientID, request.DoctorID,
            request.timeslot, zoom_meeting_id, zoom_url, datetime.utcnow()
        )

        return {
            "ConsultID": consult_id,
            "PatientID": request.PatientID,
            "DoctorID":  request.DoctorID,
            "timeslot":  request.timeslot,
            "status":    "booked",
            "url":       zoom_url
        }

    finally:
        await conn.close()

# Called by Cancel Consult composite (Image 2, step 4)
# Deletes the Zoom meeting and marks the slot as cancelled
@app.post("/api/consults/cancel")
async def cancel_consult(request: CancelConsultRequest):
    """
    Image 2 steps 4–7:
        4. Receives {ConsultID, action: delete_booking} from Cancel Consult
        5. Calls Zoom API to delete the meeting
        6. Zoom returns {status}
        7. Returns {ConsultID, cancelled} to Cancel Consult
    """
    if request.action != "delete_booking":
        raise HTTPException(status_code=400, detail="Invalid action. Expected 'delete_booking'.")

    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM consultations WHERE consult_id = $1", request.ConsultID
        )
        if not row:
            raise HTTPException(status_code=404, detail="Consultation not found")
        if row["status"] == "cancelled":
            raise HTTPException(status_code=400, detail="Consultation is already cancelled")
        if row["status"] == "completed":
            raise HTTPException(status_code=400, detail="Cannot cancel a completed consultation")

        if row["zoom_meeting_id"]:
            await zoom.delete_meeting(row["zoom_meeting_id"])

        await conn.execute(
            "UPDATE consultations SET status = 'cancelled', updated_at = $1 WHERE consult_id = $2",
            datetime.utcnow(), request.ConsultID
        )

        return {
            "ConsultID": request.ConsultID,
            "status":    "cancelled"
        }

    finally:
        await conn.close()

# Called when a consultation status needs to be marked as completed.
@app.post("/api/consults/complete")
async def complete_consult(consult_id: str):
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM consultations WHERE consult_id = $1", consult_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Consultation not found")
        if row["status"] != "booked":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot complete a consultation with status '{row['status']}'"
            )

        await conn.execute(
            "UPDATE consultations SET status = 'completed', updated_at = $1 WHERE consult_id = $2",
            datetime.utcnow(), consult_id
        )

        return {
            "ConsultID": consult_id,
            "PatientID": row["patient_id"],
            "DoctorID":  row["doctor_id"],
            "timeslot":  row["timeslot"].isoformat(),
            "status":    "completed"
        }

    finally:
        await conn.close()
