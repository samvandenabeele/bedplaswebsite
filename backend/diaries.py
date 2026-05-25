from datetime import datetime, timedelta, time

from sqlalchemy import func

from extensions import db
from models import Camp, User, Participant, Water, Urine, Diaper, Clock, ClockUse


def create_diary(participant):
	starting_date = getattr(getattr(participant, "camp", None), "start_date", None)
	ending_date = getattr(getattr(participant, "camp", None), "end_date", None)
	clock_use_count = 0

	n_days = 0
	if starting_date is not None and ending_date is not None:
		n_days = max((ending_date - starting_date).days, 0)

	for i in range(n_days):
		if starting_date is not None:
			six_pm = datetime.combine(starting_date, time(18, 0))
			six_am_next_day = six_pm + timedelta(hours=12)

			clock_use_count = db.session.query(func.count(ClockUse.id)).filter(
				ClockUse.participant_id == participant.id,
				ClockUse.created_at >= six_pm,
				ClockUse.created_at < six_am_next_day,
			).scalar() or 0

			n_clocks = db.session.query(func.count(Clock.id)).filter(
				Clock.participant_id == participant.id,
				Clock.created_at >= six_pm,
				Clock.created_at < six_am_next_day,
			)
		
			clock_used = clock_use_count % 2

			seven_thirty_am_next_day = six_pm + timedelta(hours=13, minutes=30)
			ten_pm_next_day = six_pm + timedelta(days=1, hours=4)

			urines = db.session.query(Urine).filter(
				Urine.participant_id == participant.id,
				Urine.created_at >= seven_thirty_am_next_day,
				Urine.created_at < ten_pm_next_day,
			).order_by(Urine.created_at).all()

			waters = db.session.query(Water).filter(
				Water.participant_id == participant.id,
				Water.created_at >= seven_thirty_am_next_day,
				Water.created_at < ten_pm_next_day,
			).order_by(Water.created_at).all()

	