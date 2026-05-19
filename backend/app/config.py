from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CropScan Backend"
    environment: str = Field("development", alias="ENVIRONMENT")
    api_prefix: str = "/api/v1"
    mongodb_url: str = Field(..., alias="MONGODB_URL")
    mongodb_db_name: str = Field("cropscan", alias="MONGODB_DB_NAME")
    jwt_secret_key: str = Field(..., min_length=32, alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        60, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )
    prediction_token_expire_minutes: int = Field(
        30, alias="PREDICTION_TOKEN_EXPIRE_MINUTES"
    )
    cors_origins: str = Field(
        "http://localhost:5173,http://127.0.0.1:5173", alias="CORS_ORIGINS"
    )
    cors_origin_regex: str = Field(
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        alias="CORS_ORIGIN_REGEX",
    )
    model_dir: str = Field("models", alias="MODEL_DIR")
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.5-flash", alias="GEMINI_MODEL")
    gemini_use_vertex: bool = Field(False, alias="GEMINI_USE_VERTEX")
    google_cloud_project: str | None = Field(
        default=None, alias="GOOGLE_CLOUD_PROJECT"
    )
    google_cloud_location: str = Field(
        "us-central1", alias="GOOGLE_CLOUD_LOCATION"
    )
    resend_api_key: str | None = Field(default=None, alias="RESEND_API_KEY")
    resend_from_email: str | None = Field(default=None, alias="RESEND_FROM_EMAIL")
    app_base_url: str = Field("http://localhost:5173", alias="APP_BASE_URL")
    password_reset_otp_expire_minutes: int = Field(
        10, alias="PASSWORD_RESET_OTP_EXPIRE_MINUTES"
    )
    email_debug_otp: bool = Field(False, alias="EMAIL_DEBUG_OTP")
    rate_limit_enabled: bool = Field(True, alias="RATE_LIMIT_ENABLED")
    rate_limit_storage_uri: str | None = Field(
        default=None, alias="RATE_LIMIT_STORAGE_URI"
    )
    trust_proxy_headers: bool = Field(False, alias="TRUST_PROXY_HEADERS")
    password_reset_response_delay_seconds: float = Field(
        0.3, alias="PASSWORD_RESET_RESPONSE_DELAY_SECONDS"
    )
    password_reset_max_attempts: int = Field(5, alias="PASSWORD_RESET_MAX_ATTEMPTS")
    password_reset_lockout_minutes: int = Field(
        60, alias="PASSWORD_RESET_LOCKOUT_MINUTES"
    )
    max_scans_per_user: int = Field(2000, alias="MAX_SCANS_PER_USER")
    max_plots_per_user: int = Field(50, alias="MAX_PLOTS_PER_USER")
    skip_db_init: bool = Field(False, alias="SKIP_DB_INIT")
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(
        default=None, alias="AWS_SECRET_ACCESS_KEY"
    )
    aws_region: str | None = Field(default=None, alias="AWS_REGION")
    s3_bucket_name: str | None = Field(default=None, alias="S3_BUCKET_NAME")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
