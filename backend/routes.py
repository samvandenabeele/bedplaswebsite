from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import or_

from extensions import db
from models import User, Participant, Water, Urine, Diaper


api_bp = Blueprint("api", __name__, url_prefix="/api")


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


@api_bp.get("/health")
def health_check():
    return jsonify({"status": "ok"})


@api_bp.post("/auth/register")
def register():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    email = str(payload.get("email", "")).strip().lower() or None
    password = str(payload.get("password", ""))

    if not username or not password:
        return jsonify({"error": "username and password are required."}), 400

    if User.query.filter_by(username=username).first() is not None:
        return jsonify({"error": "Username already exists."}), 409

    if email and User.query.filter_by(email=email).first() is not None:
        return jsonify({"error": "Email already exists."}), 409

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(user)
    return jsonify({"user": user.to_dict(), "token": token}), 201


@api_bp.post("/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    identifier = str(payload.get("identifier", payload.get("username", payload.get("email", "")))).strip().lower()
    password = str(payload.get("password", ""))

    if not identifier or not password:
        return jsonify({"error": "identifier and password are required."}), 400

    user = User.query.filter(or_(User.username == identifier, User.email == identifier)).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid credentials."}), 401

    return jsonify({"user": user.to_dict(), "token": create_access_token(user)})


@api_bp.post("/auth/logout")
@require_auth
def logout():
    user = g.current_user
    user.token_version += 1
    db.session.commit()
    return jsonify({"message": "Logged out successfully."})


@api_bp.get("/auth/me")
@require_auth
def me():
    return jsonify({"user": g.current_user.to_dict()})

@api_bp.route("/addParticipant", methods=["POST"])
@require_auth
def add_participants():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "incorrect participant info"}), 400

    name = str(payload.get("name", "")).strip()
    if not name:
        return jsonify({"error": "name is required."}), 400
    
    last_name = str(payload.get("last_name", "")).strip()
    if not last_name:
        return jsonify({"error": "last name is required."}), 400
    
    phone_1 = str(payload.get("phone_1", "")).strip()
    if not phone_1:
        return jsonify({"error": "phone_1 is required."}), 400
    
    phone_2 = str(payload.get("phone_2", "")).strip()

    new_participant = Participant(name=name, last_name=last_name, phone_1=phone_1, phone_2=phone_2)
    db.session.add(new_participant)
    db.session.commit()
    

    return jsonify({"message": "Participant added successfully.", "name": name}), 201

@api_bp.route("/delParticipant", methods=["POST"])
@require_auth
def del_participant():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    last_name = str(payload.get("last_name", "")).strip()

    if not name or not last_name:
        return jsonify({"error": "name and last name are required."}), 400

    participant = Participant.query.filter(
        Participant.name == name,
        Participant.last_name == last_name,
    ).first()

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404

    db.session.delete(participant)
    db.session.commit()

    return jsonify({"message": "Participant deleted successfully."})

@api_bp.route("/queryParticipant", methods=["POST"])
@require_auth
def query_participant():
    payload = request.get_json(silent=True) or {}
    query = Participant.query.filter(Participant.active.is_(True))


    if payload.get("name"):
        query = query.filter(Participant.name.ilike(f"%{payload.get('name')}%"))
    
    if payload.get("last_name"):
        query = query.filter(Participant.last_name.ilike(f"%{payload.get('last_name')}%"))
    
    if payload.get("phone_1"):
        query = query.filter(Participant.phone_1.ilike(f"%{payload.get('phone_1')}%"))
    
    if payload.get("phone_2"):
        query = query.filter(Participant.phone_2.ilike(f"%{payload.get('phone_2')}%"))
    
    participants = query.all()
    
    return jsonify({
        "participants": [
            {"id": p.id, "name": p.name, "last_name": p.last_name, "phone_1": p.phone_1, "phone_2": p.phone_2}
            for p in participants
        ]
    })

@api_bp.route("/addWater", methods=["POST"])
@require_auth
def add_water():
    payload = request.get_json()

    name = payload.get("name")
    last_name = payload.get("last_name")
    meal = bool(payload.get("meal"))

    if (not name) or (not last_name):
        return jsonify({"error": "name and last name are required."}), 400

    participant = Participant.query.filter(
        Participant.name == name,
        Participant.last_name == last_name
    ).first()

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404

    participant_id = participant.id
    
    new_water = Water(participant_id=participant_id, meal=meal)
    db.session.add(new_water)
    db.session.commit()
    
@api_bp.route("/addUrine", methods=["POST"])
@require_auth
def add_urine():
    payload = request.get_json()
    name = payload.get("name")
    last_name = payload.get("last_name")
    amount = int(payload.get("amount"))
    note = str(payload.get("note", "")).strip() or None

    if (not name) or (not last_name):
        return jsonify({"error": "name and last name are required."}), 400
    
    participant = Participant.query.filter(
        Participant.name == name,
        Participant.last_name == last_name
    ).first()

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404
    
    participant_id = participant.id

    new_urine = Urine(participant_id=participant_id, amount=amount, note=note)
    db.session.add(new_urine)
    db.session.commit()
