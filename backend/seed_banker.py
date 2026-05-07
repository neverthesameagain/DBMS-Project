import sys
import os
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app import create_app
from app.extensions import db, bcrypt
from app.models import User
from sqlalchemy import text

app = create_app()

def seed_banker():
    with app.app_context():
        # Temporarily bypass RLS if active
        db.session.execute(text("SELECT set_config('app.role', 'BANKER', false)"))
        email = "banker@splitzy.com"
        user = User.query.filter_by(email=email).first()
        if user:
            print(f"Banker user {email} already exists.")
            return
        
        hashed = bcrypt.generate_password_hash("banker123").decode('utf-8')
        banker = User(
            first_name="System",
            last_name="Banker",
            email=email,
            phone_number="+910000000000",
            date_of_birth=date(1990, 1, 1),
            gender="other",
            hashed_password=hashed,
            role="BANKER"
        )
        db.session.add(banker)
        db.session.commit()
        print(f"Successfully seeded banker {email} with password banker123!")

if __name__ == "__main__":
    seed_banker()
