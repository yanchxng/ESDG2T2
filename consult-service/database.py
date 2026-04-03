import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


async def get_db_connection():
    return await asyncpg.connect(DATABASE_URL, statement_cache_size=0)


async def init_db():
    conn = await get_db_connection()
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS consultations (
                consult_id      TEXT PRIMARY KEY,
                patient_id      TEXT NOT NULL,
                doctor_id       TEXT NOT NULL,
                timeslot        TIMESTAMPTZ NOT NULL,
                status          TEXT NOT NULL DEFAULT 'booked'
                                    CHECK (status IN ('booked', 'cancelled', 'completed')),
                zoom_meeting_id TEXT,
                zoom_url        TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)

        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_consults_doctor_timeslot
            ON consultations (doctor_id, timeslot);
        """)

        print("DB ready, consultations table initialised.")
    finally:
        await conn.close()
