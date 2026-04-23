import os

from bson import ObjectId
from fastapi.testclient import TestClient

os.environ["SKIP_DB_INIT"] = "true"
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"

from app.database import get_users_collection_dependency
from app.main import app


class FakeInsertResult:
    def __init__(self, inserted_id: ObjectId):
        self.inserted_id = inserted_id


class FakeUsersCollection:
    def __init__(self) -> None:
        self.documents: dict[ObjectId, dict] = {}

    def create_index(self, *_args, **_kwargs) -> None:
        return None

    def insert_one(self, document: dict) -> FakeInsertResult:
        if self.find_one({"email": document["email"]}) is not None:
            from pymongo.errors import DuplicateKeyError

            raise DuplicateKeyError("duplicate email")
        inserted_id = ObjectId()
        saved = {**document, "_id": inserted_id}
        self.documents[inserted_id] = saved
        return FakeInsertResult(inserted_id)

    def find_one(self, filter_query: dict) -> dict | None:
        if "_id" in filter_query:
            lookup_id = filter_query["_id"]
            if isinstance(lookup_id, str):
                try:
                    lookup_id = ObjectId(lookup_id)
                except Exception:
                    return None
            return self.documents.get(lookup_id)
        if "email" in filter_query:
            for document in self.documents.values():
                if document["email"] == filter_query["email"]:
                    return document
        return None

    def update_one(self, filter_query: dict, update_query: dict) -> None:
        document = self.find_one(filter_query)
        if document is None:
            return None
        if "$set" in update_query and "email" in update_query["$set"]:
            new_email = update_query["$set"]["email"]
            existing = self.find_one({"email": new_email})
            if existing is not None and existing["_id"] != document["_id"]:
                from pymongo.errors import DuplicateKeyError

                raise DuplicateKeyError("duplicate email")
        document.update(update_query.get("$set", {}))
        self.documents[document["_id"]] = document
        return None
def build_client() -> tuple[TestClient, FakeUsersCollection]:
    fake_collection = FakeUsersCollection()

    def _override():
        yield fake_collection

    app.dependency_overrides[get_users_collection_dependency] = _override
    return TestClient(app), fake_collection


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_signup_login_profile_and_password_change_flow() -> None:
    client, fake_collection = build_client()

    signup_response = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": "Diara User",
            "email": "diara@example.com",
            "password": "StrongPass123",
        },
    )
    assert signup_response.status_code == 201
    signup_token = signup_response.json()["access_token"]

    me_response = client.get("/api/v1/auth/me", headers=auth_headers(signup_token))
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "diara@example.com"

    profile_response = client.patch(
        "/api/v1/auth/me",
        headers=auth_headers(signup_token),
        json={"full_name": "Diara Updated", "email": "new@example.com"},
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["full_name"] == "Diara Updated"
    assert profile_response.json()["email"] == "new@example.com"

    change_password_response = client.post(
        "/api/v1/auth/change-password",
        headers=auth_headers(signup_token),
        json={
            "current_password": "StrongPass123",
            "new_password": "EvenStronger456",
        },
    )
    assert change_password_response.status_code == 200

    old_login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "new@example.com", "password": "StrongPass123"},
    )
    assert old_login_response.status_code == 401

    new_login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "new@example.com", "password": "EvenStronger456"},
    )
    assert new_login_response.status_code == 200
    assert new_login_response.json()["token_type"] == "bearer"

    stored_user = next(iter(fake_collection.documents.values()))
    assert stored_user["password_hash"] != "EvenStronger456"


def test_signup_rejects_duplicate_email() -> None:
    client, _fake_collection = build_client()

    first_response = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": "First User",
            "email": "duplicate@example.com",
            "password": "StrongPass123",
        },
    )
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": "Second User",
            "email": "duplicate@example.com",
            "password": "StrongPass123",
        },
    )
    assert second_response.status_code == 409


def test_forgot_password_resets_password_for_existing_user() -> None:
    client, _fake_collection = build_client()

    signup_response = client.post(
        "/api/v1/auth/signup",
        json={
            "full_name": "Reset User",
            "email": "reset@example.com",
            "password": "StrongPass123",
        },
    )
    assert signup_response.status_code == 201

    reset_response = client.post(
        "/api/v1/auth/forgot-password",
        json={
            "email": "reset@example.com",
            "new_password": "UpdatedPass456",
        },
    )
    assert reset_response.status_code == 200

    old_login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "reset@example.com", "password": "StrongPass123"},
    )
    assert old_login_response.status_code == 401

    new_login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "reset@example.com", "password": "UpdatedPass456"},
    )
    assert new_login_response.status_code == 200
