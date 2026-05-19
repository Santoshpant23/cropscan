from datetime import datetime
from typing import Any
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


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


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetRequestResponse(BaseModel):
    message: str
    debug_otp: str | None = Field(default=None, alias="debugOtp")

    model_config = ConfigDict(populate_by_name=True)


class PasswordResetConfirm(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
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


class ProductRecommendation(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    category: str = Field(min_length=3, max_length=80)
    priority: Literal["essential", "helpful", "monitoring"]
    use_case: str = Field(min_length=10, max_length=180, alias="useCase")
    timing: str = Field(min_length=5, max_length=120)
    buyer_note: str = Field(min_length=10, max_length=180, alias="buyerNote")
    caution: str = Field(min_length=10, max_length=180)

    model_config = ConfigDict(populate_by_name=True)


class RecommendationDetails(BaseModel):
    headline: str = Field(min_length=4, max_length=120)
    urgency: Literal["low", "medium", "high"]
    overview: str = Field(min_length=20, max_length=600)
    immediate_steps: list[str] = Field(default_factory=list, alias="immediateSteps")
    product_categories: list[str] = Field(
        default_factory=list, alias="productCategories"
    )
    product_recommendations: list[ProductRecommendation] = Field(
        default_factory=list, alias="productRecommendations"
    )
    cautions: list[str] = Field(default_factory=list)
    follow_up: str = Field(min_length=20, max_length=400, alias="followUp")

    model_config = ConfigDict(populate_by_name=True)


class DiagnosisPrediction(BaseModel):
    model_name: str = Field(alias="modelName")
    crop: str
    disease: str
    class_name: str | None = Field(default=None, alias="className")
    raw_disease_label: str | None = Field(default=None, alias="rawDiseaseLabel")
    disease_friendly_name: str | None = Field(
        default=None, alias="diseaseFriendlyName", max_length=80
    )
    disease_explanation: str | None = Field(
        default=None, alias="diseaseExplanation", max_length=160
    )
    confidence_percent: float = Field(alias="confidencePercent", ge=0, le=100)

    model_config = ConfigDict(populate_by_name=True)


class DiagnosisChatAnalysis(BaseModel):
    crop_type: str = Field(alias="cropType", min_length=1, max_length=120)
    condition: str = Field(min_length=1, max_length=160)
    confidence_percent: float = Field(alias="confidencePercent", ge=0, le=100)
    status: Literal["High confidence", "Review needed"]
    recommendation: str = Field(min_length=20, max_length=800)
    recommendation_details: RecommendationDetails = Field(alias="recommendationDetails")
    predictions: list[DiagnosisPrediction] = Field(default_factory=list, max_length=9)

    model_config = ConfigDict(populate_by_name=True)


class DiagnosisChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1500)


class DiagnosisChatRequest(BaseModel):
    analysis: DiagnosisChatAnalysis
    messages: list[DiagnosisChatMessage] = Field(default_factory=list, max_length=24)
    message: str = Field(min_length=1, max_length=1500)


class DiagnosisChatResponse(BaseModel):
    answer: str = Field(min_length=1, max_length=2000)


class PersistedThresholds(BaseModel):
    maxProbMin: float = Field(ge=0, le=1)
    marginMin: float = Field(ge=0, le=1)
    entropyMax: float = Field(ge=0)


class PersistedTopPrediction(BaseModel):
    className: str = Field(min_length=1, max_length=160)
    rawDiseaseLabel: str | None = Field(default=None, max_length=160)
    crop: str = Field(min_length=1, max_length=120)
    disease: str = Field(min_length=1, max_length=160)
    diseaseFriendlyName: str | None = Field(default=None, max_length=80)
    diseaseExplanation: str | None = Field(default=None, max_length=160)
    confidence: float = Field(ge=0, le=100)


class PersistedPrediction(BaseModel):
    modelName: str = Field(min_length=1, max_length=120)
    crop: str = Field(min_length=1, max_length=120)
    disease: str = Field(min_length=1, max_length=160)
    diseaseFriendlyName: str | None = Field(default=None, max_length=80)
    diseaseExplanation: str | None = Field(default=None, max_length=160)
    confidence: float = Field(ge=0, le=100)
    className: str | None = Field(default=None, max_length=160)
    rawDiseaseLabel: str | None = Field(default=None, max_length=160)
    confidenceMargin: float | None = Field(default=None, ge=0)
    entropy: float | None = Field(default=None, ge=0)
    temperature: float | None = Field(default=None, gt=0)
    thresholds: PersistedThresholds | None = None
    topK: list[PersistedTopPrediction] = Field(default_factory=list, max_length=3)
    photoIndex: int | None = Field(default=None, ge=1, le=3)
    photoFileName: str | None = Field(default=None, max_length=255)


class ScanCreate(BaseModel):
    predictionToken: str = Field(min_length=20)
    fileName: str = Field(min_length=1, max_length=255)
    imageDataUrl: str = Field(min_length=1, max_length=1_000_000)
    photoDataUrls: list[str] = Field(default_factory=list, max_length=3)
    plotId: str | None = Field(default=None, max_length=64)
    plotName: str | None = Field(default=None, max_length=100)
    scanLocationLabel: str | None = Field(default=None, max_length=180)
    photoCount: int = Field(default=1, ge=1, le=3)
    cropType: str | None = Field(default=None, max_length=120)
    condition: str | None = Field(default=None, max_length=160)
    rawDiseaseLabel: str | None = Field(default=None, max_length=160)
    diseaseFriendlyName: str | None = Field(default=None, max_length=80)
    diseaseExplanation: str | None = Field(default=None, max_length=160)
    confidencePercent: float | None = Field(default=None, ge=0, le=100)
    status: Literal["High confidence", "Review needed"] | None = None
    diagnosisState: Literal[
        "confident", "uncertain_need_more_photos", "out_of_scope"
    ] | None = None
    diagnosisStateLabel: str | None = Field(default=None, max_length=120)
    diagnosisReason: str | None = Field(default=None, max_length=500)
    recommendation: str = Field(default="", max_length=3000)
    recommendationDetails: dict[str, Any] | None = None
    predictions: list[PersistedPrediction] = Field(default_factory=list, max_length=9)
    photoResults: list[dict[str, Any]] = Field(default_factory=list, max_length=3)
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def validate_thumbnail_set(self) -> "ScanCreate":
        thumbnail_count = len(self.photoDataUrls) if self.photoDataUrls else 1
        if thumbnail_count != self.photoCount:
            raise ValueError("Photo count does not match the saved thumbnail set.")
        for data_url in self.photoDataUrls or [self.imageDataUrl]:
            if len(data_url) > 1_000_000:
                raise ValueError("Saved preview image is too large.")
        return self


class ScanUpdate(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)
    status: Literal["High confidence", "Review needed"] | None = None
    reviewed: bool | None = None


class ScanFeedback(BaseModel):
    accurate: bool
    consented_for_training: bool = False


class ScanResponse(BaseModel):
    id: str
    userEmail: EmailStr
    fileName: str
    imageDataUrl: str
    photoDataUrls: list[str] = Field(default_factory=list)
    photoCount: int = Field(default=1, ge=1, le=3)
    plotId: str | None = None
    plotName: str | None = None
    scanLocationLabel: str | None = None
    cropType: str | None = None
    condition: str | None = None
    rawDiseaseLabel: str | None = None
    diseaseFriendlyName: str | None = None
    diseaseExplanation: str | None = None
    confidencePercent: float | None = Field(default=None, ge=0, le=100)
    status: Literal["High confidence", "Review needed"]
    diagnosisState: Literal[
        "confident", "uncertain_need_more_photos", "out_of_scope"
    ] | None = None
    diagnosisStateLabel: str | None = None
    diagnosisReason: str | None = None
    recommendation: str
    recommendationDetails: dict[str, Any] | None = None
    predictions: list[PersistedPrediction] = Field(default_factory=list)
    photoResults: list[dict[str, Any]] = Field(default_factory=list)
    notes: str = ""
    accurate: bool | None = None
    consented_for_training: bool = False
    image_url: str | None = None
    reviewedAt: datetime | None = None
    createdAt: datetime
    updatedAt: datetime


class PlotCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    crop: str = Field(min_length=2, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    areaSqFt: float = Field(default=100, ge=1, le=10_000_000)
    locationLabel: str | None = Field(default=None, max_length=180)
    locationSource: Literal["gps", "address", "manual"] = "manual"
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def reject_null_island(self) -> "PlotCreate":
        if abs(self.latitude) < 0.0001 and abs(self.longitude) < 0.0001:
            raise ValueError("Use a real plot location, not 0,0.")
        return self


class PlotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    crop: str | None = Field(default=None, min_length=2, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    areaSqFt: float | None = Field(default=None, ge=1, le=10_000_000)
    locationLabel: str | None = Field(default=None, max_length=180)
    locationSource: Literal["gps", "address", "manual"] | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def reject_null_island_update(self) -> "PlotUpdate":
        if self.latitude is None or self.longitude is None:
            return self
        if abs(self.latitude) < 0.0001 and abs(self.longitude) < 0.0001:
            raise ValueError("Use a real plot location, not 0,0.")
        return self


class PlotResponse(PlotCreate):
    id: str
    userEmail: EmailStr
    createdAt: datetime
    updatedAt: datetime


class PlotTodaySignals(BaseModel):
    tonightLowF: float | None = None
    todayHighF: float | None = None
    frostProbability: float = Field(ge=0, le=1)
    nextRainInches: float = Field(ge=0)
    rainProbability: float = Field(ge=0, le=1)
    heatStress: bool = False
    droughtPressure: bool = False
    source: str = "seasonal fallback"


class PlotTodayResponse(BaseModel):
    plotId: str
    plotName: str
    crop: str
    headline: str
    riskLevel: Literal["low", "medium", "high"]
    icon: str
    actions: list[str] = Field(default_factory=list, max_length=5)
    signals: PlotTodaySignals
    generatedAt: datetime
