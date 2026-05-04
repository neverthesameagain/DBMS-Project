from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Payment, Transaction, ExpenseSplitGroup, now
from app.extensions import db
from sqlalchemy import text
from functools import wraps
from decimal import Decimal

banker_bp = Blueprint('banker', __name__)

def banker_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or user.role != 'BANKER':
            return jsonify({"error": "Access denied. Banker role required."}), 403
        return fn(*args, **kwargs)
    return wrapper

@banker_bp.route('/banker/users', methods=['GET'])
@banker_required
def get_all_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

@banker_bp.route('/banker/debts', methods=['GET'])
@banker_required
def get_global_debts():
    """Return all active debts in the system."""
    rows = ExpenseSplitGroup.query.filter_by(is_settled=False).all()
    debts = []
    for r in rows:
        if r.paid_by != r.paid_for:
            payer = User.query.get(r.paid_by)
            debtor = User.query.get(r.paid_for)
            debts.append({
                'expense_id': r.expense_id,
                'group_id': r.group_id,
                'amount': float(r.amount),
                'description': r.description,
                'payer_id': r.paid_by,
                'payer_name': f"{payer.first_name} {payer.last_name}" if payer else "Unknown",
                'debtor_id': r.paid_for,
                'debtor_name': f"{debtor.first_name} {debtor.last_name}" if debtor else "Unknown",
                'created_at': r.created_at.isoformat() if r.created_at else None
            })
    return jsonify(debts), 200

@banker_bp.route('/banker/funds', methods=['POST'])
@banker_required
def manage_funds():
    """Add or remove funds from a user's account."""
    data = request.json
    banker_id = int(get_jwt_identity())
    target_id = data.get('target_user_id')
    action = data.get('action') # 'ADD' or 'REMOVE'
    amount = data.get('amount')

    if not target_id or action not in ['ADD', 'REMOVE']:
        return jsonify({"error": "Invalid target or action"}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({"error": "Amount must be positive"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    try:
        # Lock target user
        user_row = db.session.execute(
            text("SELECT current_balance FROM users WHERE user_id = :uid FOR UPDATE"),
            {"uid": target_id}
        ).fetchone()

        if not user_row:
            db.session.rollback()
            return jsonify({"error": "Target user not found"}), 404

        target_user = User.query.get(target_id)
        
        # Record Transaction First
        txn = Transaction(
            transaction_type='PAYMENT',
            reference_id=0, # Will update after payment
            amount=amount
        )
        db.session.add(txn)
        db.session.flush()

        if action == 'REMOVE':
            if float(target_user.current_balance) < amount:
                db.session.rollback()
                return jsonify({"error": "Insufficient balance for removal"}), 400
            # Banker takes money from user
            payment = Payment(
                from_user_id=target_id,
                to_user_id=banker_id,
                amount=amount,
                payment_type='PERSONAL',
                status='COMPLETED',
                note=data.get('note', f"Banker {action}"),
                transaction_id=txn.transaction_id
            )
        else:
            # Banker gives money to user
            payment = Payment(
                from_user_id=banker_id,
                to_user_id=target_id,
                amount=amount,
                payment_type='PERSONAL',
                status='COMPLETED',
                note=data.get('note', f"Banker {action}"),
                transaction_id=txn.transaction_id
            )

        db.session.add(payment)
        db.session.flush()
        
        txn.reference_id = payment.payment_id

        db.session.commit()
        # Retrieve fresh balance from DB since triggers updated it
        db.session.refresh(target_user)
        return jsonify({"message": f"Successfully {action}ed funds", "new_balance": float(target_user.current_balance)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@banker_bp.route('/banker/logs', methods=['GET'])
@banker_required
def get_banker_logs():
    """Fetch all banker actions (BANKER_ADD, BANKER_REMOVE)."""
    logs = Payment.query.filter(Payment.payment_type.in_(['BANKER_ADD', 'BANKER_REMOVE'])).order_by(Payment.created_at.desc()).all()
    return jsonify([p.to_dict() for p in logs]), 200
