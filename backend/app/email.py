from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from .config import get_settings

settings = get_settings()

conf = ConnectionConfig(
    MAIL_USERNAME=settings.mail_username,
    MAIL_PASSWORD=settings.mail_password,
    MAIL_FROM=settings.mail_from,
    MAIL_PORT=settings.mail_port,
    MAIL_SERVER=settings.mail_server,
    MAIL_STARTTLS=settings.mail_starttls,
    MAIL_SSL_TLS=settings.mail_ssl_tls,
    USE_CREDENTIALS=settings.mail_use_credentials,
    VALIDATE_CERTS=settings.mail_validate_certs,
)

async def send_verification_email(email_address: str, code: str):
    message = MessageSchema(
        subject="CropScan: Verify Your Email",
        recipients=[email_address],
        body=f"Your verification code for CropScan is: {code}",
        subtype="plain"
    )
    fm = FastMail(conf)
    await fm.send_message(message)


async def send_welcome_email(receiver_email: str, user_name: str):
    body = f"""Hi {user_name},
    
Welcome to CropScan! Your account has been successfully verified.
    
You can now log in to save your crop scans, review cases, and keep all your field notes in one place.
    
Happy scanning!
The CropScan Team"""
    
    message = MessageSchema(
        subject="Welcome to CropScan!",
        recipients=[receiver_email],
        body=body,
        subtype="plain"
    )
    
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        print(f"Welcome email sent successfully to {receiver_email}")
    except Exception as e:
        print(f"Failed to send welcome email: {e}")
