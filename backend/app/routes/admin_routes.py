from decimal import Decimal
from datetime import date, datetime
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text

from app.extensions import db
from app.models import Category, Group, Transaction, User

admin_bp = Blueprint('admin', __name__)

TABLE_WHITELIST = {
    'users',
    'category',
    'groups',
    'group_members',
    'personal_expense_split',
    'upi_id',
    'transactions',
    'payment',
    'expense_split_group',
    'future_expense',
}

VIEW_WHITELIST = {
    'user_transaction_ledger',
    'group_user_balances',
}

QUERY_FORBIDDEN = re.compile(
    r'\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|call|copy|do|execute|vacuum|analyze)\b',
    re.IGNORECASE,
)


def current_admin():
    user = User.query.get(int(get_jwt_identity()))
    if not user or not user.is_active or user.role != 'ADMIN':
        return None
    return user


def admin_required():
    if current_admin() is None:
        return jsonify({"error": "Unauthorized"}), 403
    return None


def serialize_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def rows_to_json(result):
    return [
        {key: serialize_value(value) for key, value in row._mapping.items()}
        for row in result
    ]


def ensure_safe_select(sql):
    stripped = sql.strip()
    normalized = stripped[:-1].strip() if stripped.endswith(';') else stripped
    if not normalized:
        return None, "Query is required"

    if ';' in normalized:
        return None, "Only one SQL statement is allowed"

    first_word = normalized.split(None, 1)[0].lower()
    if first_word not in {'select', 'with'}:
        return None, "Only read-only SELECT queries are allowed"

    if QUERY_FORBIDDEN.search(normalized):
        return None, "Query contains a forbidden write/DDL keyword"

    return normalized, None


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    denied = admin_required()
    if denied:
        return denied

    users = User.query.order_by(User.is_active.desc(), User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users]), 200


@admin_bp.route('/users/<int:user_id>/overview', methods=['GET'])
@jwt_required()
def get_user_overview(user_id):
    denied = admin_required()
    if denied:
        return denied

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    groups_sql = text("""
        SELECT g.group_id, g.group_name, gm.role, gm.joined_at
        FROM group_members gm
        JOIN groups g ON g.group_id = gm.group_id
        WHERE gm.user_id = :uid
        ORDER BY g.created_at DESC
    """)
    payments_sql = text("""
        SELECT p.*, 
               s.first_name || ' ' || s.last_name AS from_name,
               r.first_name || ' ' || r.last_name AS to_name,
               c.category_name
        FROM payment p
        JOIN users s ON s.user_id = p.from_user_id
        JOIN users r ON r.user_id = p.to_user_id
        LEFT JOIN category c ON c.category_id = p.category_id
        WHERE p.from_user_id = :uid OR p.to_user_id = :uid
        ORDER BY p.created_at DESC
        LIMIT 50
    """)
    expenses_sql = text("""
        SELECT esg.*,
               g.group_name,
               payer.first_name || ' ' || payer.last_name AS payer_name,
               debtor.first_name || ' ' || debtor.last_name AS debtor_name,
               c.category_name
        FROM expense_split_group esg
        JOIN groups g ON g.group_id = esg.group_id
        JOIN users payer ON payer.user_id = esg.paid_by
        JOIN users debtor ON debtor.user_id = esg.paid_for
        LEFT JOIN category c ON c.category_id = esg.category_id
        WHERE esg.paid_by = :uid OR esg.paid_for = :uid
        ORDER BY esg.created_at DESC
        LIMIT 50
    """)

    return jsonify({
        "user": user.to_dict(),
        "groups": rows_to_json(db.session.execute(groups_sql, {"uid": user_id})),
        "payments": rows_to_json(db.session.execute(payments_sql, {"uid": user_id})),
        "expenses": rows_to_json(db.session.execute(expenses_sql, {"uid": user_id})),
    }), 200


@admin_bp.route('/user/<int:user_id>', methods=['PATCH'])
@jwt_required()
def update_user(user_id):
    admin = current_admin()
    if admin is None:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if 'role' in data:
        if data['role'] not in {'USER', 'ADMIN'}:
            return jsonify({"error": "Invalid role"}), 400
        user.role = data['role']

    if 'is_active' in data:
        if admin.user_id == user_id and data['is_active'] is False:
            return jsonify({"error": "Admin cannot deactivate their own account"}), 400
        user.is_active = bool(data['is_active'])

    db.session.commit()
    return jsonify(user.to_dict()), 200


@admin_bp.route('/transactions', methods=['GET'])
@jwt_required()
def get_transactions():
    denied = admin_required()
    if denied:
        return denied

    sql = text("""
        SELECT
            l.transaction_id,
            l.transaction_type,
            l.reference_id,
            l.amount,
            l.created_at,
            l.from_user,
            l.to_user,
            l.category_id,
            l.entry_type,
            l.description,
            c.category_name,
            u1.first_name || ' ' || u1.last_name AS from_name,
            u2.first_name || ' ' || u2.last_name AS to_name
        FROM user_transaction_ledger l
        LEFT JOIN category c ON c.category_id = l.category_id
        LEFT JOIN users u1 ON u1.user_id = l.from_user
        LEFT JOIN users u2 ON u2.user_id = l.to_user
        ORDER BY l.created_at DESC
        LIMIT 500
    """)
    result = db.session.execute(sql)
    return jsonify(rows_to_json(result)), 200


@admin_bp.route('/groups', methods=['GET'])
@jwt_required()
def get_groups():
    denied = admin_required()
    if denied:
        return denied

    sql = text("""
        SELECT
            g.group_id,
            g.group_name,
            g.created_at,
            COUNT(gm.user_id) AS member_count
        FROM groups g
        LEFT JOIN group_members gm ON gm.group_id = g.group_id
        GROUP BY g.group_id, g.group_name, g.created_at
        ORDER BY g.created_at DESC
    """)
    result = db.session.execute(sql)
    return jsonify(rows_to_json(result)), 200


@admin_bp.route('/system-stats', methods=['GET'])
@jwt_required()
def get_system_stats():
    denied = admin_required()
    if denied:
        return denied

    return jsonify({
        "total_users": User.query.filter_by(is_active=True).count(),
        "inactive_users": User.query.filter_by(is_active=False).count(),
        "total_categories": Category.query.count(),
        "total_transactions": Transaction.query.count(),
        "total_groups": Group.query.count(),
    }), 200


@admin_bp.route('/tables', methods=['GET'])
@jwt_required()
def get_tables():
    denied = admin_required()
    if denied:
        return denied

    tables = []
    for name in sorted(TABLE_WHITELIST):
        count = db.session.execute(text(f'SELECT COUNT(*) AS count FROM {name}')).scalar()
        tables.append({"name": name, "type": "table", "row_count": count})

    for name in sorted(VIEW_WHITELIST):
        count = db.session.execute(text(f'SELECT COUNT(*) AS count FROM {name}')).scalar()
        tables.append({"name": name, "type": "view", "row_count": count})

    return jsonify(tables), 200


@admin_bp.route('/tables/<string:name>', methods=['GET'])
@jwt_required()
def get_table_rows(name):
    denied = admin_required()
    if denied:
        return denied

    if name not in TABLE_WHITELIST and name not in VIEW_WHITELIST:
        return jsonify({"error": "Table or view is not allowed"}), 400

    limit = min(int(request.args.get('limit', 100)), 500)
    sql = text(f'SELECT * FROM {name} LIMIT :limit')
    rows = rows_to_json(db.session.execute(sql, {"limit": limit}))
    return jsonify({"name": name, "rows": rows}), 200


@admin_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    denied = admin_required()
    if denied:
        return denied

    categories = Category.query.order_by(Category.category_id).all()
    return jsonify([c.to_dict() for c in categories]), 200


@admin_bp.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    denied = admin_required()
    if denied:
        return denied

    data = request.get_json() or {}
    name = (data.get('category_name') or '').strip()
    if not name:
        return jsonify({"error": "Category name is required"}), 400

    category = Category(category_name=name)
    db.session.add(category)
    db.session.commit()
    return jsonify(category.to_dict()), 201


@admin_bp.route('/categories/<int:category_id>', methods=['PUT'])
@jwt_required()
def update_category(category_id):
    denied = admin_required()
    if denied:
        return denied

    category = Category.query.get(category_id)
    if not category:
        return jsonify({"error": "Category not found"}), 404

    data = request.get_json() or {}
    name = (data.get('category_name') or '').strip()
    if not name:
        return jsonify({"error": "Category name is required"}), 400

    category.category_name = name
    db.session.commit()
    return jsonify(category.to_dict()), 200


@admin_bp.route('/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(category_id):
    denied = admin_required()
    if denied:
        return denied

    category = Category.query.get(category_id)
    if not category:
        return jsonify({"error": "Category not found"}), 404

    db.session.delete(category)
    db.session.commit()
    return jsonify({"message": "Category deleted"}), 200


@admin_bp.route('/query', methods=['POST'])
@jwt_required()
def run_query():
    denied = admin_required()
    if denied:
        return denied

    data = request.get_json() or {}
    sql, error = ensure_safe_select(data.get('query') or '')
    if error:
        return jsonify({"error": error}), 400

    try:
        result = db.session.execute(text(sql))
        rows = rows_to_json(result)
        return jsonify({
            "columns": list(rows[0].keys()) if rows else [],
            "rows": rows,
            "row_count": len(rows),
        }), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@admin_bp.route('/user/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    admin = current_admin()
    if admin is None:
        return jsonify({"error": "Unauthorized"}), 403

    if admin.user_id == user_id:
        return jsonify({"error": "Admin cannot delete their own account"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.is_active:
        return jsonify({"message": "User already inactive"}), 200

    user.is_active = False
    db.session.commit()
    return jsonify({"message": "User deactivated"}), 200
