from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    token_version = db.Column(db.Integer, nullable=False, default=0)
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
            "created_at": self.created_at.isoformat(),
        }
    

class Participant(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, unique=False, nullable=False, index=True)
    last_name = db.Column(db.String, unique=False, nullable=False, index=True)
    phone_1 = db.Column(db.String, unique=False, nullable=False, index=True)
    phone_2 = db.Column(db.String, unique=False, nullable=True)
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
