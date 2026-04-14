# CropScan Backend

FastAPI backend for authentication and profile management.

## Setup

1. Create a virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
3. Create `.env` from `.env.example` and set your MongoDB URL and JWT secret.
4. Run the API:
   ```powershell
   uvicorn app.main:app --reload
   ```

## Endpoints

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- `GET /health`

## Postman

Use `Authorization: Bearer <token>` for protected routes.

### Signup

`POST /api/v1/auth/signup`

```json
{
  "full_name": "Diara User",
  "email": "diara@example.com",
  "password": "StrongPass123"
}
```

### Login

`POST /api/v1/auth/login`

```json
{
  "email": "diara@example.com",
  "password": "StrongPass123"
}
```

### Update profile

`PATCH /api/v1/auth/me`

```json
{
  "full_name": "Diara Updated",
  "email": "new@example.com"
}
```

### Change password

`POST /api/v1/auth/change-password`

```json
{
  "current_password": "StrongPass123",
  "new_password": "EvenStronger456"
}
```
