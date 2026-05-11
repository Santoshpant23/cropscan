import html as html_lib
import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails"


class EmailDeliveryError(RuntimeError):
    """Raised when a configured email provider rejects or fails a send."""


async def _send_email(*, to_email: str, subject: str, html: str, text: str) -> bool:
    settings = get_settings()
    if not settings.resend_api_key or not settings.resend_from_email:
        logger.info("Email skipped because Resend is not configured.")
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                RESEND_EMAIL_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.resend_from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                    "text": text,
                },
            )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise EmailDeliveryError("Email provider could not send the message.") from exc

    return True


async def send_welcome_email(*, to_email: str, full_name: str) -> bool:
    raw_first_name = full_name.strip().split(" ")[0] if full_name.strip() else "there"
    first_name = html_lib.escape(raw_first_name)
    app_url = html_lib.escape(get_settings().app_base_url.rstrip("/"), quote=True)
    return await _send_email(
        to_email=to_email,
        subject="Welcome to CropScan",
        html=f"""
        <p>Hi {first_name},</p>
        <p>Welcome to CropScan. You can now scan crop leaves, compare model predictions, and save diagnosis history.</p>
        <p><a href="{app_url}/scan">Open CropScan</a></p>
        """.strip(),
        text=(
            f"Hi {first_name}, welcome to CropScan. You can scan crop leaves, "
            f"compare model predictions, and save diagnosis history at {app_url}/scan."
        ),
    )


async def send_password_reset_otp(*, to_email: str, otp_code: str) -> bool:
    expire_minutes = get_settings().password_reset_otp_expire_minutes
    escaped_otp = html_lib.escape(otp_code)
    return await _send_email(
        to_email=to_email,
        subject="Your CropScan password reset code",
        html=f"""
        <p>Your CropScan password reset code is:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:4px">{escaped_otp}</p>
        <p>This code expires in {expire_minutes} minutes. If you did not request it, you can ignore this email.</p>
        """.strip(),
        text=(
            f"Your CropScan password reset code is {otp_code}. "
            f"This code expires in {expire_minutes} minutes."
        ),
    )
