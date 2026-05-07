from flask import Blueprint, jsonify
from app.models import ExpenseSplitGroup, GroupMember, Category, Payment
from flask_jwt_extended import jwt_required, get_jwt_identity

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('', methods=['GET'])
@jwt_required()
def get_analytics():
    current_user_id = int(get_jwt_identity())

    # All expense split rows where this user paid
    paid_rows = ExpenseSplitGroup.query.filter_by(paid_by=current_user_id).all()

    # Category breakdown
    category_totals = {}
    monthly_totals = {}
    total_paid = 0.0

    for r in paid_rows:
        amt = float(r.amount or 0)
        cat = r.category.category_name if r.category else 'General'
        category_totals[cat] = category_totals.get(cat, 0) + amt
        total_paid += amt

        if r.created_at:
            month_key = r.created_at.strftime('%b %Y')
            monthly_totals[month_key] = monthly_totals.get(month_key, 0) + amt

    # You are owed: rows where you paid but paid_for != you and not settled
    you_are_owed = sum(
        float(r.amount or 0)
        for r in paid_rows
        if r.paid_for != current_user_id and not r.is_settled
    )

    # You owe: rows where paid_by != you but paid_for == you and not settled
    owed_rows = ExpenseSplitGroup.query.filter_by(paid_for=current_user_id, is_settled=False).all()
    you_owe = sum(
        float(r.amount or 0)
        for r in owed_rows
        if r.paid_by != current_user_id
    )

    # Payment totals — filter to COMPLETED status only for accuracy
    sent_payments = Payment.query.filter_by(
        from_user_id=current_user_id, status='COMPLETED'
    ).all()
    total_sent = sum(float(p.amount or 0) for p in sent_payments)

    received_payments = Payment.query.filter_by(
        to_user_id=current_user_id, status='COMPLETED'
    ).all()
    total_received = sum(float(p.amount or 0) for p in received_payments)

    return jsonify({
        'category_breakdown': [
            {'category': k, 'amount': round(v, 2)}
            for k, v in sorted(category_totals.items(), key=lambda x: -x[1])
        ],
        'monthly_spending': [
            {'month': k, 'amount': round(v, 2)}
            for k, v in sorted(monthly_totals.items())
        ],
        'total_paid':    round(total_paid, 2),
        'you_are_owed':  round(you_are_owed, 2),
        'you_owe':       round(you_owe, 2),
        'total_sent':    round(total_sent, 2),
        'total_received':round(total_received, 2),
    }), 200
