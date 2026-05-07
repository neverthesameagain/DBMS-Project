import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app import create_app
from app.extensions import db
from app.models import User
from sqlalchemy import text

app = create_app()

def promote(email):
    with app.app_context():
        # Temporarily bypass RLS if active
        db.session.execute(text("SELECT set_config('app.role', 'BANKER', false)"))
        user = User.query.filter_by(email=email).first()
        if not user:
            print(f"User {email} not found.")
            return
        
        user.role = 'BANKER'
        db.session.commit()
        print(f"Successfully promoted {email} to BANKER!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_banker.py <email>")
    else:
        promote(sys.argv[1])
