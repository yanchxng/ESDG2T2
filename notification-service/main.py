import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager

import aio_pika
import sendgrid
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sendgrid.helpers.mail import Mail, HtmlContent, Content
from typing import Optional

load_dotenv()

AMQP_URL = os.getenv("AMQP_URL", "amqp://guest:guest@localhost:5672/")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
QUEUE_NAME = "email_notifications"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


class EmailNotification(BaseModel):
    to: str
    from_email: str = Field("noreply@medilink.com", alias="from")
    subject: str = "(No subject)"
    details: str = ""
    zoom_url: Optional[str] = None

    model_config = {"populate_by_name": True}


def build_html(details: str, zoom_url: Optional[str]) -> str:
    zoom_block = ""
    if zoom_url:
        zoom_block = f"""
        <p style="margin-top:24px;">
            <a href="{zoom_url}"
               style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;
                      text-decoration:none;font-weight:bold;">
                Join Zoom Consultation
            </a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:8px;">
            Or copy this link: <a href="{zoom_url}">{zoom_url}</a>
        </p>"""
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;">
        <h2 style="color:#1e3a5f;">MediLink</h2>
        <p>{details}</p>
        {zoom_block}
    </div>"""


def send_email(notification: EmailNotification):
    sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
    message = Mail(
        from_email=notification.from_email,
        to_emails=notification.to,
        subject=notification.subject,
    )
    message.content = [
        Content("text/plain", notification.details),
        Content("text/html", build_html(notification.details, notification.zoom_url)),
    ]
    response = sg.send(message)
    log.info(f"SendGrid response: {response.status_code} — email sent to {notification.to}")


async def process_message(message: aio_pika.IncomingMessage):
    # Validate message schema — bad messages are discarded (not requeued)
    try:
        data = json.loads(message.body.decode())
        notification = EmailNotification.model_validate(data)
    except Exception as e:
        log.error(f"Invalid message format — discarding: {e}")
        await message.nack(requeue=False)
        return

    # Send email — transient failures are requeued for retry
    try:
        log.info(f"Processing email → to={notification.to}, subject={notification.subject}")
        send_email(notification)
        await message.ack()
    except Exception as e:
        log.error(f"Failed to send email — requeuing: {e}")
        await message.nack(requeue=True)


async def consume_queue():
    log.info("Notification service starting — connecting to RabbitMQ...")
    while True:
        try:
            connection = await aio_pika.connect_robust(AMQP_URL)
            break
        except Exception as e:
            log.warning(f"RabbitMQ not ready yet ({e}) — retrying in 5s")
            await asyncio.sleep(5)

    log.info("Connected to RabbitMQ")
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)
        queue = await channel.declare_queue(QUEUE_NAME, durable=True)
        log.info(f"Listening on queue '{QUEUE_NAME}'...")
        await queue.consume(process_message)
        await asyncio.Future()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not SENDGRID_API_KEY:
        log.error("SENDGRID_API_KEY is not set — exiting")
        sys.exit(1)
    task = asyncio.create_task(consume_queue())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "notification-service"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, log_level="info")
