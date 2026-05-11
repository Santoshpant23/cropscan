import asyncio
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import logging
import secrets
import time

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.database import get_users_collection_dependency
from app.dependencies import get_current_user
from app.email_service import (
    EmailDeliveryError,
    send_password_reset_otp,
    send_welcome_email,
)
from app.models import (
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from app.rate_limit import limiter
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

PASSWORD_RESET_MESSAGE = (
    "If an account exists for that email, a password reset code has been sent."
)


def serialize_user(user: dict) -> UserResponse:
    serialized_user = {**user, "_id": str(user["_id"])}
    return UserResponse.model_validate(serialized_user)


def _hash_otp(email: str, otp_code: str) -> str:
    settings = get_settings()
    message = f"{email.lower()}:{otp_code}".encode("utf-8")
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def _generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def _safe_send_welcome_email(*, to_email: str, full_name: str) -> None:
    try:
        await send_welcome_email(to_email=to_email, full_name=full_name)
    except EmailDeliveryError:
        logger.exception("Welcome email failed for a new signup.")


async def _safe_send_password_reset_otp(*, to_email: str, otp_code: str) -> None:
    try:
        await send_password_reset_otp(to_email=to_email, otp_code=otp_code)
    except EmailDeliveryError:
        logger.exception("Password reset email failed.")


def _as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


async def _generic_password_reset_response(
    *,
    started_at: float,
    debug_otp: str | None = None,
) -> PasswordResetRequestResponse:
    settings = get_settings()
    elapsed = time.perf_counter() - started_at
    delay_remaining = settings.password_reset_response_delay_seconds - elapsed
    if delay_remaining > 0:
        await asyncio.sleep(delay_remaining)
    return PasswordResetRequestResponse(
        message=PASSWORD_RESET_MESSAGE,
        debug_otp=debug_otp if settings.email_debug_otp else None,
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def signup(
    request: Request,
    background_tasks: BackgroundTasks,
    payload: UserCreate,
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> TokenResponse:
    now = datetime.now(UTC)
    user_document = {
        "full_name": payload.full_name.strip(),
        "email": payload.email.lower(),
        "role": payload.role.strip(),
        "location": payload.location.strip(),
        "password_hash": hash_password(payload.password),
        "token_version": 0,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = users_collection.insert_one(user_document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    background_tasks.add_task(
        _safe_send_welcome_email,
        to_email=user_document["email"],
        full_name=user_document["full_name"],
    )

    return TokenResponse(
        access_token=create_access_token(
            str(result.inserted_id),
            token_version=user_document["token_version"],
        )
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    payload: UserLogin,
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> TokenResponse:
    user = users_collection.find_one({"email": payload.email.lower()})
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    return TokenResponse(
        access_token=create_access_token(
            str(user["_id"]),
            token_version=int(user.get("token_version") or 0),
        )
    )


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return serialize_user(current_user)


@router.patch("/me", response_model=UserResponse)
def update_profile(
    payload: UserUpdate,
    current_user: dict = Depends(get_current_user),
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> UserResponse:
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update.",
        )

    if "full_name" in updates:
        updates["full_name"] = updates["full_name"].strip()
    if "email" in updates:
        updates["email"] = updates["email"].lower()

    updates["updated_at"] = datetime.now(UTC)

    try:
        users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": updates},
        )
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email is already in use.",
        ) from exc

    user = users_collection.find_one({"_id": current_user["_id"]})
    return serialize_user(user)


@router.post("/change-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    payload: PasswordChange,
    current_user: dict = Depends(get_current_user),
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> dict:
    if not verify_password(payload.current_password, current_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    password_changed_at = datetime.now(UTC).replace(microsecond=0)
    users_collection.update_one(
        {
            "_id": (
                ObjectId(current_user["_id"])
                if isinstance(current_user["_id"], str)
                else current_user["_id"]
            )
        },
        {
            "$set": {
                "password_hash": hash_password(payload.new_password),
                "password_changed_at": password_changed_at,
                "token_version": int(current_user.get("token_version") or 0) + 1,
                "updated_at": password_changed_at,
            }
        },
    )
    return {"message": "Password updated successfully."}


@router.post(
    "/forgot-password/request",
    response_model=PasswordResetRequestResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("3/minute")
async def request_password_reset(
    request: Request,
    background_tasks: BackgroundTasks,
    payload: PasswordResetRequest,
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> PasswordResetRequestResponse:
    started_at = time.perf_counter()
    settings = get_settings()
    email = payload.email.lower()
    user = users_collection.find_one({"email": email})
    if user is None:
        return await _generic_password_reset_response(started_at=started_at)

    lockout_until = _as_aware_utc(user.get("password_reset_locked_until"))
    now = datetime.now(UTC)
    if lockout_until and lockout_until > now:
        return await _generic_password_reset_response(started_at=started_at)

    otp_code = _generate_otp()
    expires_at = now + timedelta(
        minutes=settings.password_reset_otp_expire_minutes
    )
    reset_update = {
        "$set": {
            "password_reset": {
                "otp_hash": _hash_otp(email, otp_code),
                "expires_at": expires_at,
                "requested_at": now,
            },
            "updated_at": now,
        }
    }
    if lockout_until and lockout_until <= now:
        reset_update["$unset"] = {
            "password_reset_failed_attempts": "",
            "password_reset_locked_until": "",
        }

    users_collection.update_one(
        {"_id": user["_id"]},
        reset_update,
    )

    if settings.email_debug_otp:
        logger.warning("EMAIL_DEBUG_OTP is enabled. Do not use this in production.")
        return await _generic_password_reset_response(
            started_at=started_at,
            debug_otp=otp_code,
        )

    background_tasks.add_task(
        _safe_send_password_reset_otp,
        to_email=email,
        otp_code=otp_code,
    )
    return await _generic_password_reset_response(started_at=started_at)


@router.post("/forgot-password/confirm", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def confirm_password_reset(
    request: Request,
    payload: PasswordResetConfirm,
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> dict:
    email = payload.email.lower()
    user = users_collection.find_one({"email": email})
    unauthorized_reset = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired password reset code.",
    )
    if user is None:
        raise unauthorized_reset

    reset_state = user.get("password_reset") or {}
    expires_at = _as_aware_utc(reset_state.get("expires_at"))
    failed_attempts = int(user.get("password_reset_failed_attempts") or 0)
    lockout_until = _as_aware_utc(user.get("password_reset_locked_until"))
    now = datetime.now(UTC)
    if (
        not reset_state.get("otp_hash")
        or not expires_at
        or expires_at < now
        or (lockout_until and lockout_until > now)
        or failed_attempts >= get_settings().password_reset_max_attempts
    ):
        raise unauthorized_reset

    expected_hash = _hash_otp(email, payload.otp_code)
    if not hmac.compare_digest(expected_hash, reset_state["otp_hash"]):
        next_attempts = failed_attempts + 1
        lockout_update = {}
        if next_attempts >= get_settings().password_reset_max_attempts:
            lockout_update["password_reset_locked_until"] = datetime.now(UTC) + timedelta(
                minutes=get_settings().password_reset_lockout_minutes
            )

        users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password_reset_failed_attempts": next_attempts,
                    **lockout_update,
                    "updated_at": datetime.now(UTC),
                }
            },
        )
        raise unauthorized_reset

    password_changed_at = datetime.now(UTC).replace(microsecond=0)
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.new_password),
                "password_changed_at": password_changed_at,
                "token_version": int(user.get("token_version") or 0) + 1,
                "updated_at": password_changed_at,
            },
            "$unset": {
                "password_reset": "",
                "password_reset_failed_attempts": "",
                "password_reset_locked_until": "",
            },
        },
    )
    return {"message": "Password reset successfully."}


@router.post("/forgot-password", status_code=status.HTTP_410_GONE)
def forgot_password_disabled() -> dict:
    return {
        "message": (
            "This endpoint was removed. Use /auth/forgot-password/request and "
            "/auth/forgot-password/confirm."
        )
    }
