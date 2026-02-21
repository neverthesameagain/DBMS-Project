from flask import Blueprint, request, jsonify
from app.models import FutureExpense, Category
from app.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

future_bp = Blueprint('future', __name__)


@future_bp.route('', methods=['GET'])
@jwt_required()
def get_future_expenses():
    current_user_id = int(get_jwt_identity())
    items = FutureExpense.query.filter_by(user_id=current_user_id).order_by(FutureExpense.expected_date).all()
    return jsonify([i.to_dict() for i in items]), 200


@future_bp.route('', methods=['POST'])
@jwt_required()
def create_future_expense():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    amount = float(data.get('estimated_amount', 0))
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    # Resolve category
    category_name = data.get('category', 'General')
    cat = Category.query.filter_by(category_name=category_name).first()
    category_id = cat.category_id if cat else None

    expected_date = None
    if data.get('due_date'):
        try:
            expected_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    item = FutureExpense(
        user_id=current_user_id,
        category_id=category_id,
        estimated_amount=amount,
        expected_date=expected_date,
        status='PLANNED',
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@future_bp.route('/<int:future_id>', methods=['PATCH'])
@jwt_required()
def update_future_expense(future_id):
    current_user_id = int(get_jwt_identity())
    item = FutureExpense.query.filter_by(future_expense_id=future_id, user_id=current_user_id).first()
    if not item:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json()
    if 'status' in data:
        item.status = data['status']  # PLANNED | PAID | CANCELLED
    if 'is_completed' in data and data['is_completed']:
        item.status = 'PAID'
    if 'estimated_amount' in data:
        item.estimated_amount = float(data['estimated_amount'])

    db.session.commit()
    return jsonify(item.to_dict()), 200


@future_bp.route('/<int:future_id>', methods=['DELETE'])
@jwt_required()
def delete_future_expense(future_id):
    current_user_id = int(get_jwt_identity())
    item = FutureExpense.query.filter_by(future_expense_id=future_id, user_id=current_user_id).first()
    if not item:
        return jsonify({"error": "Not found"}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200
