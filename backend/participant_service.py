from datetime import datetime, timedelta

from sqlalchemy import func

from extensions import db
from models import Participant, Water, Urine, ClockUse


def resolve_participant(payload: dict, camp_id: int | None = None):
    participant_id = payload.get("participant_id")
    if participant_id is not None and str(participant_id).strip() != "":
        try:
            participant = db.session.get(Participant, int(participant_id))
        except (TypeError, ValueError):
            participant = None
        if participant is not None and (camp_id is None or participant.camp_id == camp_id):
            return participant
        return None

    name = str(payload.get("name", "")).strip()
    last_name = str(payload.get("last_name", "")).strip()

    if not name or not last_name:
        return None

    query = Participant.query.filter(
        Participant.name == name,
        Participant.last_name == last_name,
    )
    if camp_id is not None:
        query = query.filter(Participant.camp_id == camp_id)

    return query.first()


def participant_activity_summary(p: Participant):
    today = func.current_date()
    now = datetime.now()
    cutoff_date = now.date() if now.hour >= 18 else now.date() - timedelta(days=1)
    six_pm_today = datetime.combine(cutoff_date, datetime.min.time()).replace(hour=18)

    drank_today = db.session.query(func.count(Water.id)).filter(
        Water.participant_id == p.id,
        func.date(Water.created_at) == today,
    ).scalar()

    peed_today = db.session.query(func.coalesce(func.sum(Urine.amount), 0)).filter(
        Urine.participant_id == p.id,
        func.date(Urine.created_at) == today,
    ).scalar()

    largest_pee = db.session.query(func.coalesce(func.max(Urine.amount), 0)).filter(
        Urine.participant_id == p.id
    ).scalar()

    clock_count = db.session.query(func.count(ClockUse.id)).filter(
        ClockUse.participant_id == p.id,
        ClockUse.created_at >= six_pm_today,
    ).scalar()

    return {
        "id": p.id,
        "name": p.name,
        "last_name": p.last_name,
        "birth_date": p.birth_date.isoformat() if getattr(p, "birth_date", None) is not None else None,
        "phone_1": p.phone_1,
        "phone_2": p.phone_2,
        "camp_id": p.camp_id,
        "camp_code": p.camp.code if getattr(p, "camp", None) is not None else None,
        "camp_name": p.camp.name if getattr(p, "camp", None) is not None else None,
        "empty_diaper": p.empty_diaper,
        "drank_today": drank_today,
        "peed_today": peed_today,
        "largest_pee": largest_pee,
        "active": p.active,
        "clock": clock_count % 2 == 1,
    }
