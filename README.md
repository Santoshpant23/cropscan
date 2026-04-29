# CropScan

CropScan is a full-stack crop disease diagnosis app. A user signs in, uploads or captures a leaf photo, receives predictions from two PyTorch image classifiers, reviews AI-generated treatment guidance, and can ask follow-up questions about the diagnosis.

The app is built for smallholder farmers, backyard growers, and agricultural extension-style field work.

## Features

- Account signup, login, profile editing, and protected routes
- Leaf image upload and browser camera capture
- Dual-model prediction with EfficientNet-B0 and MobileNetV2
- 38 PlantVillage disease and healthy classes
- Low-confidence fallback behavior
- Image suitability check before disease inference
- Gemini-backed recommendation summary
- Diagnosis follow-up chat with a 10-question limit per scan
- Product-category and supply-plan recommendations
- Saved scan history and field notes
- Docker setup for one-command local runs
- Vercel frontend and Render backend deployment path

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | FastAPI, Pydantic, PyMongo, JWT auth |
| AI / ML | PyTorch, torchvision, EfficientNet-B0, MobileNetV2, Gemini |
| Database | MongoDB Atlas or any MongoDB-compatible database |
| Local containers | Docker Compose |
| Deployment | Vercel frontend, Render backend |

## Repository Structure

```text
backend/    FastAPI API, auth, MongoDB access, model loading, prediction, Gemini
cropscan/   React frontend
notebooks/  model training and experimentation notebooks
```

## Required Accounts And Files

You need:

- MongoDB connection string
- JWT secret
- Gemini API key if you want AI recommendations and chat
- model files in `backend/models`

Required model files:

```text
backend/models/efficientnet_b0_cropscan.pth
backend/models/mobilenetv2_cropscan.pth
```

If the model files are missing, the upload endpoint will fail when it tries to load the classifiers.

## Environment Files

Use local `.env` files. Do not commit real secrets.

Create:

```text
backend/.env
cropscan/.env
```

The repo includes:

```text
backend/.env.example
cropscan/.env.example
```

### Backend `.env`

```env
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/cropscan
MONGODB_DB_NAME=cropscan
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_ORIGIN_REGEX=^https?://(localhost|127\.0\.0\.1)(:\d+)?$
MODEL_DIR=models
GEMINI_API_KEY=replace-with-your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash
```

For deployed production on Render, set:

```env
CORS_ORIGINS=https://cropscan.tech,https://www.cropscan.tech
```

### Frontend `.env`

For normal local development:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

For Vercel production:

```env
VITE_API_BASE_URL=/api/v1
```

Vercel uses `cropscan/vercel.json` to proxy `/api/v1/*` to the Render backend.

## Fastest Local Setup With Docker

This is the easiest path for teammates and demo reviewers.

### Windows PowerShell

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item cropscan\.env.example cropscan\.env
docker compose up --build
```

### macOS / Linux

```bash
cp backend/.env.example backend/.env
cp cropscan/.env.example cropscan/.env
docker compose up --build
```

Then open:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`

Stop containers:

```bash
docker compose down
```

Docker still requires valid values in `backend/.env`.

## Manual Local Setup

Use this path if you are developing without Docker.

### Prerequisites

- Python 3.11
- Node.js 18+ and npm
- MongoDB connection string

Python 3.11 is important because the backend uses PyTorch and torchvision.

## Backend Setup

### Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

### macOS

If `python3.11` is installed:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

If you use Homebrew:

```bash
brew install python@3.11
```

Then rerun the setup above.

### Linux

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

On Ubuntu/Debian, if Python 3.11 venv support is missing:

```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3.11-dev
```

Backend URLs:

- API root: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Frontend Setup

Open a second terminal from the project root.

### Windows PowerShell

```powershell
cd cropscan
npm install
Copy-Item .env.example .env
npm run dev
```

### macOS / Linux

```bash
cd cropscan
npm install
cp .env.example .env
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:5173
```

If Vite chooses another port, add that origin to `backend/.env` under `CORS_ORIGINS` or rely on the existing local CORS regex.

## Using The App Locally

1. Start the backend.
2. Start the frontend.
3. Open the frontend URL.
4. Create an account or log in.
5. Go to the scan page.
6. Upload a leaf image or use camera capture.
7. Review both model predictions.
8. Review the recommendation and supply plan.
9. Ask follow-up questions in chat.
10. Open the dashboard to review saved history.

## API Summary

Main routes:

- `GET /health`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/me`
- `POST /api/v1/auth/change-password`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/upload`
- `POST /api/v1/chat`
- `POST /upload`
- `POST /chat`

Protected routes require:

```text
Authorization: Bearer <token>
```

Note: the forgot-password route is currently not exposed in the login UI because the reset flow still needs a secure OTP or signed-token implementation.

## Verification Commands

### Frontend

```bash
cd cropscan
npm run lint
npm run build
```

### Backend

Windows PowerShell:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest tests
python -m compileall app
```

macOS / Linux:

```bash
cd backend
source .venv/bin/activate
python -m pytest tests
python -m compileall app
```

### Docker

```bash
docker compose build
docker compose up
```

## Deployment

Production is split across Vercel and Render:

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- Domain: `cropscan.tech`

### Render Backend

Create a Render Web Service from the repo.

Use:

```text
Root Directory: backend
Environment: Docker
Branch: master
Health Check Path: /health
```

Set backend environment variables in the Render dashboard, not in Git.

Production CORS:

```env
CORS_ORIGINS=https://cropscan.tech,https://www.cropscan.tech
```

### Vercel Frontend

Create a Vercel project from the same repo.

Use:

```text
Root Directory: cropscan
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Production Branch: master
```

Set:

```env
VITE_API_BASE_URL=/api/v1
```

The file `cropscan/vercel.json` forwards `/api/v1/*` requests to the Render backend and sends client-side routes back to the React app.

### DNS

Point `cropscan.tech` and `www.cropscan.tech` to Vercel using the records shown in the Vercel dashboard. Use Vercel's displayed DNS values because they are the source of truth for the project.

## Common Problems

### `py -3.11` or `python3.11` is not found

Install Python 3.11 and recreate the backend virtual environment.

### Upload fails when models load

Confirm both model files exist in `backend/models`.

### Frontend cannot reach backend locally

Check:

- backend is running
- frontend `.env` uses `http://127.0.0.1:8000/api/v1`
- backend `.env` includes the frontend origin or local CORS regex
- backend was restarted after `.env` changes

### Production CORS error

Check Render:

```env
CORS_ORIGINS=https://cropscan.tech,https://www.cropscan.tech
```

Check Vercel:

```env
VITE_API_BASE_URL=/api/v1
```

Then redeploy both services.

### Render is slow on first request

Free Render services can sleep after inactivity. The first request may take longer while the service wakes and loads the PyTorch models.

## Team Workflow

Use feature branches for active work, merge into `develop` after verification, then promote to `master` for deployment.

```text
feature branch -> develop -> master
```

Run frontend and backend checks before merging into `master`.
