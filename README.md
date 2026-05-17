# BedPlas Website

This repository contains a Flask API in `backend/` and a Vite + React frontend in `frontend/`.

## Local development

Run the backend directly from the `backend/` folder:

```bash
python app.py
```

Run the frontend directly from the `frontend/` folder:

```bash
npm install
npm run dev
```

The Vite dev server proxies requests from `/api` to `http://localhost:8000`, so the browser can talk to the backend without CORS issues while you work locally.

## Docker

Build and start the full stack with:

```bash
docker compose up --build
```

That starts:

- PostgreSQL on `localhost:5432`
- Flask API on `localhost:8000`
- Frontend on `http://localhost:8080`

The frontend container serves the built React app through Nginx and proxies `/api` to the backend container.

## Configuration

Copy `backend/.env.example` to `backend/.env` if you want to run the Flask app with local settings, and `frontend/.env.example` to `frontend/.env` if you want to override the local API target.
