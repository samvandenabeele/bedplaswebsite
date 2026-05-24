
from datetime import datetime, timedelta
from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import func, or_

from extensions import db
from models import User, Participant, Water, Urine, Diaper, ClockUse, Clock
from api_auth import create_access_token, require_auth
from participant_service import resolve_participant, participant_activity_summary
from entry_service import entry_model_for_kind
from excel_import import process_workbook


api_bp = Blueprint("api", __name__, url_prefix="/api")

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

    diaper = payload.get("empty_diaper", 0)

    new_participant = Participant(name=name, last_name=last_name, phone_1=phone_1, phone_2=phone_2, empty_diaper=diaper)
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
    return jsonify({"participants": [participant_activity_summary(p) for p in participants]})

@api_bp.route("/queryCounselor", methods=["POST"])
@require_auth
def query_counselor():
    payload = request.get_json(silent=True) or {}
    # Query users (counselors). There is no `active` on User, so just query User
    query = User.query

    # Accept either `username` or `name` as a search term for the username
    username_term = payload.get("username") or payload.get("name")
    if username_term:
        query = query.filter(User.username.ilike(f"%{username_term}%"))

    if payload.get("email"):
        query = query.filter(User.email.ilike(f"%{payload.get('email')}%"))

    counselors = query.all()

    return jsonify({
        "counselors": [
            {"id": c.id, "username": c.username, "email": c.email, "active": c.active}
            for c in counselors
        ]
    })


@api_bp.patch("/updateEmptyDiaper")
@require_auth
def update_empty_diaper():
    payload = request.get_json(silent=True) or {}
    participant = resolve_participant(payload)

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404

    try:
        empty_diaper = int(payload.get("empty_diaper"))
    except (TypeError, ValueError):
        return jsonify({"error": "empty_diaper must be an integer."}), 400

    if empty_diaper < 0:
        return jsonify({"error": "empty_diaper must be zero or greater."}), 400

    participant.empty_diaper = empty_diaper
    db.session.commit()

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

    participant = resolve_participant(payload)

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

    participant = resolve_participant(payload)

    if participant is None:
        return jsonify({"error": "Participant not found."}), 404

    new_urine = Urine(participant_id=participant.id, amount=amount, note=note)
    db.session.add(new_urine)
    db.session.commit()

    return jsonify({"message": "Urine entry added successfully."}), 201

@api_bp.route("/addDiaper", methods=["POST"])
@require_auth
def add_diaper():
    payload = request.get_json(silent=True) or {}
    weight = int(payload.get("weight"))
    note = str(payload.get("note", "")).strip() or None

    participant = resolve_participant(payload)

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
    if participant is None:
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

    water_entries = Water.query.order_by(Water.created_at.desc()).limit(limit).all()
    urine_entries = Urine.query.order_by(Urine.created_at.desc()).limit(limit).all()
    diaper_entries = Diaper.query.order_by(Diaper.created_at.desc()).limit(limit).all()
    clock_entries = Clock.query.order_by(Clock.created_at.desc()).limit(limit).all()

    participant_ids = {
        entry.participant_id
        for entry in water_entries + urine_entries + diaper_entries + clock_entries
    }
    participants = Participant.query.filter(Participant.id.in_(participant_ids)).all() if participant_ids else []
    participant_by_id = {
        participant.id: participant
        for participant in participants
    }

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

    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Entry deleted successfully."})

@api_bp.post("/excelParticipantsCounselors")
@require_auth
def excel_participants_counselors():
    # Accept an uploaded Excel file (multipart/form-data, field name 'file') and
    # create Participants and Counselor Users automatically.
    upload = request.files.get("file")
    if upload is None:
        return jsonify({"error": "No file uploaded. Provide file field 'file'."}), 400
    # Delegate processing to helper that returns created/skipped counts and counselors list.
    try:
        created_participants, skipped_participants, created_counselors = process_workbook(upload)
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

    new_clock = Clock(participant_id=id)
    db.session.add(new_clock)
    db.session.commit()

    return jsonify({'message' : 'clock added', 'participant_id': id})

@api_bp.post("addClockUse")
@require_auth
def add_clock_use():
    payload = request.get_json(silent=True) or {}
    id = int(payload.get("participant_id"))

    new_clock_use = ClockUse(participant_id=id)
    db.session.add(new_clock_use)
    db.session.commit()

    return jsonify({'message' : 'clockUse added', 'participant_id': id})
