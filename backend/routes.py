
import logging
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from flask import Blueprint, current_app, g, jsonify, request, send_file
from sqlalchemy import func, or_

from extensions import db
from models import Camp, User, Participant, Water, Urine, Diaper, ClockUse, Clock
from api_auth import create_access_token, require_auth
from participant_service import resolve_participant, participant_activity_summary
from entry_service import entry_model_for_kind
from excel_import import process_workbook
from diaries import create_diary

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _current_user() -> User | None:
    return getattr(g, "current_user", None)


def _current_camp_ids() -> list[int]:
    current_user = _current_user()
    if current_user is None:
        return []

    membership_ids = sorted(
        {camp.id for camp in getattr(current_user, "camps", []) if camp is not None}
    )
    if membership_ids:
        return membership_ids

    legacy_camp_id = getattr(current_user, "camp_id", None)
    if legacy_camp_id is None:
        return []

    return [legacy_camp_id]


def _current_camp_id() -> int | None:
    camp_ids = _current_camp_ids()
    return camp_ids[0] if camp_ids else None


def _current_user_is_camp_scoped() -> bool:
    current_user = _current_user()
    if current_user is None:
        return False
    if getattr(current_user, "is_admin", False):
        return False
    return bool(_current_camp_ids())


def _resolve_camps_from_payload(payload: dict, *, allow_empty: bool = True):
    raw_camp_ids = payload.get("camp_ids")

    if raw_camp_ids is None and "camp_id" in payload:
        raw_camp_ids = [] if payload.get("camp_id") in (None, "") else [payload.get("camp_id")]

    if raw_camp_ids is None:
        selected_ids: list[int] = []
    elif isinstance(raw_camp_ids, list):
        selected_ids = []
        for raw_id in raw_camp_ids:
            try:
                selected_ids.append(int(raw_id))
            except (TypeError, ValueError):
                return None, "camp_ids must contain only integers."
    else:
        return None, "camp_ids must be an array of integers."

    selected_ids = sorted(set(selected_ids))

    allowed_ids = set(_current_camp_ids()) if _current_user_is_camp_scoped() else None
    if allowed_ids is not None:
        if not selected_ids:
            selected_ids = sorted(allowed_ids)
        elif any(camp_id not in allowed_ids for camp_id in selected_ids):
            return None, "Camp mismatch."

    if not selected_ids:
        if allow_empty:
            return [], None
        return None, "At least one camp is required."

    camps = Camp.query.filter(Camp.id.in_(selected_ids)).order_by(Camp.id.asc()).all()
    if len(camps) != len(selected_ids):
        return None, "One or more camps were not found."

    return camps, None


def _participant_visible_to_current_user(participant: Participant | None) -> bool:
    if participant is None:
        return False

    if not _current_user_is_camp_scoped():
        return True

    allowed_camp_ids = set(_current_camp_ids())
    return any(camp.id in allowed_camp_ids for camp in participant.camps)


def _scoped_participant_query():
    query = Participant.query.filter(Participant.active.is_(True))
    if _current_user_is_camp_scoped():
        query = query.filter(Participant.camps.any(Camp.id.in_(_current_camp_ids())))
    return query


def _scoped_user_query():
    query = User.query
    if _current_user_is_camp_scoped():
        query = query.filter(User.camps.any(Camp.id.in_(_current_camp_ids())))
    return query


def _parse_camp_date(value, field_name: str):
    if value in (None, ""):
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, str):
        for date_format in ("%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(value, date_format).date()
            except ValueError:
                continue

    raise ValueError(f"{field_name} must be a valid date.")


def _validate_camp_date_range(start_date, end_date):
    if start_date is not None and end_date is not None and start_date > end_date:
        return "start_date must be on or before end_date."
    return None


def _require_global_admin():
    # Global admin is a user with role 'admin'
    current_user = getattr(g, "current_user", None)
    if current_user is None:
        return False
    return getattr(current_user, "is_admin", False)

@api_bp.get("/health")
def health_check():
    current_app.logger.info("Health check called")
    return jsonify({"status": "ok"})


@api_bp.post("/auth/register")
def register():
    current_app.logger.info("Register endpoint called")
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    email = str(payload.get("email", "")).strip().lower() or None
    password = str(payload.get("password", ""))

    if not username or not password:
        current_app.logger.warning("Register failed: missing username or password")
        return jsonify({"error": "username and password are required."}), 400

    if User.query.filter_by(username=username).first() is not None:
        current_app.logger.warning(f"Register failed: username '{username}' already exists")
        return jsonify({"error": "Username already exists."}), 409

    if email and User.query.filter_by(email=email).first() is not None:
        current_app.logger.warning(f"Register failed: email '{email}' already exists")
        return jsonify({"error": "Email already exists."}), 409

    # Always create regular users via the public register endpoint
    camps, camp_error = _resolve_camps_from_payload(payload)
    if camp_error is not None:
        current_app.logger.warning(f"Register failed: camp error - {camp_error}")
        return jsonify({"error": camp_error}), 400

    primary_camp_id = camps[0].id if camps else None
    user = User(username=username, email=email, camp_id=primary_camp_id)
    user.set_password(password)
    user.camps = camps
    db.session.add(user)
    db.session.commit()

    current_app.logger.info(f"User registered successfully: {username} (ID: {user.id})")
    token = create_access_token(user)
    return jsonify({"user": user.to_dict(), "token": token}), 201


@api_bp.post("/auth/login")
def login():
    current_app.logger.info("Login endpoint called")
    payload = request.get_json(silent=True) or {}
    identifier = str(payload.get("identifier", payload.get("username", payload.get("email", "")))).strip().lower()
    password = str(payload.get("password", ""))

    if not identifier or not password:
        current_app.logger.warning("Login failed: missing identifier or password")
        return jsonify({"error": "identifier and password are required."}), 400

    user = User.query.filter(or_(User.username == identifier, User.email == identifier)).first()
    if user is None or not user.check_password(password):
        current_app.logger.warning(f"Login failed: invalid credentials for identifier '{identifier}'")
        return jsonify({"error": "Invalid credentials."}), 401

    current_app.logger.info(f"User logged in successfully: {user.username} (ID: {user.id})")
    return jsonify({"user": user.to_dict(), "token": create_access_token(user)})


@api_bp.post("/auth/password")
@require_auth
def change_password():
    user = g.current_user
    current_app.logger.info(f"Change password request from user: {user.username} (ID: {user.id})")
    payload = request.get_json(silent=True) or {}
    new_password = str(payload.get("new_password", ""))
    current_password = str(payload.get("current_password", ""))

    if not new_password:
        current_app.logger.warning(f"Change password failed for {user.username}: missing new_password")
        return jsonify({"error": "new_password is required."}), 400

    if not getattr(user, "password_change_required", False):
        if not current_password:
            current_app.logger.warning(f"Change password failed for {user.username}: missing current_password")
            return jsonify({"error": "current_password is required."}), 400
        if not user.check_password(current_password):
            current_app.logger.warning(f"Change password failed for {user.username}: invalid current password")
            return jsonify({"error": "Invalid credentials."}), 401

    user.set_password(new_password)
    user.password_change_required = False
    user.token_version += 1
    db.session.commit()

    current_app.logger.info(f"Password changed successfully for user: {user.username} (ID: {user.id})")
    return jsonify({"user": user.to_dict(), "token": create_access_token(user)})


@api_bp.post("/auth/logout")
@require_auth
def logout():
    user = g.current_user
    current_app.logger.info(f"User logged out: {user.username} (ID: {user.id})")
    user.token_version += 1
    db.session.commit()
    return jsonify({"message": "Logged out successfully."})


@api_bp.get("/auth/me")
@require_auth
def me():
    user = g.current_user
    current_app.logger.debug(f"Get current user info for: {user.username} (ID: {user.id})")
    return jsonify({"user": user.to_dict()})


@api_bp.get("/camps")
@require_auth
def list_camps():
    user = g.current_user
    current_app.logger.debug(f"List camps requested by user: {user.username} (ID: {user.id})")
    query = Camp.query
    if _current_user_is_camp_scoped():
        query = query.filter(Camp.id.in_(_current_camp_ids()))

    camps = query.order_by(Camp.created_at.desc()).all()
    current_app.logger.info(f"Listed {len(camps)} camps for user: {user.username}")
    return jsonify({"camps": [camp.to_dict() for camp in camps]})


@api_bp.post("/camps")
@require_auth
def create_camp():
    user = g.current_user
    current_app.logger.info(f"Create camp requested by user: {user.username} (ID: {user.id})")
    
    if not _require_global_admin():
        current_app.logger.warning(f"Create camp denied: user {user.username} is not a global admin")
        return jsonify({"error": "Only global admins can create camps."}), 403

    payload = request.get_json(silent=True) or {}
    code = str(payload.get("code", "")).strip()
    name = str(payload.get("name", "")).strip() or None
    source_header = str(payload.get("source_header", "")).strip() or None
    try:
        start_date = _parse_camp_date(payload.get("start_date"), "start_date")
        end_date = _parse_camp_date(payload.get("end_date"), "end_date")
    except ValueError as exc:
        current_app.logger.warning(f"Create camp failed: invalid date format - {exc}")
        return jsonify({"error": str(exc)}), 400

    if not code:
        current_app.logger.warning("Create camp failed: missing code")
        return jsonify({"error": "code is required."}), 400

    date_error = _validate_camp_date_range(start_date, end_date)
    if date_error is not None:
        current_app.logger.warning(f"Create camp failed: {date_error}")
        return jsonify({"error": date_error}), 400

    if Camp.query.filter_by(code=code).first() is not None:
        current_app.logger.warning(f"Create camp failed: camp code '{code}' already exists")
        return jsonify({"error": "Camp code already exists."}), 409

    camp = Camp(
        code=code,
        name=name,
        source_header=source_header,
        start_date=start_date,
        end_date=end_date,
    )
    db.session.add(camp)
    db.session.commit()

    current_app.logger.info(f"Camp created successfully: {code} (ID: {camp.id}) by user {user.username}")
    return jsonify({"camp": camp.to_dict()}), 201


@api_bp.patch("/camps/<int:camp_id>")
@require_auth
def update_camp(camp_id: int):
    user = g.current_user
    current_app.logger.info(f"Update camp {camp_id} requested by user: {user.username} (ID: {user.id})")
    
    if not _require_global_admin():
        current_app.logger.warning(f"Update camp {camp_id} denied: user {user.username} is not a global admin")
        return jsonify({"error": "Only global admins can update camps."}), 403

    camp = db.session.get(Camp, camp_id)
    if camp is None:
        current_app.logger.warning(f"Update camp {camp_id} failed: camp not found")
        return jsonify({"error": "Camp not found."}), 404

    payload = request.get_json(silent=True) or {}

    if "code" in payload:
        code = str(payload.get("code", "")).strip()
        if not code:
            current_app.logger.warning(f"Update camp {camp_id} failed: code cannot be empty")
            return jsonify({"error": "code is required."}), 400
        duplicate = Camp.query.filter(Camp.code == code, Camp.id != camp_id).first()
        if duplicate is not None:
            current_app.logger.warning(f"Update camp {camp_id} failed: camp code '{code}' already exists")
            return jsonify({"error": "Camp code already exists."}), 409
        camp.code = code
        current_app.logger.debug(f"Camp {camp_id} code updated to: {code}")

    if "name" in payload:
        camp.name = str(payload.get("name", "")).strip() or None

    if "source_header" in payload:
        camp.source_header = str(payload.get("source_header", "")).strip() or None

    if "start_date" in payload:
        try:
            camp.start_date = _parse_camp_date(payload.get("start_date"), "start_date")
        except ValueError as exc:
            current_app.logger.warning(f"Update camp {camp_id} failed: invalid start_date - {exc}")
            return jsonify({"error": str(exc)}), 400

    if "end_date" in payload:
        try:
            camp.end_date = _parse_camp_date(payload.get("end_date"), "end_date")
        except ValueError as exc:
            current_app.logger.warning(f"Update camp {camp_id} failed: invalid end_date - {exc}")
            return jsonify({"error": str(exc)}), 400

    date_error = _validate_camp_date_range(camp.start_date, camp.end_date)
    if date_error is not None:
        current_app.logger.warning(f"Update camp {camp_id} failed: {date_error}")
        return jsonify({"error": date_error}), 400

    if "active" in payload:
        camp.active = bool(payload.get("active"))

    db.session.commit()
    current_app.logger.info(f"Camp {camp_id} updated successfully by user {user.username}")
    return jsonify({"camp": camp.to_dict()})

@api_bp.route("/addParticipant", methods=["POST"])
@require_auth
def add_participants():
    user = g.current_user
    current_app.logger.info(f"Add participant request from user: {user.username} (ID: {user.id})")
    
    payload = request.get_json(silent=True)
    if payload is None:
        current_app.logger.warning("Add participant failed: no JSON payload provided")
        return jsonify({"error": "incorrect participant info"}), 400

    name = str(payload.get("name", "")).strip()
    if not name:
        current_app.logger.warning("Add participant failed: missing name")
        return jsonify({"error": "name is required."}), 400
    
    last_name = str(payload.get("last_name", "")).strip()
    if not last_name:
        current_app.logger.warning("Add participant failed: missing last_name")
        return jsonify({"error": "last name is required."}), 400
    
    phone_1 = str(payload.get("phone_1", "")).strip()
    if not phone_1:
        current_app.logger.warning("Add participant failed: missing phone_1")
        return jsonify({"error": "phone_1 is required."}), 400
    
    phone_2 = str(payload.get("phone_2", "")).strip()

    diaper = payload.get("empty_diaper", 0)
    # Optional birth date
    birth_date = None
    if "birth_date" in payload:
        try:
            birth_date = _parse_camp_date(payload.get("birth_date"), "birth_date")
        except ValueError as exc:
            current_app.logger.warning(f"Add participant failed: invalid birth_date - {exc}")
            return jsonify({"error": str(exc)}), 400

    camps, camp_error = _resolve_camps_from_payload(payload, allow_empty=False)
    if camp_error is not None:
        current_app.logger.warning(f"Add participant failed: camp error - {camp_error}")
        return jsonify({"error": camp_error}), 400

    primary_camp_id = camps[0].id if camps else None
    new_participant = Participant(
        name=name,
        last_name=last_name,
        phone_1=phone_1,
        phone_2=phone_2,
        empty_diaper=diaper,
        camp_id=primary_camp_id,
        birth_date=birth_date,
    )
    new_participant.camps = camps
    db.session.add(new_participant)
    db.session.commit()
    
    current_app.logger.info(f"Participant added successfully: {name} {last_name} (ID: {new_participant.id}) by user {user.username}")
    return jsonify({"message": "Participant added successfully.", "name": name}), 201


@api_bp.post("/users")
@require_auth
def create_user():
    """Create a new user. Admins may create users with any role. Superusers may create regular users scoped to their camp."""
    user = g.current_user
    current_app.logger.info(f"Create user request from user: {user.username} (ID: {user.id})")
    
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip().lower()
    email = str(payload.get("email", "")).strip().lower() or None
    password = str(payload.get("password", ""))
    role = str(payload.get("role", "user")).strip().lower() or "user"

    if not username or not password:
        current_app.logger.warning("Create user failed: missing username or password")
        return jsonify({"error": "username and password are required."}), 400

    if User.query.filter_by(username=username).first() is not None:
        current_app.logger.warning(f"Create user failed: username '{username}' already exists")
        return jsonify({"error": "Username already exists."}), 409

    if email and User.query.filter_by(email=email).first() is not None:
        current_app.logger.warning(f"Create user failed: email '{email}' already exists")
        return jsonify({"error": "Email already exists."}), 409

    # Only admins can create superusers or admin accounts
    if role in ("superuser", "admin") and not getattr(user, "is_admin", False):
        current_app.logger.warning(f"Create user failed: user {user.username} not authorized to create role '{role}'")
        return jsonify({"error": "Only admins can create superuser or admin accounts."}), 403

    # Determine camp assignment
    camps, camp_error = _resolve_camps_from_payload(payload)
    if camp_error is not None:
        current_app.logger.warning(f"Create user failed: camp error - {camp_error}")
        return jsonify({"error": camp_error}), 400

    primary_camp_id = camps[0].id if camps else None
    new_user = User(username=username, email=email, camp_id=primary_camp_id, role=role)
    new_user.set_password(password)
    new_user.camps = camps
    db.session.add(new_user)
    db.session.commit()

    current_app.logger.info(f"User created successfully: {username} (ID: {new_user.id}, role={role}) by user {user.username}")
    return jsonify({"user": new_user.to_dict()}), 201


@api_bp.patch("/users/<int:user_id>")
@require_auth
def update_user(user_id: int):
    current_user = g.current_user
    current_app.logger.info(f"Update user {user_id} requested by user: {current_user.username} (ID: {current_user.id})")
    
    if not _require_global_admin():
        current_app.logger.warning(f"Update user {user_id} denied: user {current_user.username} is not a global admin")
        return jsonify({"error": "Only admins can update user accounts."}), 403

    user = db.session.get(User, user_id)
    if user is None:
        current_app.logger.warning(f"Update user {user_id} failed: user not found")
        return jsonify({"error": "User not found."}), 404

    payload = request.get_json(silent=True) or {}
    updates_applied = False

    if "role" in payload:
        role = str(payload.get("role", "")).strip().lower()
        if role not in ("user", "superuser", "admin"):
            current_app.logger.warning(f"Update user {user_id} failed: invalid role '{role}'")
            return jsonify({"error": "Invalid role."}), 400
        user.role = role
        updates_applied = True
        current_app.logger.debug(f"User {user_id} role updated to: {role}")

    if "email" in payload:
        email = str(payload.get("email", "")).strip().lower() or None
        if email != user.email:
            if email and User.query.filter(User.email == email, User.id != user.id).first() is not None:
                current_app.logger.warning(f"Update user {user_id} failed: email '{email}' already exists")
                return jsonify({"error": "Email already exists."}), 409
            user.email = email
            updates_applied = True
            current_app.logger.debug(f"User {user_id} email updated")

    if "username" in payload:
        username = str(payload.get("username", "")).strip().lower()
        if not username:
            current_app.logger.warning(f"Update user {user_id} failed: username cannot be empty")
            return jsonify({"error": "username cannot be empty."}), 400
        if username != user.username:
            if User.query.filter(User.username == username, User.id != user.id).first() is not None:
                current_app.logger.warning(f"Update user {user_id} failed: username '{username}' already exists")
                return jsonify({"error": "Username already exists."}), 409
            user.username = username
            updates_applied = True
            current_app.logger.debug(f"User {user_id} username updated to: {username}")

    if "camp_ids" in payload or "camp_id" in payload:
        camps, camp_error = _resolve_camps_from_payload(payload)
        if camp_error is not None:
            current_app.logger.warning(f"Update user {user_id} failed: camp error - {camp_error}")
            return jsonify({"error": camp_error}), 400

        next_camp_ids = [camp.id for camp in camps]
        previous_camp_ids = [camp.id for camp in sorted(user.camps, key=lambda camp: camp.id)]
        if next_camp_ids != previous_camp_ids:
            user.camps = camps
            user.camp_id = camps[0].id if camps else None
            updates_applied = True
            current_app.logger.debug(f"User {user_id} camps updated to: {next_camp_ids}")

    if not updates_applied:
        current_app.logger.warning(f"Update user {user_id} failed: no valid updates provided")
        return jsonify({"error": "No valid updates provided."}), 400

    db.session.commit()
    current_app.logger.info(f"User {user_id} updated successfully by user {current_user.username}")
    return jsonify({"user": user.to_dict()})

@api_bp.route("/delParticipant", methods=["POST"])
@require_auth
def del_participant():
    user = g.current_user
    current_app.logger.info(f"Delete participant request from user: {user.username} (ID: {user.id})")
    
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    last_name = str(payload.get("last_name", "")).strip()

    if not name or not last_name:
        current_app.logger.warning("Delete participant failed: missing name or last_name")
        return jsonify({"error": "name and last name are required."}), 400

    participant = _scoped_participant_query().filter(
        Participant.name == name,
        Participant.last_name == last_name,
    ).first()

    if participant is None:
        current_app.logger.warning(f"Delete participant failed: participant '{name} {last_name}' not found")
        return jsonify({"error": "Participant not found."}), 404

    participant_id = participant.id
    db.session.delete(participant)
    db.session.commit()

    current_app.logger.info(f"Participant deleted successfully: {name} {last_name} (ID: {participant_id}) by user {user.username}")
    return jsonify({"message": "Participant deleted successfully."})

@api_bp.route("/queryParticipant", methods=["POST"])
@require_auth
def query_participant():
    user = g.current_user
    payload = request.get_json(silent=True) or {}
    current_app.logger.debug(f"Query participant request from user: {user.username} with filters: {payload}")
    
    query = _scoped_participant_query()

    if payload.get("name"):
        query = query.filter(Participant.name.ilike(f"%{payload.get('name')}%"))
    
    if payload.get("last_name"):
        query = query.filter(Participant.last_name.ilike(f"%{payload.get('last_name')}%"))
    
    if payload.get("phone_1"):
        query = query.filter(Participant.phone_1.ilike(f"%{payload.get('phone_1')}%"))
    
    if payload.get("phone_2"):
        query = query.filter(Participant.phone_2.ilike(f"%{payload.get('phone_2')}%"))
    
    participants = query.all()
    current_app.logger.info(f"Participant query returned {len(participants)} results for user {user.username}")
    return jsonify({"participants": [participant_activity_summary(p) for p in participants]})

@api_bp.route("/queryCounselor", methods=["POST"])
@require_auth
def query_counselor():
    user = g.current_user
    payload = request.get_json(silent=True) or {}
    current_app.logger.debug(f"Query counselor request from user: {user.username} with filters: {payload}")
    
    # Query users (counselors). There is no `active` on User, so just query User
    query = _scoped_user_query()

    # Accept either `username` or `name` as a search term for the username
    username_term = payload.get("username") or payload.get("name")
    if username_term:
        query = query.filter(User.username.ilike(f"%{username_term}%"))

    if payload.get("email"):
        query = query.filter(User.email.ilike(f"%{payload.get('email')}%"))

    counselors = query.all()
    current_app.logger.info(f"Counselor query returned {len(counselors)} results for user {user.username}")

    return jsonify({
        "counselors": [
            {
                "id": c.id,
                "username": c.username,
                "email": c.email,
                "role": getattr(c, "role", "user"),
                "active": c.active,
                "camp_id": c.camp_id,
                "camp": c.camp.to_dict() if getattr(c, "camp", None) is not None else None,
                "camp_ids": [camp.id for camp in sorted(c.camps, key=lambda camp: camp.id)],
                "camps": [camp.to_dict() for camp in sorted(c.camps, key=lambda camp: camp.id)],
            }
            for c in counselors
        ]
    })


@api_bp.patch("/updateEmptyDiaper")
@require_auth
def update_empty_diaper():
    user = g.current_user
    current_app.logger.debug(f"Update empty diaper request from user: {user.username}")
    
    payload = request.get_json(silent=True) or {}
    participant = resolve_participant(payload, _current_camp_ids())

    if participant is None:
        current_app.logger.warning(f"Update empty diaper failed: participant not found")
        return jsonify({"error": "Participant not found."}), 404

    try:
        empty_diaper = int(payload.get("empty_diaper"))
    except (TypeError, ValueError):
        current_app.logger.warning(f"Update empty diaper failed: invalid empty_diaper value")
        return jsonify({"error": "empty_diaper must be an integer."}), 400

    if empty_diaper < 0:
        current_app.logger.warning(f"Update empty diaper failed: negative value provided")
        return jsonify({"error": "empty_diaper must be zero or greater."}), 400

    participant.empty_diaper = empty_diaper
    db.session.commit()

    current_app.logger.info(f"Empty diaper updated for participant {participant.id}: {empty_diaper} by user {user.username}")
    return jsonify(
        {
            "message": "Empty diaper weight updated successfully.",
            "empty_diaper": participant.empty_diaper,
        }
    )




@api_bp.route("/addWater", methods=["POST"])
@require_auth
def add_water():
    payload = request.get_json(silent=True) or {}
    meal = bool(payload.get("meal"))

    participant = resolve_participant(payload, _current_camp_ids())

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404

    new_water = Water(participant_id=participant.id, meal=meal)
    db.session.add(new_water)
    db.session.commit()

    return jsonify({"message": "Water entry added successfully."}), 201
    
@api_bp.route("/addUrine", methods=["POST"])
@require_auth
def add_urine():
    payload = request.get_json(silent=True) or {}
    amount = int(payload.get("amount"))
    note = str(payload.get("note", "")).strip() or None
    faeces = bool(payload.get("faeces"))

    participant = resolve_participant(payload, _current_camp_ids())

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404

    new_urine = Urine(participant_id=participant.id, amount=amount, note=note, faeces=faeces)
    db.session.add(new_urine)
    db.session.commit()

    return jsonify({"message": "Urine entry added successfully."}), 201

@api_bp.route("/addDiaper", methods=["POST"])
@require_auth
def add_diaper():
    payload = request.get_json(silent=True) or {}
    weight = int(payload.get("weight"))
    note = str(payload.get("note", "")).strip() or None

    participant = resolve_participant(payload, _current_camp_ids())

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404

    liquid_weight = weight - participant.empty_diaper

    new_diaper = Diaper(participant_id=participant.id, weight=liquid_weight, note=note)
    db.session.add(new_diaper)
    db.session.commit()

    return jsonify({"message": "Diaper entry added successfully."}), 201


@api_bp.get("/participantRecentEntries/<int:participant_id>")
@require_auth
def participant_recent_entries(participant_id: int):
    participant = db.session.get(Participant, participant_id)
    if not _participant_visible_to_current_user(participant):
        return jsonify({"error": "Participant not found."}), 404

    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer."}), 400

    if limit < 1:
        return jsonify({"error": "limit must be greater than 0."}), 400

    # Keep this bounded to protect the endpoint from very large requests.
    limit = min(limit, 200)

    water_entries = (
        Water.query.filter(Water.participant_id == participant_id)
        .order_by(Water.created_at.desc())
        .limit(limit)
        .all()
    )
    urine_entries = (
        Urine.query.filter(Urine.participant_id == participant_id)
        .order_by(Urine.created_at.desc())
        .limit(limit)
        .all()
    )
    diaper_entries = (
        Diaper.query.filter(Diaper.participant_id == participant_id)
        .order_by(Diaper.created_at.desc())
        .limit(limit)
        .all()
    )
    clock_entries = (
        Clock.query.filter(Clock.participant_id == participant_id)
        .order_by(Clock.created_at.desc())
        .limit(limit)
        .all()
    )

    merged_entries = [
        {
            "id": entry.id,
            "kind": "water",
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "meal": entry.meal,
            "amount": None,
            "weight": None,
            "note": None,
        }
        for entry in water_entries
    ] + [
        {
            "id": entry.id,
            "kind": "urine",
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "meal": None,
            "faeces": entry.faeces,
            "amount": entry.amount,
            "weight": None,
            "note": entry.note,
        }
        for entry in urine_entries
    ] + [
        {
            "id": entry.id,
            "kind": "diaper",
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "meal": None,
            "amount": None,
            "weight": entry.weight,
            "note": entry.note,
        }
        for entry in diaper_entries
    ] + [
        {
            "id": entry.id,
            "kind": "clock",
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        }
        for entry in clock_entries
    ]

    merged_entries.sort(key=lambda entry: entry.get("created_at") or "", reverse=True)

    return jsonify({"entries": merged_entries[:limit]})


@api_bp.get("/recentEntries")
@require_auth
def recent_entries():
    try:
        limit = int(request.args.get("limit", 100))
    except (TypeError, ValueError):
        return jsonify({"error": "limit must be an integer."}), 400

    if limit < 1:
        return jsonify({"error": "limit must be greater than 0."}), 400

    limit = min(limit, 300)

    participant_query = Participant.query
    if _current_user_is_camp_scoped():
        participant_query = participant_query.filter(Participant.camps.any(Camp.id.in_(_current_camp_ids())))

    scoped_participant_ids = [row[0] for row in participant_query.with_entities(Participant.id).all()]
    if not scoped_participant_ids:
        return jsonify({"entries": []})

    water_entries = Water.query.filter(Water.participant_id.in_(scoped_participant_ids)).order_by(Water.created_at.desc()).limit(limit).all()
    urine_entries = Urine.query.filter(Urine.participant_id.in_(scoped_participant_ids)).order_by(Urine.created_at.desc()).limit(limit).all()
    diaper_entries = Diaper.query.filter(Diaper.participant_id.in_(scoped_participant_ids)).order_by(Diaper.created_at.desc()).limit(limit).all()
    clock_entries = Clock.query.filter(Clock.participant_id.in_(scoped_participant_ids)).order_by(Clock.created_at.desc()).limit(limit).all()

    participant_ids = {
        entry.participant_id
        for entry in water_entries + urine_entries + diaper_entries + clock_entries
    }
    participants = Participant.query.filter(Participant.id.in_(participant_ids)).all() if participant_ids else []
    participant_by_id = {
        participant.id: participant
        for participant in participants
    }

    def _primary_participant_camp(participant: Participant | None):
        if participant is None:
            return None
        camps = sorted(participant.camps, key=lambda camp: camp.id)
        return camps[0] if camps else None

    merged_entries = [
        {
            "id": entry.id,
            "kind": "water",
            "participant_id": entry.participant_id,
            "participant_name": participant_by_id.get(entry.participant_id).name
            if participant_by_id.get(entry.participant_id)
            else "Unknown",
            "participant_last_name": participant_by_id.get(entry.participant_id).last_name
            if participant_by_id.get(entry.participant_id)
            else "",
            "participant_camp_id": _primary_participant_camp(participant_by_id.get(entry.participant_id)).id
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_code": _primary_participant_camp(participant_by_id.get(entry.participant_id)).code
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_name": _primary_participant_camp(participant_by_id.get(entry.participant_id)).name
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "meal": entry.meal,
            "amount": None,
            "weight": None,
            "note": None,
        }
        for entry in water_entries
    ] + [
        {
            "id": entry.id,
            "kind": "urine",
            "participant_id": entry.participant_id,
            "participant_name": participant_by_id.get(entry.participant_id).name
            if participant_by_id.get(entry.participant_id)
            else "Unknown",
            "participant_last_name": participant_by_id.get(entry.participant_id).last_name
            if participant_by_id.get(entry.participant_id)
            else "",
            "participant_camp_id": _primary_participant_camp(participant_by_id.get(entry.participant_id)).id
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_code": _primary_participant_camp(participant_by_id.get(entry.participant_id)).code
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_name": _primary_participant_camp(participant_by_id.get(entry.participant_id)).name
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "meal": None,
            "amount": entry.amount,
            "weight": None,
            "note": entry.note,
        }
        for entry in urine_entries
    ] + [
        {
            "id": entry.id,
            "kind": "diaper",
            "participant_id": entry.participant_id,
            "participant_name": participant_by_id.get(entry.participant_id).name
            if participant_by_id.get(entry.participant_id)
            else "Unknown",
            "participant_last_name": participant_by_id.get(entry.participant_id).last_name
            if participant_by_id.get(entry.participant_id)
            else "",
            "participant_camp_id": _primary_participant_camp(participant_by_id.get(entry.participant_id)).id
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_code": _primary_participant_camp(participant_by_id.get(entry.participant_id)).code
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_name": _primary_participant_camp(participant_by_id.get(entry.participant_id)).name
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "meal": None,
            "amount": None,
            "weight": entry.weight,
            "note": entry.note,
        }
        for entry in diaper_entries
    ] + [
        {
            "id": entry.id,
            "kind": "clock",
            "participant_id": entry.participant_id,
            "participant_name": participant_by_id.get(entry.participant_id).name
            if participant_by_id.get(entry.participant_id)
            else "Unknown",
            "participant_last_name": participant_by_id.get(entry.participant_id).last_name
            if participant_by_id.get(entry.participant_id)
            else "",
            "participant_camp_id": _primary_participant_camp(participant_by_id.get(entry.participant_id)).id
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_code": _primary_participant_camp(participant_by_id.get(entry.participant_id)).code
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "participant_camp_name": _primary_participant_camp(participant_by_id.get(entry.participant_id)).name
            if participant_by_id.get(entry.participant_id)
            and _primary_participant_camp(participant_by_id.get(entry.participant_id)) is not None
            else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "meal": None,
            "amount": None,
            "weight": None,
            "note": None,
        }
        for entry in clock_entries
    ]

    merged_entries.sort(key=lambda entry: entry.get("created_at") or "", reverse=True)

    return jsonify({"entries": merged_entries[:limit]})


# use entry_service.entry_model_for_kind


@api_bp.patch("/entry/<string:kind>/<int:entry_id>")
@require_auth
def update_entry(kind: str, entry_id: int):
    model = entry_model_for_kind(kind)
    if model is None:
        return jsonify({"error": "Unsupported entry kind."}), 400

    entry = db.session.get(model, entry_id)
    if entry is None:
        return jsonify({"error": "Entry not found."}), 404

    participant = db.session.get(Participant, entry.participant_id)
    if not _participant_visible_to_current_user(participant):
        return jsonify({"error": "Entry not found."}), 404

    payload = request.get_json(silent=True) or {}

    if kind == "water":
        if "meal" in payload:
            entry.meal = bool(payload.get("meal"))

    if kind == "urine":
        if "amount" in payload:
            try:
                amount = int(payload.get("amount"))
            except (TypeError, ValueError):
                return jsonify({"error": "amount must be an integer."}), 400
            if amount < 0:
                return jsonify({"error": "amount must be zero or greater."}), 400
            entry.amount = amount

        if "note" in payload:
            note = str(payload.get("note", "")).strip() or None
            entry.note = note
        if "faeces" in payload:
            entry.faeces = bool(payload.get("faeces"))

    if kind == "diaper":
        if "weight" in payload:
            try:
                weight = int(payload.get("weight"))
            except (TypeError, ValueError):
                return jsonify({"error": "weight must be an integer."}), 400
            if weight < 0:
                return jsonify({"error": "weight must be zero or greater."}), 400
            entry.weight = weight

        if "note" in payload:
            note = str(payload.get("note", "")).strip() or None
            entry.note = note

    db.session.commit()
    return jsonify({"message": "Entry updated successfully."})


@api_bp.delete("/entry/<string:kind>/<int:entry_id>")
@require_auth
def delete_entry(kind: str, entry_id: int):
    model = entry_model_for_kind(kind)
    if model is None:
        return jsonify({"error": "Unsupported entry kind."}), 400

    entry = db.session.get(model, entry_id)
    if entry is None:
        return jsonify({"error": "Entry not found."}), 404

    participant = db.session.get(Participant, entry.participant_id)
    if not _participant_visible_to_current_user(participant):
        return jsonify({"error": "Entry not found."}), 404

    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Entry deleted successfully."})

@api_bp.post("/excelParticipantsCounselors")
@require_auth
def excel_participants_counselors():
    # Accept an uploaded Excel file (multipart/form-data, field name 'file') and
    # create Participants and Counselor Users automatically.
    upload = request.files.get("file")
    camp_name = str(request.form.get("camp_name", "")).strip()
    if upload is None:
        return jsonify({"error": "No file uploaded. Provide file field 'file'."}), 400
    if not camp_name:
        return jsonify({"error": "camp_name is required."}), 400
    # Delegate processing to helper that returns created/skipped counts and counselors list.
    try:
        created_participants, skipped_participants, created_counselors = process_workbook(upload, camp_name=camp_name)
    except Exception:
        # Likely openpyxl missing or workbook parse error; return generic error.
        return jsonify({"error": "Failed to process workbook. Is openpyxl installed and is file valid?"}), 400

    # Commit all new records
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": f"Database commit failed: {exc}"}), 500

    return jsonify({
        "participants_created": created_participants,
        "participants_skipped": skipped_participants,
        "counselors_created": created_counselors,
    })

@api_bp.post("addClock")
@require_auth
def add_clock():
    payload = request.get_json(silent=True) or {}
    id = int(payload.get("participant_id"))

    participant = db.session.get(Participant, id)
    if not _participant_visible_to_current_user(participant):
        return jsonify({"error": "Participant not found."}), 404

    new_clock = Clock(participant_id=id)
    db.session.add(new_clock)
    db.session.commit()

    return jsonify({'message' : 'clock added', 'participant_id': id})

@api_bp.post("addClockUse")
@require_auth
def add_clock_use():
    payload = request.get_json(silent=True) or {}
    id = int(payload.get("participant_id"))

    participant = db.session.get(Participant, id)
    if not _participant_visible_to_current_user(participant):
        return jsonify({"error": "Participant not found."}), 404

    new_clock_use = ClockUse(participant_id=id)
    db.session.add(new_clock_use)
    db.session.commit()

    return jsonify({'message' : 'clockUse added', 'participant_id': id})

@api_bp.get("/downloadDiaries")
@require_auth
def download_diaries():
    camp_id = request.args.get("camp_id", type=int)
    current_user = getattr(g, "current_user", None)

    if camp_id is None:
        camp_id = _current_camp_id()

    if camp_id is None:
        return jsonify({"error": "Camp ID is required."}), 400

    camp = db.session.get(Camp, camp_id)
    if camp is None:
        return jsonify({"error": "Camp not found."}), 404

    if _current_user_is_camp_scoped() and camp_id not in set(_current_camp_ids()):
            return jsonify({"error": "Superusers can only download diaries for their own camp."}), 403

    participants = (
        db.session.query(Participant)
        .filter(Participant.camps.any(Camp.id == camp_id))
        .order_by(Participant.last_name, Participant.name, Participant.id)
        .all()
    )

    if not participants:
        return jsonify({"error": "No participants found for this camp."}), 404

    export_buffer = BytesIO()
    export_name = f"camp_{camp.id}_diaries.zip"

    with ZipFile(export_buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        for participant in participants:
            diary_path = Path(create_diary(participant))
            try:
                archive.write(diary_path, arcname=diary_path.name)
            finally:
                diary_path.unlink(missing_ok=True)

    export_buffer.seek(0)

    return send_file(
        export_buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name=export_name,
    )