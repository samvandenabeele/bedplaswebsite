import os

from app import app, bootstrap_database


if __name__ == "__main__":
    bootstrap_database(app)

    gunicorn_cmd = [
        "gunicorn",
        "--bind",
        f"0.0.0.0:{os.environ.get('PORT', '8000')}",
        "--workers",
        os.environ.get("GUNICORN_WORKERS", "2"),
        "--access-logfile",
        "-",
        "--error-logfile",
        "-",
        "app:app",
    ]
    os.execvp(gunicorn_cmd[0], gunicorn_cmd)
