from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid
import os
import asyncio
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from database import get_db_connection, init_db
import zoom
import strawberry
from strawberry.fastapi import GraphQLRouter
import httpx
from typing import List, Optional

load_dotenv()

DIAGNOSIS_SERVICE_URL = os.getenv('DIAGNOSIS_SERVICE_URL', 'http://localhost:5004')

async def _fetch_diagnosis_by_consult(consult_id: str, client: httpx.AsyncClient):
    try:
        response = await client.get(f"{DIAGNOSIS_SERVICE_URL}/api/diagnoses/{consult_id}", timeout=10.0)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPStatusError, httpx.RequestError):
        return None

# GraphQL Types
@strawberry.type
class Consultation:
    consult_id: str
    patient_id: str
    doctor_id: str
    timeslot: str
    status: str
    zoom_url: Optional[str]
    created_at: str
    updated_at: str

@strawberry.type
class ConsultationStats:
    total_consultations: int
    completed_consultations: int
    upcoming_consultations: int
    cancelled_consultations: int

@strawberry.type
class ConsultationStatusCount:
    status: str
    count: int

@strawberry.type
class ConsultationTrend:
    date: str
    count: int

@strawberry.type
class HourlyStats:
    hour: int
    count: int

@strawberry.type
class WeeklyStats:
    day: str
    count: int

@strawberry.type
class DiagnosisStats:
    diagnosis: str
    count: int

@strawberry.type
class RecentDiagnosis:
    diagnosis_id: str
    consult_id: str
    patient_id: str
    diagnosis: str
    prescription: str
    created_at: str

@strawberry.type
class MonthlyComparison:
    current_month: int
    previous_month: int
    growth_percentage: float

@strawberry.type
class Query:
    @strawberry.field
    async def get_consultation_stats(self, doctor_id: str) -> ConsultationStats:
        # Authorization check - only allow doctors to access their own stats
        # In a real app, you'd get this from JWT token
        # For now, we'll assume the doctor_id is validated at the API gateway level

        conn = await get_db_connection()
        try:
            # Get total consultations
            total_row = await conn.fetchrow(
                "SELECT COUNT(*) as count FROM consultations WHERE doctor_id = $1",
                doctor_id
            )
            total_consultations = total_row["count"]

            # Get completed consultations
            completed_row = await conn.fetchrow(
                "SELECT COUNT(*) as count FROM consultations WHERE doctor_id = $1 AND status = 'completed'",
                doctor_id
            )
            completed_consultations = completed_row["count"]

            # Get upcoming consultations (booked but not completed or cancelled)
            upcoming_row = await conn.fetchrow(
                "SELECT COUNT(*) as count FROM consultations WHERE doctor_id = $1 AND status = 'booked' AND timeslot > NOW()",
                doctor_id
            )
            upcoming_consultations = upcoming_row["count"]

            # Get cancelled consultations
            cancelled_row = await conn.fetchrow(
                "SELECT COUNT(*) as count FROM consultations WHERE doctor_id = $1 AND status = 'cancelled'",
                doctor_id
            )
            cancelled_consultations = cancelled_row["count"]

            return ConsultationStats(
                total_consultations=total_consultations,
                completed_consultations=completed_consultations,
                upcoming_consultations=upcoming_consultations,
                cancelled_consultations=cancelled_consultations
            )
        finally:
            await conn.close()

    @strawberry.field
    async def get_consultation_status_counts(self, doctor_id: str) -> List[ConsultationStatusCount]:
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT status, COUNT(*) as count
                FROM consultations
                WHERE doctor_id = $1
                GROUP BY status
                ORDER BY count DESC
                """,
                doctor_id
            )

            return [
                ConsultationStatusCount(status=row["status"], count=row["count"])
                for row in rows
            ]
        finally:
            await conn.close()

    @strawberry.field
    async def get_consultation_trends(self, doctor_id: str, days: int = 30) -> List[ConsultationTrend]:
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM consultations
                WHERE doctor_id = $1
                  AND created_at >= NOW() - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date ASC
                """ % days,
                doctor_id
            )

            return [
                ConsultationTrend(date=row["date"].isoformat(), count=row["count"])
                for row in rows
            ]
        finally:
            await conn.close()

    @strawberry.field
    async def get_recent_consultations(self, doctor_id: str, limit: int = 10) -> List[Consultation]:
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT consult_id, patient_id, doctor_id, timeslot::text, status, zoom_url, created_at::text, updated_at::text
                FROM consultations
                WHERE doctor_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                doctor_id, limit
            )

            return [
                Consultation(
                    consult_id=row["consult_id"],
                    patient_id=row["patient_id"],
                    doctor_id=row["doctor_id"],
                    timeslot=row["timeslot"],
                    status=row["status"],
                    zoom_url=row["zoom_url"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"]
                )
                for row in rows
            ]
        finally:
            await conn.close()

    @strawberry.field
    async def get_peak_hours(self, doctor_id: str) -> List[HourlyStats]:
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT
                    EXTRACT(hour from timeslot) as hour,
                    COUNT(*) as count
                FROM consultations
                WHERE doctor_id = $1
                  AND timeslot >= NOW() - INTERVAL '90 days'
                GROUP BY EXTRACT(hour from timeslot)
                ORDER BY hour ASC
                """,
                doctor_id
            )

            return [
                HourlyStats(hour=int(row["hour"]), count=row["count"])
                for row in rows
            ]
        finally:
            await conn.close()

    @strawberry.field
    async def get_weekly_pattern(self, doctor_id: str) -> List[WeeklyStats]:
        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                """
                SELECT
                    CASE EXTRACT(dow from timeslot)
                        WHEN 0 THEN 'Sunday'
                        WHEN 1 THEN 'Monday'
                        WHEN 2 THEN 'Tuesday'
                        WHEN 3 THEN 'Wednesday'
                        WHEN 4 THEN 'Thursday'
                        WHEN 5 THEN 'Friday'
                        WHEN 6 THEN 'Saturday'
                    END as day,
                    COUNT(*) as count
                FROM consultations
                WHERE doctor_id = $1
                  AND timeslot >= NOW() - INTERVAL '90 days'
                GROUP BY EXTRACT(dow from timeslot), day
                ORDER BY EXTRACT(dow from timeslot) ASC
                """,
                doctor_id
            )

            return [
                WeeklyStats(day=row["day"], count=row["count"])
                for row in rows
            ]
        finally:
            await conn.close()

    @strawberry.field
    async def get_monthly_comparison(self, doctor_id: str) -> MonthlyComparison:
        conn = await get_db_connection()
        try:
            # Current month consultations
            current_month_row = await conn.fetchrow(
                """
                SELECT COUNT(*) as count
                FROM consultations
                WHERE doctor_id = $1
                  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
                """,
                doctor_id
            )
            current_month = current_month_row["count"]

            # Previous month consultations
            previous_month_row = await conn.fetchrow(
                """
                SELECT COUNT(*) as count
                FROM consultations
                WHERE doctor_id = $1
                  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                """,
                doctor_id
            )
            previous_month = previous_month_row["count"]

            # Calculate growth percentage
            if previous_month == 0:
                growth_percentage = 100.0 if current_month > 0 else 0.0
            else:
                growth_percentage = ((current_month - previous_month) / previous_month) * 100

            return MonthlyComparison(
                current_month=current_month,
                previous_month=previous_month,
                growth_percentage=round(growth_percentage, 1)
            )
        finally:
            await conn.close()

    @strawberry.field
    async def get_top_diagnoses(self, doctor_id: str, limit: int = 5) -> List[DiagnosisStats]:
        conn = await get_db_connection()
        try:
            consult_rows = await conn.fetch(
                """
                SELECT consult_id FROM consultations
                WHERE doctor_id = $1 AND status = 'completed'
                ORDER BY created_at DESC
                LIMIT 100
                """,
                doctor_id
            )

            if not consult_rows:
                return []

            consult_ids = [row["consult_id"] for row in consult_rows]

            async with httpx.AsyncClient() as client:
                diagnoses = await asyncio.gather(
                    *[_fetch_diagnosis_by_consult(consult_id, client) for consult_id in consult_ids]
                )

            counts = {}
            for diag in diagnoses:
                if not diag:
                    continue
                name = diag.get("diagnosis", "Unknown").strip()
                counts[name] = counts.get(name, 0) + 1

            top = sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]
            return [DiagnosisStats(diagnosis=name, count=count) for name, count in top]
        finally:
            await conn.close()

    @strawberry.field
    async def get_recent_diagnoses(self, doctor_id: str, limit: int = 5) -> List[RecentDiagnosis]:
        conn = await get_db_connection()
        try:
            consult_rows = await conn.fetch(
                """
                SELECT c.consult_id, c.patient_id, c.created_at
                FROM consultations c
                WHERE c.doctor_id = $1 AND c.status = 'completed'
                ORDER BY c.created_at DESC
                LIMIT $2
                """,
                doctor_id, limit
            )

            if not consult_rows:
                return []

            async with httpx.AsyncClient() as client:
                diagnosis_rows = await asyncio.gather(
                    *[_fetch_diagnosis_by_consult(row["consult_id"], client) for row in consult_rows]
                )

            recent = []
            for consult_row, diag_row in zip(consult_rows, diagnosis_rows):
                if not diag_row:
                    continue
                created_at_value = diag_row.get("created_at", consult_row["created_at"])
                if isinstance(created_at_value, datetime):
                    created_at_value = created_at_value.isoformat()
                recent.append(RecentDiagnosis(
                    diagnosis_id=diag_row.get("diagnosis_id", ""),
                    consult_id=consult_row["consult_id"],
                    patient_id=consult_row["patient_id"],
                    diagnosis=diag_row.get("diagnosis", "Unknown"),
                    prescription=diag_row.get("prescription", ""),
                    created_at=str(created_at_value)
                ))

            return recent[:limit]
        finally:
            await conn.close()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create GraphQL schema and router
schema = strawberry.Schema(Query)
graphql_app = GraphQLRouter(schema)

# Mount GraphQL at /graphql endpoint
app.include_router(graphql_app, prefix="/graphql")

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
