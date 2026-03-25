from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid
import os
from dotenv import load_dotenv

from database import get_db_connection, init_db

load_dotenv()

app = FastAPI(title="Diagnosis Service")


@app.on_event("startup")
async def startup():
    await init_db()


class CreateDiagnosisRequest(BaseModel):
    PatientID: str
    ConsultID: str
    diagnosis: str
    prescription: str


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "diagnosis-service"}


@app.post("/api/diagnoses", status_code=201)
async def create_diagnosis(request: CreateDiagnosisRequest):
    # Keep medical records out of logs; store only in the service-owned DB table.
    if not request.diagnosis or not request.diagnosis.strip():
        raise HTTPException(status_code=400, detail="diagnosis is required")
    if not request.prescription or not request.prescription.strip():
        raise HTTPException(status_code=400, detail="prescription is required")

    diagnosis_id = str(uuid.uuid4())

    conn = await get_db_connection()
    try:
        await conn.execute(
            """
            INSERT INTO diagnoses (diagnosis_id, consult_id, patient_id, diagnosis, prescription)
            VALUES ($1, $2, $3, $4, $5)
            """,
            diagnosis_id,
            request.ConsultID,
            request.PatientID,
            request.diagnosis.strip(),
            request.prescription.strip(),
        )
    finally:
        await conn.close()

    # Contract needed by `consult-doctor-service`: it expects { "DiagnosisID": ... }
    return {"DiagnosisID": diagnosis_id}

