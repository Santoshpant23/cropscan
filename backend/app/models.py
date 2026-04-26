from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="Smallholder farmer", max_length=80)
    location: str = Field(default="Knox County, TN", max_length=120)
    is_verified: bool = Field(default=False)
    verification_code: str | None = Field(default=None)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    email: EmailStr | None = None
    role: str | None = Field(default=None, max_length=80)
    location: str | None = Field(default=None, max_length=120)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str = Field(alias="_id")
    full_name: str
    email: EmailStr
    role: str = "Smallholder farmer"
    location: str = "Knox County, TN"
    is_verified: bool 
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
