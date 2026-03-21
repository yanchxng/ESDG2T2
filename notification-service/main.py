import asyncio
import json
import os
import logging
from dotenv import load_dotenv
import aio_pika
import sendgrid
from sendgrid.helpers.mail import Mail

load_dotenv()

AMQP_URL = os.getenv("AMQP_URL", "amqp://guest:guest@localhost:5672/")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
QUEUE_NAME = "email_notifications"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def send_email(to: str, from_email: str, subject: str, body: str):
    """Send an email via SendGrid. Raises on failure."""
    sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
    message = Mail(
        from_email=from_email,
        to_emails=to,
        subject=subject,
        plain_text_content=body,
    )
    response = sg.send(message)
    log.info(f"SendGrid response: {response.status_code} — email sent to {to}")


async def process_message(message: aio_pika.IncomingMessage):
    async with message.process(requeue=False):
        try:
            data = json.loads(message.body.decode())
            to = data.get("to")
            from_email = data.get("from", "noreply@medilink.com")
            subject = data.get("subject", "(No subject)")
            details = data.get("details", "")

            if not to:
                log.warning("Message missing 'to' field — skipping")
                return

            log.info(f"Processing email → to={to}, subject={subject}")
            send_email(to, from_email, subject, details)

        except Exception as e:
            log.error(f"Failed to process message: {e}")
            # Message is already ack'd via context manager (requeue=False),
            # so failed messages go to dead-letter or are dropped.


async def main():
    log.info("Notification service starting — connecting to RabbitMQ...")

    # Retry loop so the service waits for RabbitMQ to be ready on startup
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

        # Keep the service alive
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
