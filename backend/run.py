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
    import os
    debug_mode = os.getenv('FLASK_ENV') == 'development'
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.getenv('PORT', 5001)))