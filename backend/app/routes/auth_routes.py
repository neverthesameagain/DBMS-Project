from flask import Blueprint, request, jsonify
from app.models import User
from app.extensions import db, bcrypt, jwt
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

# In-memory blocklist for invalidated JWT tokens (JTIs)
_token_blocklist: set[str] = set()

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    return jwt_payload["jti"] in _token_blocklist


@auth_bp.route('/signup', methods=['POST'])
def signup():
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


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email, is_active=True).first()

    if user and bcrypt.check_password_hash(user.hashed_password, password):
        access_token = create_access_token(identity=str(user.user_id))
        return jsonify({"access_token": access_token, "user": user.to_dict()}), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    if not user or not user.is_active:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    _token_blocklist.add(jti)
    return jsonify({"message": "Successfully logged out"}), 200
