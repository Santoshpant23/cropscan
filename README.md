# CropScan

CropScan is a web application for crop disease diagnosis from a leaf image. A user signs in, uploads a photo, and receives predictions from two trained image classification models:

- EfficientNet-B0
- MobileNetV2

The application includes:

- account creation and login
- protected image upload
- dual-model prediction results
- AI-generated treatment recommendations
- diagnosis follow-up chat
- saved scan history
- basic profile management

The frontend is built with React and Vite. The backend is built with FastAPI, MongoDB, JWT authentication, and PyTorch.

## Repository Structure

```text
backend/    FastAPI API, authentication, model loading, prediction logic
cropscan/   React frontend
notebooks/  training and experimentation notebooks
```

## What You Need Before Running

Install these tools first:

- Python 3.11
- Node.js 18+ and npm
- Access to a MongoDB database

Why Python 3.11 matters:

The backend depends on PyTorch and torchvision. Those packages are more predictable when the whole team uses the same Python version. Use Python 3.11 for the backend setup.

## Required Files Already in This Repo

The backend prediction flow expects these model files:

```text
backend/models/efficientnet_b0_cropscan.pth
backend/models/mobilenetv2_cropscan.pth
```

If those files are missing, the upload endpoint will fail when it tries to load the models.

## Environment Variables

Use local `.env` files, not global system environment variables.

That means:

- create `backend/.env`
- create `cropscan/.env`

Do not commit those real `.env` files. The repo already includes `.env.example` templates for both apps.

### Backend Environment Variables

Copy:

```powershell
Copy-Item backend\.env.example backend\.env
```

Then edit `backend/.env`:

```env
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/cropscan
MONGODB_DB_NAME=cropscan
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MODEL_DIR=models
GEMINI_API_KEY=replace-with-your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

What each one does:

- `MONGODB_URL`: MongoDB connection string
- `MONGODB_DB_NAME`: database name
- `JWT_SECRET_KEY`: secret used to sign login tokens
- `JWT_ALGORITHM`: JWT algorithm, currently `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES`: token expiry window
- `CORS_ORIGINS`: frontend origins allowed to call the backend
- `MODEL_DIR`: folder containing the saved `.pth` model files
- `GEMINI_API_KEY`: key used for AI-generated recommendations and diagnosis chat
- `GEMINI_MODEL`: Gemini model name used by the backend

### Frontend Environment Variables

Copy:

```powershell
Copy-Item cropscan\.env.example cropscan\.env
```

Then edit `cropscan/.env` if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Use the default value if the backend is running locally on port `8000`.

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

### 2. Set Up the Backend

Open a terminal in the project root, then run:

### Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Then edit `backend/.env` with your real values.

Start the backend:

```powershell
uvicorn app.main:app --reload
```

Backend URLs:

- API base: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### Mac/Linux

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Then edit `backend/.env` and run:

```bash
uvicorn app.main:app --reload
```

### 3. Set Up the Frontend

Open a second terminal in the project root, then run:

### Windows PowerShell

```powershell
cd cropscan
npm install
Copy-Item .env.example .env
npm run dev
```

### Mac/Linux

```bash
cd cropscan
npm install
cp .env.example .env
npm run dev
```

Frontend URL:

- `http://127.0.0.1:5173`

### 4. Use the App

Once both servers are running:

1. Open the frontend in the browser.
2. Create an account.
3. Log in.
4. Go to the scan page.
5. Upload a leaf image.
6. Review the prediction result from both models.
7. Review the AI-generated recommendation and ask follow-up questions in the diagnosis chat.
8. Check the dashboard to see saved scan history.

## API Summary

Main backend routes:

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- `POST /api/v1/upload`
- `POST /api/v1/chat`
- `POST /upload`
- `GET /health`

The upload endpoint is protected. You must be logged in and send the bearer token.

## Development Notes

- The frontend uses local route-level lazy loading for page chunks.
- Scan history is currently stored in browser local storage on the frontend.
- Authentication and user profile data are backed by MongoDB through the FastAPI API.
- The backend loads the saved PyTorch models directly from `backend/models`.
- AI recommendations and diagnosis chat use Gemini through the backend when `GEMINI_API_KEY` is set. The backend falls back to deterministic guidance if the Gemini call fails.

## Quick Verification Commands

### Frontend

```powershell
cd cropscan
npm run lint
npm run build
```

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest tests
python -m compileall app
```

## Common Problems

### 1. `py -3.11` is not found

Install Python 3.11, then rerun the backend setup.

### 2. Upload fails because model files are missing

Make sure these files exist:

```text
backend/models/efficientnet_b0_cropscan.pth
backend/models/mobilenetv2_cropscan.pth
```

### 3. Frontend cannot reach backend

Check:

- backend is running on port `8000`
- `cropscan/.env` points to `http://127.0.0.1:8000/api/v1`
- `backend/.env` includes the frontend origin in `CORS_ORIGINS`

### 4. Authentication fails

Check:

- `MONGODB_URL` is correct
- `JWT_SECRET_KEY` is set
- backend server restarted after `.env` changes

## Team Workflow Suggestion

Use feature branches for active work and merge into `develop` after verification. Keep `main` for the stable version only.

Typical flow:

```text
feature branch -> develop -> main
```

## Current Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router
- Backend: FastAPI, PyMongo, JWT, Pydantic Settings
- ML: PyTorch, torchvision, EfficientNet-B0, MobileNetV2
- Database: MongoDB
