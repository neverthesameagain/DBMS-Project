from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import Category, PersonalExpenseSplit, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

budget_bp = Blueprint('budgets', __name__)


def _budget_wallet_guard(user_id):
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({'error': 'User not found'}), 404
    if user.role != 'USER':
        return jsonify({'error': 'Personal budgets apply only to standard user accounts.'}), 403
    return None


def _active_user_guard(user_id):
    """Any authenticated active account (used for read-only reference data)."""
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({'error': 'User not found'}), 404
    return None


def _budget_allocation_ceiling(user):
    """Caps total budgets so planning stays tied to funds (wallet or original opening)."""
    return max(float(user.current_balance or 0), float(user.opening_balance or 0))


@budget_bp.route('/categories', methods=['GET'])
@jwt_required()
def list_categories_for_budgets():
    user_id = int(get_jwt_identity())
    err = _active_user_guard(user_id)
    if err:
        return err
    cats = Category.query.order_by(Category.category_name).all()
    return jsonify([c.to_dict() for c in cats]), 200


@budget_bp.route('', methods=['GET'])
@jwt_required()
def get_budgets():
    user_id = int(get_jwt_identity())
    err = _budget_wallet_guard(user_id)
    if err:
        return err
    budgets = PersonalExpenseSplit.query.filter_by(user_id=user_id).all()
    return jsonify([b.to_dict() for b in budgets]), 200

@budget_bp.route('', methods=['POST'])
@jwt_required()
def add_budget():
    user_id = int(get_jwt_identity())
    err = _budget_wallet_guard(user_id)
    if err:
        return err
    data = request.get_json() or {}
    
    try:
        category_id = int(data.get('category_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid category_id is required'}), 400
    allocated_amount = data.get('allocated_amount')
    duration = data.get('duration', 30)
    reminder_for = data.get('reminder_for')
    
    if allocated_amount is None:
        return jsonify({'error': 'Allocated amount required'}), 400

    if not Category.query.get(category_id):
        return jsonify({'error': 'Unknown category'}), 404

    if float(allocated_amount) < 0:
        return jsonify({'error': 'Allocated amount must be non-negative'}), 400

    existing = PersonalExpenseSplit.query.filter_by(user_id=user_id, category_id=category_id).first()
    if existing:
        return jsonify({'error': 'Budget for this category already exists. Update it instead.'}), 400

    user = User.query.get(user_id)
    ceiling = _budget_allocation_ceiling(user)
    current_allocated = sum(float(b.allocated_amount) for b in user.personal_splits)
    if current_allocated + float(allocated_amount) > ceiling:
        return jsonify({
            'error': (
                f'Total budgets cannot exceed ₹{ceiling:.2f} '
                f'(higher of wallet balance and opening balance). '
                f'You already have ₹{current_allocated:.2f} allocated.'
            ),
        }), 400

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
    err = _budget_wallet_guard(user_id)
    if err:
        return err
    budget = PersonalExpenseSplit.query.filter_by(user_id=user_id, category_id=category_id).first()
    
    if not budget:
        return jsonify({'error': 'Budget not found'}), 404

    data = request.get_json() or {}
    if 'allocated_amount' in data:
        new_amount = float(data['allocated_amount'])
        if new_amount < float(budget.amount_spent or 0):
            return jsonify({'error': 'Allocated amount cannot be less than amount spent'}), 400
            
        user = User.query.get(user_id)
        ceiling = _budget_allocation_ceiling(user)
        current_allocated = sum(float(b.allocated_amount) for b in user.personal_splits)
        net_change = new_amount - float(budget.allocated_amount)
        if current_allocated + net_change > ceiling:
            return jsonify({
                'error': (
                    f'Total budgets cannot exceed ₹{ceiling:.2f} '
                    f'(higher of wallet balance and opening balance).'
                ),
            }), 400

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
    err = _budget_wallet_guard(user_id)
    if err:
        return err
    budget = PersonalExpenseSplit.query.filter_by(user_id=user_id, category_id=category_id).first()
    
    if not budget:
        return jsonify({'error': 'Budget not found'}), 404

    db.session.delete(budget)
    db.session.commit()
    return jsonify({'message': 'Budget removed successfully'}), 200
