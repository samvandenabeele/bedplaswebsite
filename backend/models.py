from datetime import datetime, timezone, date
from typing import Optional

from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Table, Text, Column, event
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase

from extensions import db


# --- Association tables ---

user_camps = Table(
    "user_camps",
    db.metadata,
    Column("user_id", Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
    Column("camp_id", Integer, ForeignKey("camp.id", ondelete="CASCADE"), primary_key=True),
)

participant_camps = Table(
    "participant_camps",
    db.metadata,
    Column("participant_id", Integer, ForeignKey("participant.id", ondelete="CASCADE"), primary_key=True),
    Column("camp_id", Integer, ForeignKey("camp.id", ondelete="CASCADE"), primary_key=True),
)


# --- Models ---

class Camp(db.Model):
    __tablename__ = "camp"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_header: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Legacy single-FK relationships (kept for backward compatibility)
    users: Mapped[list["User"]] = relationship("User", back_populates="camp", lazy="select")
    participants: Mapped[list["Participant"]] = relationship("Participant", back_populates="camp", lazy="select")

    # Many-to-many relationships
    member_users: Mapped[list["User"]] = relationship(
        secondary=user_camps,
        back_populates="camps",
        lazy="selectin",
    )
    member_participants: Mapped[list["Participant"]] = relationship(
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
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(120), unique=True, nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    password_change_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # role: 'user' (regular counselor), 'superuser' (camp-level admin), or 'admin' (global admin)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="user", index=True)
    camp_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("camp.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Legacy single-FK relationship
    camp: Mapped[Optional["Camp"]] = relationship("Camp", back_populates="users", foreign_keys=[camp_id])

    # Many-to-many relationship
    camps: Mapped[list["Camp"]] = relationship(
        secondary=user_camps,
        back_populates="member_users",
        lazy="selectin",
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self) -> dict:
        sorted_camps = sorted(self.camps, key=lambda c: c.id)
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "password_change_required": self.password_change_required,
            "created_at": self.created_at.isoformat(),
            "camp_id": self.camp_id,
            "camp": self.camp.to_dict() if self.camp is not None else None,
            "camp_ids": [c.id for c in sorted_camps],
            "camps": [c.to_dict() for c in sorted_camps],
        }

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_superuser(self) -> bool:
        return self.role == "superuser"


class Participant(db.Model):
    __tablename__ = "participant"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, index=True)
    last_name: Mapped[str] = mapped_column(String, index=True)
    birth_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    phone_1: Mapped[str] = mapped_column(String, index=True)
    phone_2: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    camp_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("camp.id"), nullable=True, index=True)
    date_added: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    empty_diaper: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Legacy single-FK relationship
    camp: Mapped[Optional["Camp"]] = relationship("Camp", back_populates="participants", foreign_keys=[camp_id])

    # Many-to-many relationship
    camps: Mapped[list["Camp"]] = relationship(
        "Camp",
        secondary=participant_camps,
        back_populates="member_participants",
        lazy="selectin",
    )


def _default_empty_weight(context) -> int:
    participant_id = context.get_current_parameters().get("participant_id")
    if participant_id is None:
        return 0
    participant = db.session.get(Participant, participant_id)
    return participant.empty_diaper if participant and participant.empty_diaper is not None else 0


class Water(db.Model):
    __tablename__ = "water"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("participant.id"), nullable=False, index=True)
    meal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Urine(db.Model):
    __tablename__ = "urine"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("participant.id"), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    faeces: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Diaper(db.Model):
    __tablename__ = "diaper"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("participant.id"), nullable=False, index=True)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)
    empty_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=_default_empty_weight)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Clock(db.Model):
    __tablename__ = "clock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("participant.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ClockUse(db.Model):
    __tablename__ = "clockuse"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("participant.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )