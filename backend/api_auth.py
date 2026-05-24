from datetime import datetime
from functools import wraps

from flask import current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from extensions import db
from models import User


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="bedplas-auth-token")


def create_access_token(user: User) -> str:
    payload = {"user_id": user.id, "token_version": user.token_version}
    return _serializer().dumps(payload)


def get_user_from_token(token: str) -> User | None:
    try:
        payload = _serializer().loads(token, max_age=current_app.config["AUTH_TOKEN_MAX_AGE"])
    except (BadSignature, SignatureExpired):
        return None

    user = db.session.get(User, payload.get("user_id"))
    if user is None or user.token_version != payload.get("token_version"):
        return None
    return user


def require_auth(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else ""
        if not token:
            return jsonify({"error": "Authorization token required."}), 401

        user = get_user_from_token(token)
        if user is None:
            return jsonify({"error": "Invalid or expired token."}), 401

        g.current_user = user
        return view_func(*args, **kwargs)

    return wrapper
