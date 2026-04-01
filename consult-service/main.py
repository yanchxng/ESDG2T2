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

RESERVATION_MINUTES = 10

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
    timeslot:  str  

class ReserveSlotRequest(BaseModel):
    PatientID: str
    DoctorID:  str
    timeslot:  str

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
    try:
        booked_rows = await conn.fetch(
            """
            SELECT timeslot FROM consultations
            WHERE doctor_id      = $1
              AND DATE(timeslot) = $2::date
              AND status        != 'cancelled'
            """,
            DoctorID, date
        )

        reserved_rows = await conn.fetch(
            """
            SELECT timeslot FROM reservations
            WHERE doctor_id      = $1
              AND DATE(timeslot) = $2::date
              AND expires_at     > $3
            """,
            DoctorID, date, now
        )

        booked   = [row["timeslot"].isoformat() for row in booked_rows]
        reserved = [row["timeslot"].isoformat() for row in reserved_rows]

        return {
            "DoctorID":          DoctorID,
            "date":              date,
            "unavailable_slots": list(set(booked + reserved))  
        }
    finally:
        await conn.close()

# Called the moment a patient CLICKS a timeslot (before confirming).
# Holds the slot for 10 mins. If not confirmed in time, it auto-releases.
@app.post("/api/consults/reserve", status_code=201)
async def reserve_slot(request: ReserveSlotRequest):
    """
    Returns ReservationID which the frontend must include when calling
    POST /api/consults to confirm the booking.
    """
    conn    = await get_db_connection()
    now     = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=RESERVATION_MINUTES)
    try:
        await conn.execute(
            """
            DELETE FROM reservations
            WHERE doctor_id = $1 AND timeslot = $2::timestamptz AND expires_at <= $3
            """,
            request.DoctorID, request.timeslot, now
        )

        booked = await conn.fetchrow(
            """
            SELECT consult_id FROM consultations
            WHERE doctor_id = $1 AND timeslot = $2::timestamptz AND status != 'cancelled'
            """,
            request.DoctorID, request.timeslot
        )
        if booked:
            raise HTTPException(status_code=409, detail="This slot is already booked.")

        existing = await conn.fetchrow(
            """
            SELECT reservation_id, patient_id FROM reservations
            WHERE doctor_id  = $1
              AND timeslot   = $2::timestamptz
              AND expires_at > $3
            """,
            request.DoctorID, request.timeslot, now
        )
        if existing:
            if existing["patient_id"] == request.PatientID:
                await conn.execute(
                    "UPDATE reservations SET expires_at = $1 WHERE reservation_id = $2",
                    expires, existing["reservation_id"]
                )
                return {
                    "ReservationID": existing["reservation_id"],
                    "PatientID":     request.PatientID,
                    "DoctorID":      request.DoctorID,
                    "timeslot":      request.timeslot,
                    "expires_at":    expires.isoformat(),
                    "message":       f"Reservation refreshed. You have {RESERVATION_MINUTES} minutes to confirm."
                }
            else:
                raise HTTPException(
                    status_code=409,
                    detail="This slot is currently being held by another user. Please select a different slot."
                )

        reservation_id = str(uuid.uuid4())
        await conn.execute(
            """
            INSERT INTO reservations (reservation_id, patient_id, doctor_id, timeslot, expires_at)
            VALUES ($1, $2, $3, $4::timestamptz, $5)
            """,
            reservation_id, request.PatientID, request.DoctorID, request.timeslot, expires
        )

        return {
            "ReservationID": reservation_id,
            "PatientID":     request.PatientID,
            "DoctorID":      request.DoctorID,
            "timeslot":      request.timeslot,
            "expires_at":    expires.isoformat(),
            "message":       f"Slot reserved. You have {RESERVATION_MINUTES} minutes to confirm your booking."
        }
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
# Validates reservation → creates Zoom meeting → saves permanent booking.
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

        zoom_meeting    = await zoom.create_meeting(
            topic      = f"MediLink Consultation",
            start_time = request.timeslot,
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

        await conn.execute(
            """
            DELETE FROM reservations
            WHERE patient_id = $1 AND doctor_id = $2 AND timeslot = $3::timestamptz
            """,
            request.PatientID, request.DoctorID, request.timeslot
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
