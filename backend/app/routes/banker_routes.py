from collections import defaultdict

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Payment, Transaction, ExpenseSplitGroup
from app.extensions import db
from functools import wraps

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


def _customer_query():
    """End-user accounts only (banker UI does not surface ADMIN/BANKER)."""
    return User.query.filter(User.role == 'USER', User.is_active.is_(True))


def _is_customer(user):
    return bool(user and user.role == 'USER' and user.is_active)


@banker_bp.route('/banker/users', methods=['GET'])
@banker_required
def get_banker_customer_users():
    users = _customer_query().order_by(User.first_name, User.last_name).all()
    return jsonify([u.to_dict() for u in users]), 200


@banker_bp.route('/banker/debts', methods=['GET'])
@banker_required
def get_global_debts():
    """Net person-to-person debts between USER accounts (unsettled splits only)."""
    rows = ExpenseSplitGroup.query.filter(
        ExpenseSplitGroup.is_settled.is_(False),
        ExpenseSplitGroup.paid_by != ExpenseSplitGroup.paid_for,
    ).all()

    ids = set()
    for r in rows:
        ids.add(r.paid_by)
        ids.add(r.paid_for)

    if not ids:
        return jsonify([]), 200

    users_map = {u.user_id: u for u in User.query.filter(User.user_id.in_(ids)).all()}

    # creditor -> debtor -> total owed (debtor owes creditor)
    owed = defaultdict(lambda: defaultdict(float))
    for r in rows:
        creditor_id = r.paid_by
        debtor_id = r.paid_for
        cu = users_map.get(creditor_id)
        du = users_map.get(debtor_id)
        if not _is_customer(cu) or not _is_customer(du):
            continue
        owed[creditor_id][debtor_id] += float(r.amount or 0)

    summaries = []
    user_ids = sorted(users_map.keys())

    for i in user_ids:
        for j in user_ids:
            if i >= j:
                continue
            if not _is_customer(users_map.get(i)) or not _is_customer(users_map.get(j)):
                continue

            a = owed[i][j]
            b = owed[j][i]
            net = round(a - b, 2)
            if abs(net) < 0.005:
                continue

            if net > 0:
                creditor_id, debtor_id = i, j
            else:
                creditor_id, debtor_id = j, i
                net = abs(net)

            cr = users_map.get(creditor_id)
            db = users_map.get(debtor_id)
            summaries.append({
                'creditor_id': creditor_id,
                'debtor_id': debtor_id,
                'creditor_name': f'{cr.first_name} {cr.last_name}' if cr else 'Unknown',
                'debtor_name': f'{db.first_name} {db.last_name}' if db else 'Unknown',
                'amount': net,
            })

    summaries.sort(key=lambda x: (-x['amount'], x['debtor_name'], x['creditor_name']))
    return jsonify(summaries), 200


def _create_payment_record(*, from_user_id, to_user_id, amount, payment_type, note):
    txn = Transaction(
        transaction_type='PAYMENT',
        reference_id=0,
        amount=amount,
    )
    db.session.add(txn)
    db.session.flush()

    payment = Payment(
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        category_id=None,
        amount=amount,
        payment_type=payment_type,
        status='COMPLETED',
        note=note or payment_type,
        transaction_id=txn.transaction_id,
    )
    db.session.add(payment)
    db.session.flush()
    txn.reference_id = payment.payment_id
    return payment


@banker_bp.route('/banker/funds', methods=['POST'])
@banker_required
def manage_funds():
    """Cash in/out on a customer wallet without changing the banker balance."""
    data = request.json or {}
    banker_id = int(get_jwt_identity())
    target_id = data.get('target_user_id')
    action = data.get('action')
    amount_raw = data.get('amount')

    if not target_id or action not in ['ADD', 'REMOVE']:
        return jsonify({"error": "Invalid target or action"}), 400

    try:
        amount = round(float(amount_raw), 2)
        if amount <= 0:
            return jsonify({"error": "Amount must be positive"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    target_user = User.query.get(target_id)
    if not target_user or not target_user.is_active:
        return jsonify({"error": "Target user not found"}), 404
    if not _is_customer(target_user):
        return jsonify({"error": "Funds can only be adjusted for standard user accounts"}), 400

    banker = User.query.get(banker_id)
    if not banker or not banker.is_active:
        return jsonify({"error": "Banker session invalid"}), 403

    note = (data.get('note') or '').strip() or None

    try:
        if action == 'REMOVE':
            if float(target_user.current_balance or 0) < amount:
                return jsonify({"error": "Insufficient balance for withdrawal"}), 400
            _create_payment_record(
                from_user_id=target_id,
                to_user_id=banker_id,
                amount=amount,
                payment_type='BANKER_REMOVE',
                note=note or 'Cash withdrawal / payout',
            )
        else:
            _create_payment_record(
                from_user_id=banker_id,
                to_user_id=target_id,
                amount=amount,
                payment_type='BANKER_ADD',
                note=note or 'Cash deposit / external receipt',
            )

        db.session.commit()
        db.session.refresh(target_user)
        return jsonify({
            "message": f"Successfully {action.lower()}ed funds",
            "new_balance": float(target_user.current_balance or 0),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@banker_bp.route('/banker/transfer', methods=['POST'])
@banker_required
def banker_transfer():
    """Move balance between two customer accounts (banker-assisted)."""
    data = request.json or {}
    from_id = data.get('from_user_id')
    to_id = data.get('to_user_id')
    note = (data.get('note') or '').strip() or None

    try:
        amount = round(float(data.get('amount', 0)), 2)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400
    if not from_id or not to_id or int(from_id) == int(to_id):
        return jsonify({"error": "Invalid transfer parties"}), 400

    from_user = User.query.get(from_id)
    to_user = User.query.get(to_id)
    if not from_user or not to_user or not from_user.is_active or not to_user.is_active:
        return jsonify({"error": "One or both accounts were not found"}), 404
    if not _is_customer(from_user) or not _is_customer(to_user):
        return jsonify({"error": "Transfers are limited to standard user accounts"}), 400

    if float(from_user.current_balance or 0) < amount:
        return jsonify({"error": "Insufficient balance in source account"}), 400

    try:
        _create_payment_record(
            from_user_id=int(from_id),
            to_user_id=int(to_id),
            amount=amount,
            payment_type='BANKER_TRANSFER',
            note=note or 'Account-to-account transfer',
        )
        db.session.commit()
        db.session.refresh(from_user)
        db.session.refresh(to_user)
        return jsonify({
            "message": "Transfer completed",
            "from_balance": float(from_user.current_balance or 0),
            "to_balance": float(to_user.current_balance or 0),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@banker_bp.route('/banker/logs', methods=['GET'])
@banker_required
def get_banker_logs():
    types = ('BANKER_ADD', 'BANKER_REMOVE', 'BANKER_TRANSFER')
    logs = (
        Payment.query.filter(Payment.payment_type.in_(types))
        .order_by(Payment.created_at.desc())
        .limit(200)
        .all()
    )
    return jsonify([p.to_dict() for p in logs]), 200
