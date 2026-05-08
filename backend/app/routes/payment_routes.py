from flask import Blueprint, request, jsonify
from app.models import Category, ExpenseSplitGroup, Payment, Transaction, UpiId, User
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
    data = request.get_json() or {}

    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    # Round to 2 decimal places to prevent floating-point issues
    amount = round(amount, 2)

    recipient_type = data.get('recipient_type', 'email')
    recipient_identifier = data.get('recipient_identifier', '').strip()

    if not recipient_identifier:
        return jsonify({"error": "Recipient identifier is required"}), 400

    to_user = None
    if recipient_type == 'email':
        to_user = User.query.filter_by(email=recipient_identifier, is_active=True).first()
    elif recipient_type == 'phone_number':
        to_user = User.query.filter_by(phone_number=recipient_identifier, is_active=True).first()
    elif recipient_type == 'upi_id':
        upi = UpiId.query.filter_by(upi_handle=recipient_identifier).first()
        if upi and upi.user and upi.user.is_active:
            to_user = User.query.get(upi.user_id)

    if not to_user:
        return jsonify({"error": "Recipient not found"}), 404

    sender = User.query.get(current_user_id)
    if not sender:
        return jsonify({"error": "Sender not found"}), 404
    if sender.role != 'USER':
        return jsonify({"error": "Wallet payments are only available for standard user accounts."}), 403
    if to_user.role != 'USER':
        return jsonify({"error": "Recipient must be a standard user account."}), 400

    if to_user.user_id == current_user_id:
        return jsonify({"error": "Cannot pay yourself"}), 400

    category_name = (data.get('category') or '').strip() or 'General'
    cat = Category.query.filter_by(category_name=category_name).first()
    category_id = cat.category_id if cat else None

    payment_type = data.get('payment_type', 'PERSONAL')
    group_id = data.get('group_id')
    skip_split_settlement = bool(data.get('skip_split_settlement'))

    if payment_type not in {'PERSONAL', 'GROUP'}:
        return jsonify({"error": "Invalid payment type"}), 400

    # GROUP ties this transfer to unsettled splits in that one group (explicit settle-up flow).
    if payment_type == 'GROUP' and not group_id:
        return jsonify({"error": "Group ID is required for group settlement payments"}), 400

    debts_for_settlement = []
    # PERSONAL: if you still owe this recipient anywhere and pay >= that total, close those splits.
    still_owe_peer_total = None

    if payment_type == 'GROUP' and group_id:
        try:
            gid = int(group_id)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid group ID"}), 400
        debts_for_settlement = (
            ExpenseSplitGroup.query.filter_by(
                group_id=gid,
                paid_for=current_user_id,
                paid_by=to_user.user_id,
                is_settled=False,
            )
            .order_by(ExpenseSplitGroup.created_at.asc())
            .all()
        )
        total_owed = round(sum(float(d.amount or 0) for d in debts_for_settlement), 2)
        if debts_for_settlement and amount + 1e-9 < total_owed:
            return jsonify({
                "error": (
                    f"Outstanding debt to this person in this group is ₹{total_owed:.2f}. "
                    f"Pay at least that amount to settle every linked split (you entered ₹{amount:.2f})."
                ),
                "required_amount": total_owed,
            }), 400

    elif payment_type == 'PERSONAL' and not skip_split_settlement:
        cand = (
            ExpenseSplitGroup.query.filter_by(
                paid_for=current_user_id,
                paid_by=to_user.user_id,
                is_settled=False,
            )
            .order_by(ExpenseSplitGroup.created_at.asc())
            .all()
        )
        if cand:
            still_owe_peer_total = round(sum(float(d.amount or 0) for d in cand), 2)
            if amount + 1e-9 >= still_owe_peer_total:
                debts_for_settlement = cand

    # Do not attribute settlement transfers to spending budgets.
    if debts_for_settlement:
        category_id = None

    try:
        # Create a Transaction record first (required FK for Payment)
        txn = Transaction(
            transaction_type='PAYMENT',
            reference_id=0,  # Will update after payment is created
            amount=amount,
        )
        db.session.add(txn)
        db.session.flush()  # Get transaction_id

        payment = Payment(
            from_user_id=current_user_id,
            to_user_id=to_user.user_id,
            category_id=category_id,
            amount=amount,
            upi_ref=data.get('upi_ref'),
            note=data.get('note'),
            payment_type=payment_type,
            status='COMPLETED',
            transaction_id=txn.transaction_id,
        )
        db.session.add(payment)
        db.session.flush()

        # Update the transaction reference to point to the payment
        txn.reference_id = payment.payment_id

        settled_count = 0
        if debts_for_settlement:
            for d in debts_for_settlement:
                d.is_settled = True
                d.payment_id = payment.payment_id
            settled_count = len(debts_for_settlement)

        db.session.commit()
        db.session.refresh(payment)

        d = payment.to_dict()
        d['direction'] = 'sent'
        d['settled_count'] = settled_count
        if (
            payment_type == 'PERSONAL'
            and still_owe_peer_total is not None
            and settled_count == 0
            and still_owe_peer_total > 0
        ):
            d['still_owe_this_recipient'] = still_owe_peer_total
        return jsonify(d), 201

    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": f"Payment failed: {str(exc)}"}), 500
