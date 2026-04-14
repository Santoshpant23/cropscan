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
    model_dir: str = Field("models", alias="MODEL_DIR")
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
