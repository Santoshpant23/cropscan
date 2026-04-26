from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

conf = ConnectionConfig(
    MAIL_USERNAME="cropscan.tech@gmail.com",
    MAIL_PASSWORD="cqgeneoxfsothpcj", 
    MAIL_FROM="cropscan.tech@gmail.com",
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
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