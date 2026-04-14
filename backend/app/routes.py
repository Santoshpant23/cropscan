from datetime import UTC, datetime

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
)
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_user(user: dict) -> UserResponse:
    serialized_user = {**user, "_id": str(user["_id"])}
    return UserResponse.model_validate(serialized_user)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(
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

    return TokenResponse(access_token=create_access_token(str(result.inserted_id)))


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
