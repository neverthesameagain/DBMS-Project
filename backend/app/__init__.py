from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
from app.extensions import db, migrate, bcrypt, jwt
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import text
import os


def _require_postgres_role_enforces_rls(app):
    """Abort startup if DATABASE_URL uses a BYPASSRLS role (e.g. neondb_owner)."""
    uri = (app.config.get('SQLALCHEMY_DATABASE_URI') or '').lower()
    if 'postgres' not in uri:
        return

    with app.app_context():
        row = db.session.execute(
            text(
                """
                SELECT current_user::text AS db_user, rolbypassrls AS bypass
                FROM pg_roles
                WHERE rolname = current_user
                """
            )
        ).mappings().first()
        if row is None:
            raise RuntimeError(
                'Database RLS safety check failed: could not read pg_roles for current_user.'
            )
        if bool(row['bypass']):
            raise RuntimeError(
                'Unsafe configuration: backend is using a role that bypasses RLS '
                '(neondb_owner). Switch to splitzy_app.'
            )


def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # CORS: restrict /api/* to FRONTEND_URL (comma-separated). In production,
    # localhost defaults are not used — set FRONTEND_URL on the host.
    dev_origins = ["http://localhost:5173", "http://localhost:5174",
                   "http://127.0.0.1:5173", "http://127.0.0.1:5174"]
    env_origins = os.environ.get("FRONTEND_URL", "").strip()
    is_dev = os.environ.get("FLASK_ENV", "").lower() == "development"
    parsed = [o.strip() for o in env_origins.split(",") if o.strip()]
    if parsed:
        allowed_origins = parsed
    elif is_dev:
        allowed_origins = dev_origins
    else:
        raise RuntimeError(
            "FRONTEND_URL must be set in non-development environments (comma-separated origins)."
        )

    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True
    )

    @app.before_request
    def set_database_session_context():
        """Expose the JWT identity to PostgreSQL RLS policies."""
        if request.method == 'OPTIONS':
            return

        db.session.execute(text("SELECT set_config('app.user_id', '', false)"))
        db.session.execute(text("SELECT set_config('app.role', '', false)"))

        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
        except Exception:
            return

        if not user_id:
            return

        from app.models import User
        user = db.session.get(User, int(user_id))
        if not user or not user.is_active:
            return jsonify({"error": "Account is inactive"}), 403

        role = user.role if user else 'USER'
        db.session.execute(text("SELECT set_config('app.user_id', :uid, false)"), {"uid": str(user_id)})
        db.session.execute(text("SELECT set_config('app.role', :role, false)"), {"role": role})

    @app.teardown_request
    def clear_database_session_context(_exception=None):
        if request.method == 'OPTIONS':
            return

        if db.session.is_active:
            db.session.execute(text("SELECT set_config('app.user_id', '', false)"))
            db.session.execute(text("SELECT set_config('app.role', '', false)"))

    # ===================================================================
    # HEALTH ENDPOINT (for Render/Kubernetes health checks)
    # ===================================================================
    @app.route('/health', methods=['GET'])
    def health_check():
        """Production health endpoint for load balancers and orchestration."""
        try:
            # Check database connectivity
            db.session.execute(text('SELECT 1'))
            return jsonify({"status": "ok", "database": "connected"}), 200
        except Exception as e:
            return jsonify({"status": "error", "database": str(e)}), 503

    @app.route('/health/live', methods=['GET'])
    def liveness_probe():
        """Liveness probe: is the app running?"""
        return jsonify({"status": "alive"}), 200

    @app.route('/health/ready', methods=['GET'])
    def readiness_probe():
        """Readiness probe: is the app ready to accept traffic?"""
        try:
            db.session.execute(text('SELECT 1'))
            return jsonify({"status": "ready"}), 200
        except Exception:
            return jsonify({"status": "not_ready"}), 503

    # Register all blueprints

    from app.routes.auth_routes import auth_bp
    from app.routes.user_routes import user_bp
    from app.routes.group_routes import group_bp
    from app.routes.expense_routes import expense_bp
    from app.routes.payment_routes import payment_bp
    from app.routes.analytics_routes import analytics_bp
    from app.routes.future_routes import future_bp
    from app.routes.dashboard_routes import dashboard_bp
    from app.routes.ledger_routes import ledger_bp
    from app.routes.upi_routes import upi_bp
    from app.routes.personal_expense_routes import budget_bp
    from app.routes.admin_routes import admin_bp

    app.register_blueprint(auth_bp,      url_prefix='/api/auth')
    app.register_blueprint(user_bp,      url_prefix='/api/users')
    app.register_blueprint(group_bp,     url_prefix='/api/groups')
    app.register_blueprint(expense_bp,   url_prefix='/api')       # /api/groups/<id>/expenses
    app.register_blueprint(payment_bp,   url_prefix='/api/payments')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(future_bp,    url_prefix='/api/future-expenses')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(ledger_bp,    url_prefix='/api/ledger')
    app.register_blueprint(upi_bp,       url_prefix='/api/upi')
    app.register_blueprint(budget_bp,    url_prefix='/api/budgets')
    app.register_blueprint(admin_bp,     url_prefix='/api/admin')

    _require_postgres_role_enforces_rls(app)

    return app
