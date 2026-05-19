import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy import text

from config import Config
from extensions import db
from routes import api_bp


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    db.init_app(app)
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
            participant_columns = {
                "date_added": "ALTER TABLE participant ADD COLUMN date_added DATETIME",
                "active": "ALTER TABLE participant ADD COLUMN active BOOLEAN NOT NULL DEFAULT 1",
                "empty_diaper": "ALTER TABLE participant ADD COLUMN empty_diaper INTEGER NOT NULL DEFAULT 0",
                "note": "ALTER TABLE participant ADD COLUMN note TEXT",
            }

            added_column = False
            for column_name, ddl in participant_columns.items():
                if column_name not in existing_columns:
                    db.session.execute(text(ddl))
                    added_column = True

            if added_column:
                db.session.commit()

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        debug=os.environ.get("FLASK_DEBUG", "1") == "1",
    )