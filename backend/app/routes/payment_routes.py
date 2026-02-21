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

    # Resolve recipient
    to_user = None
    if data.get('to_email'):
        to_user = User.query.filter_by(email=data['to_email']).first()
    elif data.get('to_user_id'):
        to_user = User.query.get(int(data['to_user_id']))

    if not to_user:
        return jsonify({"error": "Recipient not found"}), 404
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

    payment = Payment(
        from_user_id=current_user_id,
        to_user_id=to_user.user_id,
        category_id=category_id,
        amount=amount,
        upi_ref=data.get('upi_ref'),
        note=data.get('note'),
        payment_type=data.get('payment_type', 'PERSONAL'),
        status='COMPLETED',
        transaction_id=tx.transaction_id,
    )
    db.session.add(payment)
    db.session.flush()

    # Back-fill reference_id now that we have payment_id
    tx.reference_id = payment.payment_id

    # Update balances
    sender = User.query.get(current_user_id)
    sender.current_balance -= amount
    to_user.current_balance += amount

    db.session.commit()

    d = payment.to_dict()
    d['direction'] = 'sent'
    return jsonify(d), 201
