import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


async def get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    return await asyncpg.connect(DATABASE_URL)


async def init_db():
    conn = await get_db_connection()
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS diagnoses (
                diagnosis_id   TEXT PRIMARY KEY,
                consult_id     TEXT,
                patient_id     TEXT,
                diagnosis      TEXT NOT NULL,
                prescription   TEXT NOT NULL,
                created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_diagnoses_consult_id
            ON diagnoses (consult_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_diagnoses_patient_id
            ON diagnoses (patient_id);
        """)
        print("DB ready, diagnoses table initialised.")
    finally:
        await conn.close()

