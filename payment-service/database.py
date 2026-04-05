import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


async def get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    return await asyncpg.connect(DATABASE_URL, statement_cache_size=0)


async def init_db():
    conn = await get_db_connection()
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                payment_id              TEXT PRIMARY KEY,
                consult_id              TEXT,
                patient_id              TEXT,
                amount                  NUMERIC(12,2) NOT NULL,
                status                  TEXT NOT NULL
                                         CHECK (status IN ('PENDING', 'PAID', 'REFUNDED')),
                paypal_transaction_id  TEXT,
                refund_id               TEXT,
                created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_consult_id
            ON payments (consult_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_patient_id
            ON payments (patient_id);
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_payments_status
            ON payments (status);
        """)
        print("DB ready, payments table initialised.")
    finally:
        await conn.close()

