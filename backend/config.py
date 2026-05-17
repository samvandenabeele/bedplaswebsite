import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


def _load_env_file() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.is_file():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "a_default_secret_key"
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or f"sqlite:///{(BASE_DIR / 'site.db').as_posix()}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS") or "http://localhost:5173,http://127.0.0.1:5173"
    AUTH_TOKEN_MAX_AGE = int(os.environ.get("AUTH_TOKEN_MAX_AGE", "604800"))