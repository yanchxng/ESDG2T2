import os
import base64
import httpx
from dotenv import load_dotenv

load_dotenv()

ZOOM_ACCOUNT_ID    = os.getenv("ZOOM_ACCOUNT_ID")
ZOOM_CLIENT_ID     = os.getenv("ZOOM_CLIENT_ID")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET")

ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_API_BASE  = "https://api.zoom.us/v2"


async def _get_access_token() -> str:
    """Gets a short-lived Zoom OAuth token using account credentials."""
    credentials = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}"
    encoded = base64.b64encode(credentials.encode()).decode()

    async with httpx.AsyncClient() as client:
        res = await client.post(
            ZOOM_TOKEN_URL,
            params={"grant_type": "account_credentials", "account_id": ZOOM_ACCOUNT_ID},
            headers={
                "Authorization": f"Basic {encoded}",
                "Content-Type":  "application/x-www-form-urlencoded"
            }
        )
        res.raise_for_status()
        return res.json()["access_token"]


async def create_meeting(topic: str, start_time: str, duration: int = 30) -> dict:
    """
    Creates a scheduled Zoom meeting.
    Returns Zoom response — use ["id"] and ["join_url"].
    """
    token = await _get_access_token()

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{ZOOM_API_BASE}/users/me/meetings",
            json={
                "topic":      topic,
                "type":       2,
                "start_time": start_time,
                "duration":   duration,
                "timezone":   "Asia/Singapore",
                "settings": {
                    "host_video":       True,
                    "participant_video": True,
                    "waiting_room":      True,
                    "join_before_host":  False,
                    "auto_recording":    "none"
                }
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        if not res.is_success:
            print("Zoom Error:", res.text)
        res.raise_for_status()
        return res.json()


async def delete_meeting(meeting_id: str) -> None:
    """
    Deletes a Zoom meeting by ID.
    404 treated as success (already deleted).
    """
    token = await _get_access_token()

    async with httpx.AsyncClient() as client:
        res = await client.delete(
            f"{ZOOM_API_BASE}/meetings/{meeting_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if res.status_code not in (204, 404):
            res.raise_for_status()
