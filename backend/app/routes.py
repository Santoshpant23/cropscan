from fastapi import BackgroundTasks
from .email import send_welcome_email  # Make sure this matches your file structure!
import random
import string
from datetime import UTC, datetime
from fastapi import BackgroundTasks
from app.email import send_verification_email
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from app.database import get_users_collection_dependency
from app.dependencies import get_current_user
from app.models import (
    PasswordChange,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    VerifyEmailRequest,
)
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_user(user: dict) -> UserResponse:
    serialized_user = {**user, "_id": str(user["_id"])}
    return UserResponse.model_validate(serialized_user)


def generate_verification_code():
    return ''.join(random.choices(string.digits, k=6))

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(
    payload: UserCreate,
    background_tasks: BackgroundTasks,
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> dict:
    now = datetime.now(UTC)
    verification_code = generate_verification_code()

    user_document = {
        "full_name": payload.full_name.strip(),
        "email": payload.email.lower(),
        "role": payload.role.strip(),
        "location": payload.location.strip(),
        "password_hash": hash_password(payload.password),
        "is_verified": False,
        "verification_code": verification_code,
        "created_at": now,
        "updated_at": now,
    }
    try:
        users_collection.insert_one(user_document)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc

    background_tasks.add_task(send_verification_email, payload.email.lower(), verification_code)

    return {
        "message": "User created. Please check your email for the verification code.",
        "email": payload.email.lower()
    }

@router.post("/verify", response_model=TokenResponse)
def verify_email(
    payload: VerifyEmailRequest,
    background_tasks: BackgroundTasks, 
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> TokenResponse:
    user = users_collection.find_one({"email": payload.email.lower()})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.get("is_verified"):
        raise HTTPException(status_code=400, detail="Email is already verified")

    if user.get("verification_code") != payload.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

  
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "is_verified": True,
                "verification_code": None,
                "updated_at": datetime.now(UTC)
            }
        }
    )
    user_name = user.get("full_name", user.get("name", "there"))
    background_tasks.add_task(send_welcome_email, user["email"], user_name)

    return TokenResponse(access_token=create_access_token(str(user["_id"])))

@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLogin,
    users_collection: Collection = Depends(get_users_collection_dependency),
) -> TokenResponse:
    user = users_collection.find_one({"email": payload.email.lower()})
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    return TokenResponse(access_token=create_access_token(str(user["_id"])))


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
def change_password(
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
                "updated_at": datetime.now(UTC),
            }
        },
    )
    return {"message": "Password updated successfully."}
