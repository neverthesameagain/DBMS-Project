from flask import Blueprint, request, jsonify
from app.models import User
from app.extensions import db, bcrypt
from datetime import datetime

user_bp = Blueprint('users', __name__)


# Alias so Signup.jsx POST /api/users/create works
@user_bp.route('/create', methods=['POST'])
def create_user():
    data = request.get_json()

    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({"error": "Email already registered"}), 409

    if User.query.filter_by(phone_number=data.get('phone_number')).first():
        return jsonify({"error": "Phone number already registered"}), 409

    hashed_pw = bcrypt.generate_password_hash(data.get('password')).decode('utf-8')

    dob = None
    if data.get('date_of_birth'):
        try:
            dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
        except ValueError:
            pass

    new_user = User(
        first_name=data.get('first_name'),
        last_name=data.get('last_name'),
        email=data.get('email'),
        phone_number=data.get('phone_number'),
        date_of_birth=dob,
        gender=data.get('gender'),
        hashed_password=hashed_pw,
        opening_balance=float(data.get('opening_balance') or 0.0),
        current_balance=float(data.get('opening_balance') or 0.0),
    )

    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created successfully", "user_id": new_user.user_id}), 201


@user_bp.route('/search', methods=['GET'])
def search_users():
    """Search users by email or phone — used for adding group members."""
    query = request.args.get('q', '')
    if not query or len(query) < 3:
        return jsonify([]), 200

    users = User.query.filter(
        User.is_active.is_(True),
        (User.email.ilike(f'%{query}%')) | (User.phone_number.ilike(f'%{query}%'))
    ).limit(10).all()

    return jsonify([u.to_dict() for u in users]), 200
