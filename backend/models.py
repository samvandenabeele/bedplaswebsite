from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db


user_camps = db.Table(
    "user_camps",
    db.Column("user_id", db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
    db.Column("camp_id", db.Integer, db.ForeignKey("camp.id", ondelete="CASCADE"), primary_key=True),
)


participant_camps = db.Table(
    "participant_camps",
    db.Column("participant_id", db.Integer, db.ForeignKey("participant.id", ondelete="CASCADE"), primary_key=True),
    db.Column("camp_id", db.Integer, db.ForeignKey("camp.id", ondelete="CASCADE"), primary_key=True),
)


class Camp(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=True)
    source_header = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    active = db.Column(db.Boolean, default=True)
    users = db.relationship("User", backref="camp", lazy=True)
    participants = db.relationship("Participant", backref="camp", lazy=True)
    member_users = db.relationship(
        "User",
        secondary=user_camps,
        back_populates="camps",
        lazy="selectin",
    )
    member_participants = db.relationship(
        "Participant",
        secondary=participant_camps,
        back_populates="camps",
        lazy="selectin",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "source_header": self.source_header,
            "start_date": self.start_date.isoformat() if self.start_date is not None else None,
            "end_date": self.end_date.isoformat() if self.end_date is not None else None,
            "created_at": self.created_at.isoformat(),
            "active": self.active,
            "participant_count": len(self.member_participants),
            "counselor_count": len(self.member_users),
        }


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    token_version = db.Column(db.Integer, nullable=False, default=0)
    password_change_required = db.Column(db.Boolean, nullable=False, default=False)
    # role: 'user' (regular counselor), 'superuser' (camp-level admin), or 'admin' (global admin)
    role = db.Column(db.String(32), nullable=False, default="user", index=True)
    camp_id = db.Column(db.Integer, db.ForeignKey("camp.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    active = db.Column(db.Boolean, default=True)
    camps = db.relationship(
        "Camp",
        secondary=user_camps,
        back_populates="member_users",
        lazy="selectin",
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        sorted_camps = sorted(self.camps, key=lambda camp: camp.id)
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": getattr(self, "role", "user"),
            "password_change_required": getattr(self, "password_change_required", False),
            "created_at": self.created_at.isoformat(),
            "camp_id": self.camp_id,
            "camp": self.camp.to_dict() if getattr(self, "camp", None) is not None else None,
            "camp_ids": [camp.id for camp in sorted_camps],
            "camps": [camp.to_dict() for camp in sorted_camps],
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
    birth_date = db.Column(db.Date, nullable=True)
    phone_1 = db.Column(db.String, unique=False, nullable=False, index=True)
    phone_2 = db.Column(db.String, unique=False, nullable=True)
    camp_id = db.Column(db.Integer, db.ForeignKey("camp.id"), nullable=True, index=True)
    date_added = db.Column(db.DateTime, unique=False, default=lambda: datetime.now(timezone.utc))
    active = db.Column(db.Boolean, default=True)
    empty_diaper = db.Column(db.Integer, nullable=False, default=0)
    note = db.Column(db.Text, nullable=True)
    camps = db.relationship(
        "Camp",
        secondary=participant_camps,
        back_populates="member_participants",
        lazy="selectin",
    )


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
    faeces = db.Column(db.Boolean, nullable=False, default=False)
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
