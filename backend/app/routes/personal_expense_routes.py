from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import PersonalExpenseSplit, Category, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

budget_bp = Blueprint('budgets', __name__)

@budget_bp.route('', methods=['GET'])
@jwt_required()
def get_budgets():
    user_id = int(get_jwt_identity())
    budgets = PersonalExpenseSplit.query.filter_by(user_id=user_id).all()
    return jsonify([b.to_dict() for b in budgets]), 200

@budget_bp.route('', methods=['POST'])
@jwt_required()
def add_budget():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    
    category_id = data.get('category_id')
    allocated_amount = data.get('allocated_amount')
    duration = data.get('duration', 30)
    reminder_for = data.get('reminder_for')
    
    if not category_id or allocated_amount is None:
        return jsonify({'error': 'Category ID and allocated amount required'}), 400

    if float(allocated_amount) < 0:
        return jsonify({'error': 'Allocated amount must be non-negative'}), 400

    existing = PersonalExpenseSplit.query.filter_by(user_id=user_id, category_id=category_id).first()
    if existing:
        return jsonify({'error': 'Budget for this category already exists. Update it instead.'}), 400

    user = User.query.get(user_id)
    current_allocated = sum(float(b.allocated_amount) for b in user.personal_splits)
    if current_allocated + float(allocated_amount) > float(user.current_balance or 0):
        return jsonify({'error': f'Total allocated budgets cannot exceed your current balance of ₹{user.current_balance}'}), 400

    new_budget = PersonalExpenseSplit(
        user_id=user_id,
        category_id=category_id,
        allocated_amount=allocated_amount,
        amount_spent=0,
        duration=duration
    )
    if reminder_for:
        new_budget.reminder_for = datetime.strptime(reminder_for, '%Y-%m-%d').date()

    db.session.add(new_budget)
    db.session.commit()

    return jsonify(new_budget.to_dict()), 201

@budget_bp.route('/<int:category_id>', methods=['PUT'])
@jwt_required()
def update_budget(category_id):
    user_id = int(get_jwt_identity())
    budget = PersonalExpenseSplit.query.filter_by(user_id=user_id, category_id=category_id).first()
    
    if not budget:
        return jsonify({'error': 'Budget not found'}), 404

    data = request.get_json()
    if 'allocated_amount' in data:
        new_amount = float(data['allocated_amount'])
        if new_amount < float(budget.amount_spent or 0):
            return jsonify({'error': 'Allocated amount cannot be less than amount spent'}), 400
            
        user = User.query.get(user_id)
        current_allocated = sum(float(b.allocated_amount) for b in user.personal_splits)
        net_change = new_amount - float(budget.allocated_amount)
        if current_allocated + net_change > float(user.current_balance or 0):
            return jsonify({'error': f'Updating this budget would exceed your current balance of ₹{user.current_balance}'}), 400

        budget.allocated_amount = new_amount

    if 'duration' in data:
        budget.duration = data['duration']
    
    if 'reminder_for' in data:
        budget.reminder_for = datetime.strptime(data['reminder_for'], '%Y-%m-%d').date()

    db.session.commit()
    return jsonify(budget.to_dict()), 200

@budget_bp.route('/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_budget(category_id):
    user_id = int(get_jwt_identity())
    budget = PersonalExpenseSplit.query.filter_by(user_id=user_id, category_id=category_id).first()
    
    if not budget:
        return jsonify({'error': 'Budget not found'}), 404

    db.session.delete(budget)
    db.session.commit()
    return jsonify({'message': 'Budget removed successfully'}), 200
