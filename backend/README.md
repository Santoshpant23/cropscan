# CropScan Backend

FastAPI backend for authentication, profile management, and crop disease prediction.

For full project setup, see the root `README.md`.

## Runtime

Use Python 3.11 for the backend. PyTorch and torchvision are the version-sensitive dependencies, so everyone should use the same Python version.

## Setup

Windows:

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

Mac/Linux:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Then edit `.env` with your MongoDB URL and JWT secret.

All commands in this file assume you are running them from inside the `backend` directory.

## Required Model Files

The prediction endpoint expects these files:

```text
backend/models/efficientnet_b0_cropscan.pth
backend/models/mobilenetv2_cropscan.pth
```

`MODEL_DIR=models` in `.env` points to that folder.

## Environment Variables

```env
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/cropscan
MONGODB_DB_NAME=cropscan
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MODEL_DIR=models
```

## Endpoints

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- `POST /api/v1/upload`
- `POST /upload`
- `GET /health`

Use `Authorization: Bearer <token>` for protected routes, including upload.

`POST /upload` is kept as a compatibility route. The main frontend uses `POST /api/v1/upload`.

## Verification

```powershell
python -m pytest tests
python -m compileall app
```

## Example Payloads

Signup:

```json
{
  "full_name": "CropScan User",
  "email": "farmer@example.com",
  "password": "StrongPass123",
  "role": "Smallholder farmer",
  "location": "Knox County, TN"
}
```

Login:

```json
{
  "email": "farmer@example.com",
  "password": "StrongPass123"
}
```

Update profile:

```json
{
  "full_name": "Updated User",
  "email": "updated@example.com",
  "role": "Extension agent",
  "location": "Knox County, TN"
}
```

Upload:

```text
POST /api/v1/upload
Content-Type: multipart/form-data
file=<leaf image>
```
