from extensions import db
from models import Water, Urine, Diaper, Clock


def entry_model_for_kind(kind: str):
    if kind == "water":
        return Water
    if kind == "urine":
        return Urine
    if kind == "diaper":
        return Diaper
    if kind == "clock":
        return Clock
    return None
