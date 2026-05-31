"""Seed the database with mock data for local development.

This file is intentionally a skeleton: it wires up the app context,
command-line arguments, and the main seeding stages so the actual mock-data
generation can be filled in incrementally.
"""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Sequence

from app import app
from extensions import db
from models import Camp, Clock, ClockUse, Diaper, Participant, Urine, User, Water, participant_camps, user_camps


@dataclass(frozen=True)
class SeedConfig:
    camps: int = 3
    users: int = 8
    participants: int = 30
    entries_per_participant: int = 10
    clear_existing: bool = False
    random_seed: int | None = 42


def parse_args() -> SeedConfig:
    parser = argparse.ArgumentParser(description="Seed the database with mock data.")
    parser.add_argument("--camps", type=int, default=3, help="Number of mock camps to create.")
    parser.add_argument("--users", type=int, default=8, help="Number of mock users to create.")
    parser.add_argument(
        "--participants",
        type=int,
        default=30,
        help="Number of mock participants to create.",
    )
    parser.add_argument(
        "--entries-per-participant",
        type=int,
        default=10,
        help="Number of activity records to create per participant.",
    )
    parser.add_argument(
        "--clear-existing",
        action="store_true",
        help="Delete existing rows before seeding.",
    )
    parser.add_argument(
        "--random-seed",
        type=int,
        default=42,
        help="Seed used for deterministic mock data.",
    )
    args = parser.parse_args()
    return SeedConfig(
        camps=args.camps,
        users=args.users,
        participants=args.participants,
        entries_per_participant=args.entries_per_participant,
        clear_existing=args.clear_existing,
        random_seed=args.random_seed,
    )


def clear_database() -> None:
    """Remove existing seeded data.

    Keep this implementation conservative so the script can be extended safely.
    """

    db.session.execute(participant_camps.delete())
    db.session.execute(user_camps.delete())
    for model in (Water, Urine, Diaper, ClockUse, Clock, Participant, User, Camp):
        db.session.query(model).delete()
    db.session.commit()


def make_camps(count: int) -> list[Camp]:
    camps: list[Camp] = []
    today = date.today()

    for index in range(count):
        camp = Camp(
            code=f"CAMP-{index + 1:03d}",
            name=f"Mock Camp {index + 1}",
            source_header="Mock import data",
            start_date=today + timedelta(days=index * 7),
            end_date=today + timedelta(days=index * 7 + 7),
            active=True,
        )
        camps.append(camp)

    return camps


def make_users(count: int, camps: Sequence[Camp]) -> list[User]:
    users: list[User] = []

    for index in range(count):
        user = User(
            username=f"mock.user.{index + 1}",
            email=f"mock.user.{index + 1}@example.com",
            role="user",
            password_change_required=False,
            active=True,
        )
        user.set_password("password123")
        if camps:
            user.camps.append(camps[index % len(camps)])
        users.append(user)

    return users


def make_participants(count: int, camps: Sequence[Camp]) -> list[Participant]:
    participants: list[Participant] = []

    for index in range(count):
        participant = Participant(
            name=f"Participant{index + 1}",
            last_name=f"Mock{index + 1}",
            phone_1=f"+32 470 00 {index + 1:04d}",
            phone_2=None,
            birth_date=date(2010, 1, 1) + timedelta(days=index * 37),
            camp_id=camps[index % len(camps)].id if camps else None, 
            active=True,
            empty_diaper=random.randint(0, 30),
            note="Mock participant created by the seeder.",
        )
        if camps:
            participant.camps.append(camps[index % len(camps)])
        participants.append(participant)

    return participants


def make_activity_entries(participants: Sequence[Participant], entries_per_participant: int) -> list[object]:
    entries: list[object] = []

    for participant in participants:
        for offset in range(entries_per_participant):
            created_at = datetime.now(timezone.utc).replace(hour=11, minute=32) - timedelta(days=offset)
            created_at_night = datetime.now(timezone.utc).replace(hour=22, minute=0, second=0, microsecond=0) - timedelta(days=offset)
            note_text = "Op toilet" if offset % 2 == 0 else "Onderbroek nat"
            choice = offset % 5
            if choice == 0:
                entries.append(Water(participant_id=participant.id, meal=bool(offset % 2), created_at=created_at))
            elif choice == 1:
                entries.append(
                    Urine(
                        participant_id=participant.id,
                        amount=random.randint(1, 5),
                        faeces=bool(offset % 3 == 0),
                        created_at=created_at,
                        note=note_text,
                    )
                )
            elif choice == 2:
                entries.append(
                    Diaper(
                        participant_id=participant.id,
                        weight=random.randint(100, 300),
                        created_at=created_at_night,
                        note="Mock diaper entry.",
                    )
                )
            elif choice == 3:
                entries.append(Clock(participant_id=participant.id, created_at=created_at_night))
            else:
                entries.append(
                    ClockUse(
                        participant_id=participant.id,
                        created_at=created_at_night,
                    )
                )

    return entries


def seed_database(config: SeedConfig) -> None:
    if config.random_seed is not None:
        random.seed(config.random_seed)

    if config.clear_existing:
        clear_database()

    camps = make_camps(config.camps)
    db.session.add_all(camps)
    db.session.flush()

    users = make_users(config.users, camps)
    participants = make_participants(config.participants, camps)
    db.session.add_all(users)
    db.session.add_all(participants)
    db.session.flush()

    entries = make_activity_entries(participants, config.entries_per_participant)
    db.session.add_all(entries)
    db.session.commit()


def main() -> None:
    config = parse_args()
    with app.app_context():
        db.create_all()
        seed_database(config)


if __name__ == "__main__":
    main()