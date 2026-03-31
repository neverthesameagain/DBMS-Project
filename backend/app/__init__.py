from flask import Flask
from flask_cors import CORS
from config import Config
from app.extensions import db, migrate, bcrypt, jwt
import os


def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # Enable CORS for all /api/* routes from the Vite dev server
    # Support comma-separated list in FRONTEND_URL env var
    default_origins = ["http://localhost:5173", "http://localhost:5174",
                       "http://127.0.0.1:5173", "http://127.0.0.1:5174"]
    env_origins = os.environ.get("FRONTEND_URL", "")
    allowed_origins = (
        [o.strip() for o in env_origins.split(",") if o.strip()]
        or default_origins
    )

    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        supports_credentials=True
    )

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

    return app