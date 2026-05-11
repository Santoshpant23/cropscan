from datetime import UTC, datetime

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pymongo.collection import Collection

from app.database import get_users_collection_dependency
from app.security import decode_access_token_payload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> dict:
    payload = decode_access_token_payload(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    token_version = _token_version(payload.get("token_version"))
    current_token_version = int(user.get("token_version") or 0)
    if token_version != current_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired after password change. Please log in again.",
        )
    password_changed_at = _as_aware_utc(user.get("password_changed_at"))
    if password_changed_at is not None:
        issued_at = _token_issued_at(payload.get("iat"))
        if issued_at is None or issued_at < password_changed_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired after password change. Please log in again.",
            )
    return user


def _as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _token_issued_at(value: object) -> datetime | None:
    if isinstance(value, int | float):
        return datetime.fromtimestamp(float(value), UTC)
    if isinstance(value, datetime):
        return _as_aware_utc(value)
    return None


def _token_version(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return -1
