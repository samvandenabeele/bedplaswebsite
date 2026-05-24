from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


class Camp(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=True)
    source_header = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    active = db.Column(db.Boolean, default=True)
    users = db.relationship("User", backref="camp", lazy=True)
    participants = db.relationship("Participant", backref="camp", lazy=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "source_header": self.source_header,
            "created_at": self.created_at.isoformat(),
            "active": self.active,
            "participant_count": len(self.participants),
            "counselor_count": len(self.users),
        }


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    token_version = db.Column(db.Integer, nullable=False, default=0)
    # role: 'user' (regular counselor), 'superuser' (camp-level admin), or 'admin' (global admin)
    role = db.Column(db.String(32), nullable=False, default="user", index=True)
    camp_id = db.Column(db.Integer, db.ForeignKey("camp.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    active = db.Column(db.Boolean, default=True)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": getattr(self, "role", "user"),
            "created_at": self.created_at.isoformat(),
            "camp_id": self.camp_id,
            "camp": self.camp.to_dict() if getattr(self, "camp", None) is not None else None,
        }

    @property
    def is_admin(self) -> bool:
        return getattr(self, "role", "user") == "admin"

    @property
    def is_superuser(self) -> bool:
        return getattr(self, "role", "user") == "superuser"
    

class Participant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, unique=False, nullable=False, index=True)
    last_name = db.Column(db.String, unique=False, nullable=False, index=True)
    phone_1 = db.Column(db.String, unique=False, nullable=False, index=True)
    phone_2 = db.Column(db.String, unique=False, nullable=True)
    camp_id = db.Column(db.Integer, db.ForeignKey("camp.id"), nullable=True, index=True)
    date_added = db.Column(db.DateTime, unique=False, default=lambda: datetime.now(timezone.utc))
    active = db.Column(db.Boolean, default=True)
    empty_diaper = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.Text, nullable=True)


def default_empty_weight(context):
    participant_id = context.get_current_parameters().get("participant_id")
    if participant_id is None:
        return 0
    participant = db.session.get(Participant, participant_id)
    return participant.empty_diaper if participant and participant.empty_diaper is not None else 0

class Water(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.Integer, db.ForeignKey("participant.id"), nullable=False, index=True)
    meal = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class Urine(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.Integer, db.ForeignKey("participant.id"), nullable=False, index=True)
    amount = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    note = db.Column(db.Text, nullable=True)

class Diaper(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.Integer, db.ForeignKey("participant.id"), nullable=False, index=True)
    weight = db.Column(db.Integer, nullable=False)
    empty_weight = db.Column(db.Integer, nullable=False, default=default_empty_weight)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    note = db.Column(db.Text, nullable=True)

class Clock(db.Model):
    id=db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.Integer, db.ForeignKey("participant.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class ClockUse(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.Integer, db.ForeignKey("participant.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
