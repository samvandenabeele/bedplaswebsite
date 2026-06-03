import os

from flask import Flask, jsonify, request, send_from_directory
from sqlalchemy.exc import SQLAlchemyError

from config import Config
from extensions import db, migrate
from routes import api_bp


def create_app(config_class=Config):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    app.logger.setLevel(os.getenv("DEBUG_LEVEL", "WARNING"))
    if app.debug:
        app.logger.setLevel("DEBUG")

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

    return app


def bootstrap_database(app: Flask) -> None:
    with app.app_context():
        # Ensure the database schema exists before any startup bootstrap queries run.
        # This is intentionally executed once, outside the Gunicorn worker model.
        db.create_all()

        # Create a default user from environment variables if provided.
        default_username = os.environ.get("DEFAULT_USER_USERNAME")
        default_password = os.environ.get("DEFAULT_USER_PASSWORD")
        default_email = os.environ.get("DEFAULT_USER_EMAIL")

        if default_username and default_password:
            try:
                from models import User

                default_role = os.environ.get("DEFAULT_USER_ROLE", "admin")
                existing = db.session.query(User.id).filter_by(username=default_username).first()
                if existing is None:
                    user = User(username=default_username, email=default_email or None)
                    user.set_password(default_password)
                    try:
                        user.role = default_role
                    except Exception:
                        pass
                    db.session.add(user)
                    db.session.commit()
                    app.logger.info("Created default user '%s' with role '%s'", default_username, default_role)
                else:
                    app.logger.info("Default user '%s' already exists; skipping bootstrap creation.", default_username)
            except SQLAlchemyError:
                db.session.rollback()
                app.logger.warning(
                    "Skipping creation of default user '%s' because the database schema is not ready.",
                    default_username,
                )


app = create_app()


if __name__ == "__main__":
    bootstrap_database(app)
    app.run(
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        debug=os.environ.get("FLASK_DEBUG", "1") == "1",
    )