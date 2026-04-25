from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="Smallholder farmer", max_length=80)
    location: str = Field(default="Knox County, TN", max_length=120)


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
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class RecommendationDetails(BaseModel):
    headline: str = Field(min_length=4, max_length=120)
    urgency: Literal["low", "medium", "high"]
    overview: str = Field(min_length=20, max_length=600)
    immediate_steps: list[str] = Field(default_factory=list, alias="immediateSteps")
    product_categories: list[str] = Field(
        default_factory=list, alias="productCategories"
    )
    cautions: list[str] = Field(default_factory=list)
    follow_up: str = Field(min_length=20, max_length=400, alias="followUp")

    model_config = ConfigDict(populate_by_name=True)


class DiagnosisPrediction(BaseModel):
    model_name: str = Field(alias="modelName")
    crop: str
    disease: str
    class_name: str | None = Field(default=None, alias="className")
    confidence_percent: float = Field(alias="confidencePercent", ge=0, le=100)

    model_config = ConfigDict(populate_by_name=True)


class DiagnosisChatAnalysis(BaseModel):
    crop_type: str = Field(alias="cropType", min_length=1, max_length=120)
    condition: str = Field(min_length=1, max_length=160)
    confidence_percent: float = Field(alias="confidencePercent", ge=0, le=100)
    status: Literal["High confidence", "Review needed"]
    recommendation: str = Field(min_length=20, max_length=800)
    recommendation_details: RecommendationDetails = Field(alias="recommendationDetails")
    predictions: list[DiagnosisPrediction] = Field(min_length=1, max_length=2)

    model_config = ConfigDict(populate_by_name=True)


class DiagnosisChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1500)


class DiagnosisChatRequest(BaseModel):
    analysis: DiagnosisChatAnalysis
    messages: list[DiagnosisChatMessage] = Field(default_factory=list, max_length=12)
    message: str = Field(min_length=1, max_length=1500)


class DiagnosisChatResponse(BaseModel):
    answer: str = Field(min_length=1, max_length=2000)
