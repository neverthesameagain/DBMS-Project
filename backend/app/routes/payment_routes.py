from flask import Blueprint, request, jsonify
from app.models import Payment, Transaction, User, Category
from app.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity

payment_bp = Blueprint('payments', __name__)


@payment_bp.route('', methods=['GET'])
@jwt_required()
def get_payments():
    current_user_id = int(get_jwt_identity())

    payments = Payment.query.filter(
        (Payment.from_user_id == current_user_id) | (Payment.to_user_id == current_user_id)
    ).order_by(Payment.created_at.desc()).all()

    result = []
    for p in payments:
        d = p.to_dict()
        d['direction'] = 'sent' if p.from_user_id == current_user_id else 'received'
        result.append(d)

    return jsonify(result), 200


@payment_bp.route('', methods=['POST'])
@jwt_required()
def send_payment():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    amount = float(data.get('amount', 0))
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    from app.models import UpiId
    recipient_type = data.get('recipient_type', 'email')
    recipient_identifier = data.get('recipient_identifier', '').strip()

    if not recipient_identifier:
        return jsonify({"error": "Recipient identifier is required"}), 400

    to_user = None
    if recipient_type == 'email':
        to_user = User.query.filter_by(email=recipient_identifier).first()
    elif recipient_type == 'phone_number':
        to_user = User.query.filter_by(phone_number=recipient_identifier).first()
    elif recipient_type == 'upi_id':
        upi = UpiId.query.filter_by(upi_handle=recipient_identifier).first()
        if upi:
            to_user = User.query.get(upi.user_id)

    if not to_user:
        # Bypass for demo/testing: assign to any other user if not found
        to_user = User.query.filter(User.user_id != current_user_id).first()
        if not to_user:
            return jsonify({"error": "No valid recipients available in DB"}), 404

    if to_user.user_id == current_user_id:
        return jsonify({"error": "Cannot pay yourself"}), 400

    # Resolve category (optional)
    category_id = None
    if data.get('category'):
        cat = Category.query.filter_by(category_name=data['category']).first()
        category_id = cat.category_id if cat else None

    # Unified ledger entry first
    tx = Transaction(
        transaction_type='PAYMENT',
        reference_id=0,   # updated after payment is created
        amount=amount,
    )
    db.session.add(tx)
    db.session.flush()

    payment_type = data.get('payment_type', 'PERSONAL')
    group_id = data.get('group_id')
    
    payment = Payment(
        from_user_id=current_user_id,
        to_user_id=to_user.user_id,
        category_id=category_id,
        amount=amount,
        upi_ref=data.get('upi_ref'),
        note=data.get('note'),
        payment_type=payment_type,
        status='COMPLETED',
        transaction_id=tx.transaction_id,
    )
    db.session.add(payment)
    db.session.flush()

    # Back-fill reference_id now that we have payment_id
    tx.reference_id = payment.payment_id

    # If tagged to a group, settle outstanding debts between sender and receiver in that group
    if payment_type == 'GROUP' and group_id:
        from app.models import ExpenseSplitGroup
        debts = ExpenseSplitGroup.query.filter_by(
            group_id=group_id,
            paid_for=current_user_id,
            paid_by=to_user.user_id,
            is_settled=False
        ).all()
        for d in debts:
            d.is_settled = True
            d.payment_id = payment.payment_id

    from decimal import Decimal
    # Update balances
    sender = User.query.get(current_user_id)
    sender.current_balance -= Decimal(str(amount))
    to_user.current_balance += Decimal(str(amount))

    # Update personal budget amount_spent if category matches
    if category_id:
        from app.models import PersonalExpenseSplit
        budget = PersonalExpenseSplit.query.filter_by(user_id=current_user_id, category_id=category_id).first()
        if budget:
            budget.amount_spent = Decimal(str(budget.amount_spent or 0)) + Decimal(str(amount))

    db.session.commit()

    d = payment.to_dict()
    d['direction'] = 'sent'
    return jsonify(d), 201
