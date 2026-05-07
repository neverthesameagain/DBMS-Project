from flask import Blueprint, jsonify
from app.models import ExpenseSplitGroup, GroupMember, Payment, User
from app.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    # You owe: rows where paid_by != you, paid_for == you, not settled
    owed_rows = ExpenseSplitGroup.query.filter_by(paid_for=current_user_id, is_settled=False).all()
    you_owe = sum(float(r.amount or 0) for r in owed_rows if r.paid_by != current_user_id)

    # You are owed: rows where paid_by == you, paid_for != you, not settled
    paid_rows = ExpenseSplitGroup.query.filter_by(paid_by=current_user_id, is_settled=False).all()
    you_are_owed = sum(float(r.amount or 0) for r in paid_rows if r.paid_for != current_user_id)

    # Monthly spend: your personal liability (what you owe others for expenses)
    now = datetime.now(timezone.utc)
    monthly_rows = ExpenseSplitGroup.query.filter(
        ExpenseSplitGroup.paid_for == current_user_id,
        db.extract('month', ExpenseSplitGroup.created_at) == now.month,
        db.extract('year',  ExpenseSplitGroup.created_at) == now.year,
    ).all()
    monthly_spend = sum(float(r.amount or 0) for r in monthly_rows)

    category_breakdown = {}
    for r in monthly_rows:
        cat_name = r.category.category_name if r.category else 'General'
        category_breakdown[cat_name] = round(category_breakdown.get(cat_name, 0.0) + float(r.amount or 0), 2)
        
    # Also include direct personal payments (e.g. paying for groceries directly via Send Money)
    personal_payments = Payment.query.filter(
        Payment.from_user_id == current_user_id,
        Payment.payment_type == 'PERSONAL',
        Payment.status == 'COMPLETED',
        db.extract('month', Payment.created_at) == now.month,
        db.extract('year',  Payment.created_at) == now.year,
    ).all()
    
    for p in personal_payments:
        monthly_spend += float(p.amount or 0)
        cat_name = p.category.category_name if p.category else 'General'
        category_breakdown[cat_name] = round(category_breakdown.get(cat_name, 0.0) + float(p.amount or 0), 2)

    # Active Groups
    memberships = GroupMember.query.filter_by(user_id=current_user_id).all()
    active_groups_count = len(memberships)

    # Payment specific generic stats — filter to COMPLETED status
    sent_payments = Payment.query.filter_by(from_user_id=current_user_id, status='COMPLETED').all()
    total_sent = sum(float(p.amount or 0) for p in sent_payments)

    received_payments = Payment.query.filter_by(to_user_id=current_user_id, status='COMPLETED').all()
    total_received = sum(float(p.amount or 0) for p in received_payments)

    return jsonify({
        'you_owe':          round(you_owe, 2),
        'you_are_owed':     round(you_are_owed, 2),
        'monthly_spend':    round(monthly_spend, 2),
        'overall_balance':  round(float(user.current_balance or 0), 2) if user else 0,
        'category_breakdown': category_breakdown,
        'active_groups':    active_groups_count,
        'total_sent':       round(total_sent, 2),
        'total_received':   round(total_received, 2),
    }), 200


@dashboard_bp.route('/activity', methods=['GET'])
@jwt_required()
def get_activity():
    current_user_id = int(get_jwt_identity())
    memberships = GroupMember.query.filter_by(user_id=current_user_id).all()
    group_ids = [m.group_id for m in memberships]

    activity = []

    # Recent expense splits in user's groups
    if group_ids:
        rows = ExpenseSplitGroup.query.filter(
            ExpenseSplitGroup.group_id.in_(group_ids),
            ExpenseSplitGroup.paid_by == current_user_id,
        ).order_by(ExpenseSplitGroup.created_at.desc()).limit(10).all()

        for r in rows:
            # Build description safely — handle None description and category
            desc = r.description
            if not desc:
                desc = r.category.category_name if r.category else 'Expense'
            
            activity.append({
                'type':        'EXPENSE',
                'from_name':   f'{r.payer.first_name} {r.payer.last_name}' if r.payer else 'Unknown',
                'to_name':     f'{r.debtor.first_name} {r.debtor.last_name}' if r.debtor else 'Group',
                'amount':      float(r.amount or 0),
                'description': desc,
                'created_at':  r.created_at.isoformat() if r.created_at else '',
            })

    # Recent payments
    payments = Payment.query.filter(
        (Payment.from_user_id == current_user_id) | (Payment.to_user_id == current_user_id)
    ).order_by(Payment.created_at.desc()).limit(10).all()

    for p in payments:
        activity.append({
            'type':        'PAYMENT',
            'from_name':   f'{p.sender.first_name} {p.sender.last_name}' if p.sender else 'Unknown',
            'to_name':     f'{p.receiver.first_name} {p.receiver.last_name}' if p.receiver else 'Unknown',
            'amount':      float(p.amount or 0),
            'description': p.note or 'Payment',
            'created_at':  p.created_at.isoformat() if p.created_at else '',
        })

    activity.sort(key=lambda x: x['created_at'], reverse=True)
    return jsonify(activity[:20]), 200
