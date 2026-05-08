from flask import Blueprint, request, jsonify
from app.models import ExpenseSplitGroup, GroupMember, User, Category, Transaction
from app.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text

expense_bp = Blueprint('expenses', __name__)


@expense_bp.route('/groups/<int:group_id>/expenses', methods=['GET'])
@jwt_required()
def get_expenses(group_id):
    current_user_id = int(get_jwt_identity())

    if not GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first():
        return jsonify({"error": "Access denied"}), 403

    # Each unique (paid_by, description, created_at) cluster is one expense event.
    rows = ExpenseSplitGroup.query.filter_by(group_id=group_id).order_by(
        ExpenseSplitGroup.created_at.desc()
    ).all()

    events_map = {}
    for r in rows:
        dt_str = r.created_at.strftime('%Y%m%d%H%M%S') if r.created_at else ''
        key = f"{r.paid_by}_{r.description}_{dt_str}"
        
        if key not in events_map:
            events_map[key] = {
                'event_id': key,
                'description': r.description,
                'category': r.category.category_name if r.category else 'General',
                'paid_by': r.paid_by,
                'payer_name': f'{r.payer.first_name} {r.payer.last_name}' if r.payer else '',
                'total_amount': 0.0,
                'created_at': r.created_at.isoformat() if r.created_at else None,
                'splits': []
            }
        
        events_map[key]['total_amount'] += float(r.amount or 0)
        events_map[key]['splits'].append({
            'expense_id': r.expense_id,
            'debtor_name': f'{r.debtor.first_name} {r.debtor.last_name}' if r.debtor else '',
            'amount': float(r.amount or 0)
        })

    # Round total_amount to avoid floating point drift
    for event in events_map.values():
        event['total_amount'] = round(event['total_amount'], 2)

    events_list = sorted(list(events_map.values()), key=lambda x: x['created_at'] or '', reverse=True)
    return jsonify(events_list), 200


@expense_bp.route('/groups/<int:group_id>/expenses', methods=['POST'])
@jwt_required()
def add_expense(group_id):
    """Add an expense through the DB stored procedure.

    The database owns split insertion and transaction creation so the
    transaction ledger cannot drift from expense data.
    """
    current_user_id = int(get_jwt_identity())

    if not GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first():
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json() or {}
    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    # Round to 2 decimal places
    amount = round(amount, 2)

    # Resolve category
    category_name = data.get('category', 'General')
    cat = Category.query.filter_by(category_name=category_name).first()
    category_id = cat.category_id if cat else None

    # Determine who to split with (default: all group members). Custom
    # amounts can be supplied as {"splits": {"2": 500, "3": 750}}.
    split_amounts = None
    splits_payload = data.get('splits')
    if isinstance(splits_payload, dict):
        member_ids = []
        split_amounts = []
        for uid, split_amount in splits_payload.items():
            try:
                value = float(split_amount)
            except (TypeError, ValueError):
                return jsonify({"error": "Invalid split amount"}), 400
            if value > 0:
                member_ids.append(int(uid))
                split_amounts.append(round(value, 2))
    elif isinstance(splits_payload, list):
        member_ids = []
        split_amounts = []
        for item in splits_payload:
            try:
                uid = int(item.get('user_id'))
                value = float(item.get('amount'))
            except (AttributeError, TypeError, ValueError):
                return jsonify({"error": "Invalid split amount"}), 400
            if value > 0:
                member_ids.append(uid)
                split_amounts.append(round(value, 2))
    elif data.get('split_with'):
        member_ids = [int(uid) for uid in data.get('split_with')]
    else:
        members = GroupMember.query.filter_by(group_id=group_id).all()
        member_ids = [m.user_id for m in members]

    if not member_ids:
        return jsonify({"error": "No members to split with"}), 400

    payable_member_ids = [uid for uid in member_ids if uid != current_user_id]
    if not payable_member_ids:
        return jsonify({
            "error": "Add at least one other active group member before creating a group expense"
        }), 400

    description = data.get('description', '')

    try:
        result = db.session.execute(
            text("""
                SELECT expense_id
                FROM create_group_expense(
                    :group_id,
                    :paid_by,
                    CAST(:member_ids AS INTEGER[]),
                    :amount,
                    :category_id,
                    :description,
                    CAST(:split_amounts AS NUMERIC[])
                )
            """),
            {
                "group_id": group_id,
                "paid_by": current_user_id,
                "member_ids": member_ids,
                "amount": amount,
                "category_id": category_id,
                "description": description,
                "split_amounts": split_amounts,
            },
        )
        created_ids = [row.expense_id for row in result]
        if not created_ids:
            db.session.rollback()
            return jsonify({"error": "No payable split rows were created"}), 400

        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400

    created_rows = ExpenseSplitGroup.query.filter(
        ExpenseSplitGroup.expense_id.in_(created_ids)
    ).order_by(ExpenseSplitGroup.expense_id).all()

    return jsonify([r.to_dict() for r in created_rows]), 201


@expense_bp.route('/groups/<int:group_id>/balances', methods=['GET'])
@jwt_required()
def get_group_balances(group_id):
    """Net balance (paid vs owes) per member in the group, with pairwise debt info."""
    current_user_id = int(get_jwt_identity())

    if not GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first():
        return jsonify({"error": "Access denied"}), 403

    members = GroupMember.query.filter_by(group_id=group_id).all()
    balances = {}
    for m in members:
        u = User.query.get(m.user_id)
        if not u or not u.is_active:
            continue
        balances[m.user_id] = {
            'user_id': m.user_id,
            'name': f"{u.first_name} {u.last_name}" if u else "Unknown",
            'email': u.email if u else "",
            'total_paid': 0.0,
            'still_owes': 0.0,
            'is_owed': 0.0,
        }

    rows = ExpenseSplitGroup.query.filter_by(group_id=group_id).all()

    # Pairwise debts: debts[debtor_id][creditor_id] = amount (unsettled only)
    pairwise = {}

    # Sum of every split line attributed to a member as debtor (their share of expenses).
    share_assigned = {uid: 0.0 for uid in balances}

    for r in rows:
        amt = float(r.amount or 0)
        if r.paid_for in share_assigned:
            share_assigned[r.paid_for] += amt

        # Unsettled amounts you fronted for others (still outstanding until settled).
        if (
            r.paid_by in balances
            and r.paid_by != r.paid_for
            and not r.is_settled
        ):
            balances[r.paid_by]['total_paid'] += amt

        if r.paid_for in balances and not r.is_settled:
            if r.paid_by != r.paid_for:
                balances[r.paid_for]['still_owes'] += amt
                balances[r.paid_by]['is_owed'] += amt

                if r.paid_for not in pairwise:
                    pairwise[r.paid_for] = {}
                pairwise[r.paid_for][r.paid_by] = round(
                    pairwise.get(r.paid_for, {}).get(r.paid_by, 0) + amt, 2
                )

    result = []
    for uid, b in balances.items():
        b['total_paid'] = round(b['total_paid'], 2)
        b['still_owes'] = round(b['still_owes'], 2)
        b['is_owed'] = round(b['is_owed'], 2)
        b['your_share_total'] = round(share_assigned.get(uid, 0.0), 2)
        b['net'] = round(b['is_owed'] - b['still_owes'], 2)

        # How much the current user owes this member
        b['current_user_owes_them'] = round(
            pairwise.get(current_user_id, {}).get(uid, 0), 2
        )
        # How much this member owes the current user
        b['they_owe_current_user'] = round(
            pairwise.get(uid, {}).get(current_user_id, 0), 2
        )

        result.append(b)

    return jsonify(result), 200


@expense_bp.route('/groups/<int:group_id>/expenses/<int:expense_id>', methods=['DELETE'])
@jwt_required()
def delete_expense(group_id, expense_id):
    """Remove one split row and its ledger row (INSERT trigger created both).

    Settled splits or rows tied to a payment record cannot be removed — those
    reflect completed money movement or reconciliation.
    """
    current_user_id = int(get_jwt_identity())

    if not GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first():
        return jsonify({"error": "Access denied"}), 403

    expense = ExpenseSplitGroup.query.filter_by(expense_id=expense_id, group_id=group_id).first()
    if not expense:
        return jsonify({"error": "Expense not found"}), 404

    actor = User.query.get(current_user_id)
    if expense.paid_by != current_user_id and (actor is None or actor.role != 'ADMIN'):
        return jsonify({"error": "Only the member who paid (recorded the expense) can delete it."}), 403

    if expense.is_settled:
        return jsonify({"error": "Cannot delete a settled expense split."}), 400

    if expense.payment_id is not None:
        return jsonify({"error": "Cannot delete an expense split linked to a payment."}), 400

    # Ledger row is keyed by EXPENSE.reference_id = expense_id (see create_transaction_for_expense).
    # Remove it before deleting the split so payment-linked TRANSACTION rows stay untouched.
    Transaction.query.filter_by(transaction_type='EXPENSE', reference_id=expense_id).delete(
        synchronize_session=False
    )
    db.session.flush()
    db.session.delete(expense)
    db.session.commit()

    return jsonify({"message": "Expense split deleted"}), 200


@expense_bp.route('/groups/<int:group_id>/expenses/<int:expense_id>', methods=['PUT'])
@jwt_required()
def update_expense(group_id, expense_id):
    """Amount changes are rejected: ledger amounts are created only on INSERT via trigger."""
    return jsonify({
        "error": "Expense splits are immutable after creation; amounts are enforced in the transactions table by triggers.",
    }), 403


@expense_bp.route('/groups/<int:group_id>/settle', methods=['POST'])
@jwt_required()
def settle_debts(group_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    paid_to = data.get('paid_to')
    
    if not paid_to:
        return jsonify({"error": "Must specify who to settle with"}), 400

    try:
        paid_to = int(paid_to)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid user ID"}), 400

    # Verify both users are members of the group
    if not GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first():
        return jsonify({"error": "Access denied"}), 403
    if not GroupMember.query.filter_by(group_id=group_id, user_id=paid_to).first():
        return jsonify({"error": "Target user is not a member of this group"}), 400

    rows = ExpenseSplitGroup.query.filter_by(
        group_id=group_id, 
        paid_for=current_user_id, 
        paid_by=paid_to, 
        is_settled=False
    ).all()
    
    settled_count = 0
    settled_amount = 0.0
    for r in rows:
        r.is_settled = True
        settled_count += 1
        settled_amount += float(r.amount or 0)

    if settled_count == 0:
        return jsonify({"message": "No outstanding debts found to settle", "settled_count": 0}), 200

    db.session.commit()
    return jsonify({
        "message": f"Settled {settled_count} debt(s) totaling ₹{round(settled_amount, 2)} with user {paid_to}",
        "settled_count": settled_count,
        "settled_amount": round(settled_amount, 2),
    }), 200
