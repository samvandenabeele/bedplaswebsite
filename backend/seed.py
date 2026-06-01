"""Seed the database with mock data for local development.

This file is intentionally a skeleton: it wires up the app context,
command-line arguments, and the main seeding stages so the actual mock-data
generation can be filled in incrementally.
"""

from __future__ import annotations

import argparse
import logging
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
    verbose: bool = False


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
        "--entries-per-day",
        type=int,
        default=10,
        help="Number of activity records to create per participant per day.",
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
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging.",
    )
    args = parser.parse_args()
    return SeedConfig(
        camps=args.camps,
        users=args.users,
        participants=args.participants,
        entries_per_participant=args.entries_per_day,
        clear_existing=args.clear_existing,
        random_seed=args.random_seed,
        verbose=args.verbose,
    )


def configure_logger(verbose: bool) -> logging.Logger:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )
    return logging.getLogger(__name__)


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


def make_activity_entries(participants: Sequence[Participant], entries_per_day: int, logger) -> list[object]:
    entries: list[object] = []
    logger.info(
        "Generating activity entries for %s participants (%s entries/day)",
        len(participants),
        entries_per_day,
    )

    for participant_index, participant in enumerate(participants, start=1):
        camp_start = participant.camps[0].start_date if getattr(participant, "camps", None) else date.today()
        camp_end = participant.camps[0].end_date if getattr(participant, "camps", None) else date.today() + timedelta(days=7)
        days = (camp_end - camp_start).days
        base_date = datetime.combine(camp_start, datetime.min.time(), tzinfo=timezone.utc)
        participant_entries_before = len(entries)

        if not getattr(participant, "camps", None):
            logger.warning(
                "Participant %s has no camp linked; using fallback range %s -> %s",
                participant.id,
                camp_start,
                camp_end,
            )

        logger.debug(
            "[%s/%s] Participant %s: generating data for %s day(s) (%s -> %s)",
            participant_index,
            len(participants),
            participant.id,
            days,
            camp_start,
            camp_end,
        )

        for day in range(days):
            for offset in range(entries_per_day):
                created_at = base_date + timedelta(days=day, hours=random.randint(10, 17), minutes=random.randint(0, 59))
                # pick a night hour between 22..23 or 0..6 (early next day)
                hour_night = random.choice([random.randint(22, 23), random.randint(0, 6)])
                night_day_offset = 1 if hour_night <= 6 else 0
                created_at_night = base_date + timedelta(days=day + night_day_offset, hours=hour_night, minutes=33)
                note_text = "Op toilet" if offset % 2 == 0 else "Onderbroek nat"

                for _ in range(random.randint(5, 10)):
                    entries.append(Water(participant_id=participant.id, meal=bool(offset % 2), created_at=created_at))
                for i in range(random.randint(5, 10)):
                    entries.append(
                        Urine(
                            participant_id=participant.id,
                            amount=random.randint(1, 5),
                            faeces=bool(offset % 3 == 0),
                            created_at=created_at + timedelta(hours=i%5),
                            note=note_text,
                        )
                    )

                if random.randint(0, 1) == 0:
                    entries.append(
                        Diaper(
                            participant_id=participant.id,
                            weight=random.randint(100, 300),
                            created_at=created_at_night,
                            note="Mock diaper entry.",
                        )
                    )
                if random.randint(0,3) == 0:
                    entries.append(
                        ClockUse(
                            participant_id=participant.id,
                            created_at=created_at_night,
                        )
                    )
                    for i in range(0, 3):
                        entries.append(Clock(participant_id=participant.id, created_at=(created_at_night + timedelta(hours=i))))

            logger.debug(
                "Participant %s day %s/%s processed; running total entries: %s",
                participant.id,
                day + 1,
                days,
                len(entries),
            )

        logger.info(
            "Participant %s complete: +%s entries",
            participant.id,
            len(entries) - participant_entries_before,
        )

    logger.info("Activity generation finished: %s total entries", len(entries))

    return entries


def seed_database(config: SeedConfig) -> None:
    logger = configure_logger(config.verbose)

    if config.random_seed is not None:
        random.seed(config.random_seed)
        logger.info("Using random seed %s", config.random_seed)

    if config.clear_existing:
        logger.info("Clearing existing data")
        clear_database()

    logger.info("Creating %s camps", config.camps)
    camps = make_camps(config.camps)
    db.session.add_all(camps)
    db.session.flush()

    logger.info("Creating %s users and %s participants", config.users, config.participants)
    users = make_users(config.users, camps)
    participants = make_participants(config.participants, camps)
    db.session.add_all(users)
    db.session.add_all(participants)
    db.session.flush()

    logger.info("Creating activity entries")
    entries = make_activity_entries(participants, config.entries_per_participant, logger)
    logger.debug("Prepared %s activity entries", len(entries))
    db.session.add_all(entries)
    db.session.commit()
    logger.info("Seeding complete")


def main() -> None:
    config = parse_args()
    with app.app_context():
        db.create_all()
        seed_database(config)


if __name__ == "__main__":
    main()