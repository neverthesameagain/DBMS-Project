from flask import Blueprint, request, jsonify
from app.models import ExpenseSplitGroup, GroupMember, User, Category
from app.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity

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

    events_list = sorted(list(events_map.values()), key=lambda x: x['created_at'], reverse=True)
    return jsonify(events_list), 200


@expense_bp.route('/groups/<int:group_id>/expenses', methods=['POST'])
@jwt_required()
def add_expense(group_id):
    """Add an expense and create one expense_split_group row per member."""
    current_user_id = int(get_jwt_identity())

    if not GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first():
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    amount = float(data.get('amount', 0))
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    # Resolve category
    category_name = data.get('category', 'General')
    cat = Category.query.filter_by(category_name=category_name).first()
    category_id = cat.category_id if cat else None

    # Determine who to split with (default: all group members)
    split_with = data.get('split_with')
    if split_with:
        member_ids = [int(uid) for uid in split_with]
    else:
        members = GroupMember.query.filter_by(group_id=group_id).all()
        member_ids = [m.user_id for m in members]

    if not member_ids:
        return jsonify({"error": "No members to split with"}), 400

    share = round(amount / len(member_ids), 2)
    description = data.get('description', '')

    created_rows = []
    for uid in member_ids:
        if uid == current_user_id:
            # Payer doesn't owe themselves, skip creating a split for their own share
            continue

        row = ExpenseSplitGroup(
            group_id=group_id,
            category_id=category_id,
            paid_by=current_user_id,
            paid_for=uid,
            amount=share,
            description=description,
            is_settled=False,
        )
        db.session.add(row)
        created_rows.append(row)

    db.session.commit()
    return jsonify([r.to_dict() for r in created_rows]), 201


@expense_bp.route('/groups/<int:group_id>/balances', methods=['GET'])
@jwt_required()
def get_group_balances(group_id):
    """Net balance (paid vs owes) per member in the group."""
    current_user_id = int(get_jwt_identity())

    if not GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first():
        return jsonify({"error": "Access denied"}), 403

    members = GroupMember.query.filter_by(group_id=group_id).all()
    balances = {}
    for m in members:
        u = User.query.get(m.user_id)
        balances[m.user_id] = {
            'user_id': m.user_id,
            'name': f"{u.first_name} {u.last_name}" if u else "Unknown",
            'total_paid': 0.0,
            'still_owes': 0.0,
            'is_owed': 0.0,
        }

    rows = ExpenseSplitGroup.query.filter_by(group_id=group_id).all()
    for r in rows:
        if r.paid_by in balances:
            balances[r.paid_by]['total_paid'] += float(r.amount)
        if r.paid_for in balances and not r.is_settled:
            if r.paid_by != r.paid_for:
                balances[r.paid_for]['still_owes'] += float(r.amount)
                balances[r.paid_by]['is_owed'] += float(r.amount)

    result = []
    for uid, b in balances.items():
        b['net'] = round(b['is_owed'] - b['still_owes'], 2)
        result.append(b)

    return jsonify(result), 200


@expense_bp.route('/groups/<int:group_id>/expenses/<int:expense_id>', methods=['DELETE'])
@jwt_required()
def delete_expense(group_id, expense_id):
    current_user_id = int(get_jwt_identity())
    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id, role='Admin').first()
    if not admin_check:
        return jsonify({"error": "Only admins can delete expenses"}), 403

    row = ExpenseSplitGroup.query.get(expense_id)
    if not row or row.group_id != group_id:
        return jsonify({"error": "Expense row not found"}), 404

    db.session.delete(row)
    db.session.commit()
    return jsonify({"message": "Expense split deleted"}), 200


@expense_bp.route('/groups/<int:group_id>/expenses/<int:expense_id>', methods=['PUT'])
@jwt_required()
def update_expense(group_id, expense_id):
    current_user_id = int(get_jwt_identity())
    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id, role='Admin').first()
    if not admin_check:
        return jsonify({"error": "Only admins can edit expenses"}), 403

    row = ExpenseSplitGroup.query.get(expense_id)
    if not row or row.group_id != group_id:
        return jsonify({"error": "Expense row not found"}), 404

    data = request.get_json()
    new_amount = data.get('amount')
    if new_amount is not None:
        try:
            val = float(new_amount)
            if val <= 0:
                return jsonify({"error": "Amount must be positive"}), 400
            row.amount = val
        except ValueError:
            return jsonify({"error": "Invalid amount"}), 400

    new_desc = data.get('description')
    if new_desc is not None:
        row.description = str(new_desc)
    
    db.session.commit()
    return jsonify({"message": "Expense split updated"}), 200


@expense_bp.route('/groups/<int:group_id>/settle', methods=['POST'])
@jwt_required()
def settle_debts(group_id):
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    paid_to = data.get('paid_to')
    
    if not paid_to:
        return jsonify({"error": "Must specify who to settle with"}), 400
        
    rows = ExpenseSplitGroup.query.filter_by(
        group_id=group_id, 
        paid_for=current_user_id, 
        paid_by=paid_to, 
        is_settled=False
    ).all()
    
    for r in rows:
        r.is_settled = True
        
    db.session.commit()
    return jsonify({"message": f"Settled debts with user {paid_to}"}), 200
