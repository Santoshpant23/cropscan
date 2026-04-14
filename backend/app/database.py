from collections.abc import Generator

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from app.config import get_settings

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = MongoClient(settings.mongodb_url)
    return _client


def get_database() -> Database:
    settings = get_settings()
    return get_client()[settings.mongodb_db_name]


def get_users_collection() -> Collection:
    return get_database()["users"]


def get_users_collection_dependency() -> Generator[Collection, None, None]:
    yield get_users_collection()


def ensure_indexes() -> None:
    get_users_collection().create_index("email", unique=True)
