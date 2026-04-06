from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import os
from dotenv import load_dotenv

from database import get_db_connection, init_db

load_dotenv()

app = FastAPI(title="Diagnosis Service")

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

    return {"DiagnosisID": diagnosis_id}

@app.get("/api/diagnoses/{consult_id}")
async def get_diagnosis(consult_id: str):
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow(
            "SELECT * FROM diagnoses WHERE consult_id = $1", consult_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
        return dict(row)
    finally:
        await conn.close()

