from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CropScan Backend"
    api_prefix: str = "/api/v1"
    mongodb_url: str = Field(..., alias="MONGODB_URL")
    mongodb_db_name: str = Field("cropscan", alias="MONGODB_DB_NAME")
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        60, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
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
    mail_username: str = Field("", alias="MAIL_USERNAME")
    mail_password: str = Field("", alias="MAIL_PASSWORD")
    mail_from: str = Field("cropscan.tech@gmail.com", alias="MAIL_FROM")
    mail_port: int = Field(587, alias="MAIL_PORT")
    mail_server: str = Field("smtp.gmail.com", alias="MAIL_SERVER")
    mail_starttls: bool = Field(True, alias="MAIL_STARTTLS")
    mail_ssl_tls: bool = Field(False, alias="MAIL_SSL_TLS")
    mail_use_credentials: bool = Field(True, alias="MAIL_USE_CREDENTIALS")
    mail_validate_certs: bool = Field(True, alias="MAIL_VALIDATE_CERTS")
    skip_db_init: bool = Field(False, alias="SKIP_DB_INIT")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
