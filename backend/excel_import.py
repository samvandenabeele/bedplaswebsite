import re

from extensions import db
from models import Camp, Participant, User


def _extract_camp_metadata(wb):
    header = ""

    for sheet_name in wb.sheetnames:
        value = wb[sheet_name]["A1"].value
        if value:
            header = str(value).strip()
            if header:
                break

    if not header:
        return None

    code_match = re.search(r"\(vakantiecode\s+([^)]+)\)\s*$", header, flags=re.IGNORECASE)
    if code_match is None:
        return None

    code = code_match.group(1).strip()
    name = re.sub(r"\s*\(vakantiecode\s+[^)]+\)\s*$", "", header, flags=re.IGNORECASE).strip() or None

    camp = Camp.query.filter_by(code=code).first()
    if camp is None:
        camp = Camp(code=code, name=name, source_header=header)
        db.session.add(camp)
    else:
        if name and not camp.name:
            camp.name = name
        if not camp.source_header:
            camp.source_header = header

    db.session.flush()

    return camp


def process_workbook(upload):
    # import lazily so callers can return a helpful error if openpyxl isn't installed
    try:
        from openpyxl import load_workbook
    except Exception:
        raise

    # upload is a FileStorage-like object
    wb = load_workbook(filename=upload, data_only=True)
    camp = _extract_camp_metadata(wb)
    camp_id = camp.id if camp is not None else None

    created_participants = 0
    skipped_participants = 0
    created_counselors = []

    def _cell_str(sheet, row, col):
        v = sheet.cell(row=row, column=col).value
        return str(v).strip() if v is not None else ""

    # Process Participants from 'Deelnemers' sheet
    if "Deelnemers" in wb.sheetnames:
        sheet = wb["Deelnemers"]
        row = 11
        while True:
            first = _cell_str(sheet, row, 4)  # D
            last = _cell_str(sheet, row, 5)   # E
            phone_k = _cell_str(sheet, row, 11)  # K
            phone_l = _cell_str(sheet, row, 12)  # L

            if not first and not last:
                # assume end when blank name reached
                break

            if not first or not last:
                skipped_participants += 1
                row += 1
                continue

            phone_1 = phone_k or phone_l
            phone_2 = phone_l if phone_k else ""

            # Try find existing participant by name
            existing = Participant.query.filter(
                Participant.name == first,
                Participant.last_name == last,
            )
            if camp_id is not None:
                existing = existing.filter(Participant.camp_id == camp_id)

            existing = existing.first()

            if existing is None:
                if not phone_1:
                    # require at least one phone to create
                    skipped_participants += 1
                else:
                    new_p = Participant(name=first, last_name=last, phone_1=phone_1, phone_2=phone_2, camp_id=camp_id)
                    db.session.add(new_p)
                    created_participants += 1
            row += 1

    # Process Counselors from 'Vrijwilligers' sheet
    if "Vrijwilligers" in wb.sheetnames:
        sheet = wb["Vrijwilligers"]
        row = 11
        import secrets

        while True:
            func_val = _cell_str(sheet, row, 2)  # B
            first = _cell_str(sheet, row, 4)     # D
            last = _cell_str(sheet, row, 5)      # E
            email = _cell_str(sheet, row, 13)    # M

            if not first and not last and not func_val and not email:
                break

            # Only add counselors where function is 'Monitor' or contains 'VV'
            func_check = func_val.lower()
            if "monitor" in func_check or "vv" in func_check:
                # Determine username
                base_username = f"{first}.{last}".lower().replace(" ", "")
                username = base_username
                suffix = 1
                while User.query.filter_by(username=username).first() is not None:
                    suffix += 1
                    username = f"{base_username}{suffix}"

                # Only create if email or username not already present
                if User.query.filter_by(email=email).first() is None and User.query.filter_by(username=username).first() is None:
                    pwd = secrets.token_urlsafe(10)
                    u = User(username=username, email=email or None, camp_id=camp_id)
                    u.set_password(pwd)
                    db.session.add(u)
                    created_counselors.append({"username": username, "email": email, "password": pwd})

            row += 1

    # Commit is left to caller
    return created_participants, skipped_participants, created_counselors
