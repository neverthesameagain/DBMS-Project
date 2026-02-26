from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

# Verify DB connection on startup
with app.app_context():
    try:
        db.session.execute(text('SELECT 1'))
        print('\n✅  Connected to database successfully\n')
    except Exception as e:
        print(f'\n❌  Database connection FAILED: {e}\n')

if __name__ == '__main__':
    app.run(debug=True)