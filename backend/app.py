import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from config import Config
from extensions import db, migrate
from routes import api_bp


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    db.init_app(app)
    # Initialize Flask-Migrate
    migrate.init_app(app, db)
    app.register_blueprint(api_bp)

    allowed_origins = {
        origin.strip()
        for origin in app.config.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    }

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return response

    @app.route("/api")
    def api_root():
        return jsonify({"message": "BedPlas API"})

    with app.app_context():
        db.create_all()

        if app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite"):
            existing_columns = {
                row[1]
                for row in db.session.execute(text("PRAGMA table_info(participant)"))
            }
            existing_camp_columns = {
                row[1]
                for row in db.session.execute(text("PRAGMA table_info(camp)"))
            }
            existing_user_columns = {
                row[1]
                for row in db.session.execute(text("PRAGMA table_info(user)"))
            }
            camp_columns = {
                "start_date": "ALTER TABLE camp ADD COLUMN start_date DATE",
                "end_date": "ALTER TABLE camp ADD COLUMN end_date DATE",
            }
            participant_columns = {
                "date_added": "ALTER TABLE participant ADD COLUMN date_added DATETIME",
                "active": "ALTER TABLE participant ADD COLUMN active BOOLEAN NOT NULL DEFAULT 1",
                "empty_diaper": "ALTER TABLE participant ADD COLUMN empty_diaper INTEGER NOT NULL DEFAULT 0",
                "note": "ALTER TABLE participant ADD COLUMN note TEXT",
                "camp_id": "ALTER TABLE participant ADD COLUMN camp_id INTEGER",
            }
            user_columns = {
                "camp_id": "ALTER TABLE user ADD COLUMN camp_id INTEGER",
                # role column for role-based permissions; default to 'user' for existing rows
                "role": "ALTER TABLE user ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
            }

            added_column = False
            for column_name, ddl in camp_columns.items():
                if column_name not in existing_camp_columns:
                    db.session.execute(text(ddl))
                    added_column = True

            for column_name, ddl in participant_columns.items():
                if column_name not in existing_columns:
                    db.session.execute(text(ddl))
                    added_column = True

            for column_name, ddl in user_columns.items():
                if column_name not in existing_user_columns:
                    db.session.execute(text(ddl))
                    added_column = True

            if added_column:
                db.session.commit()

        # Create a default user from environment variables if provided.
        # This is useful for local development so an admin user exists.
        default_username = os.environ.get("DEFAULT_USER_USERNAME")
        default_password = os.environ.get("DEFAULT_USER_PASSWORD")
        default_email = os.environ.get("DEFAULT_USER_EMAIL")

        if default_username and default_password:
            try:
                from models import User

                # Default the bootstrap account to admin unless an explicit role is provided.
                default_role = os.environ.get("DEFAULT_USER_ROLE", "admin")

                existing = User.query.filter_by(username=default_username).first()
                if existing is None:
                    user = User(username=default_username, email=default_email or None)
                    user.set_password(default_password)
                    # set role if model supports it
                    try:
                        user.role = default_role
                    except Exception:
                        # ignore if attribute missing
                        pass
                    db.session.add(user)
                    db.session.commit()
                    app.logger.info("Created default user '%s' with role '%s'", default_username, default_role)
                elif getattr(existing, "role", None) != default_role:
                    try:
                        existing.role = default_role
                    except Exception:
                        pass
                    db.session.commit()
                    app.logger.info("Updated default user '%s' to role '%s'", default_username, default_role)
            except OperationalError:
                # If the DB schema is not yet in sync (e.g. running migrations), skip creating
                # the default user to avoid breaking CLI commands like `flask db migrate`.
                app.logger.warning(
                    "Skipping creation of default user '%s' because the database schema is not ready.",
                    default_username,
                )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        debug=os.environ.get("FLASK_DEBUG", "1") == "1",
    )