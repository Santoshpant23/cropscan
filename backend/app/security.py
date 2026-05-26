from datetime import UTC, datetime, timedelta
import json

import jwt
from fastapi import HTTPException, status
from pwdlib import PasswordHash

from app.config import get_settings

password_hash = PasswordHash.recommended()
JWT_SIGNING_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, password_hash_value: str) -> bool:
    return password_hash.verify(password, password_hash_value)


def create_access_token(subject: str, token_version: int = 0) -> str:
    settings = get_settings()
    issued_at = datetime.now(UTC)
    expire_at = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": subject,
        "iat": issued_at,
        "exp": expire_at,
        "token_version": token_version,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=JWT_SIGNING_ALGORITHM,
    )


def create_prediction_token(subject: str, result: dict) -> str:
    settings = get_settings()
    expire_at = datetime.now(UTC) + timedelta(
        minutes=settings.prediction_token_expire_minutes
    )
    payload = {
        "sub": subject,
        "purpose": "scan_prediction",
        "result": result,
        "exp": expire_at,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=JWT_SIGNING_ALGORITHM,
    )


def decode_prediction_token(token: str, subject: str) -> dict:
    settings = get_settings()
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="The scan result expired. Run the scan again before saving.",
    )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[JWT_SIGNING_ALGORITHM],
        )
    except jwt.PyJWTError as exc:
        raise unauthorized from exc

    if payload.get("sub") != subject or payload.get("purpose") != "scan_prediction":
        raise unauthorized

    result = payload.get("result")
    if not isinstance(result, dict):
        raise unauthorized

    # Make sure the embedded result is JSON-compatible before it is persisted.
    json.dumps(result, sort_keys=True)
    return result


def decode_access_token(token: str) -> str:
    payload = decode_access_token_payload(token)
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
    return subject


def decode_access_token_payload(token: str) -> dict:
    settings = get_settings()
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
    )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[JWT_SIGNING_ALGORITHM],
            options={"require": ["exp"]},
        )
    except jwt.PyJWTError as exc:
        raise unauthorized from exc
    # Access tokens never carry a "purpose" claim. Scan-result (prediction)
    # tokens are signed with the same key but set purpose="scan_prediction";
    # reject anything carrying a purpose so a short-lived prediction token
    # cannot be replayed as a full session credential.
    if payload.get("purpose") is not None:
        raise unauthorized
    return payload
