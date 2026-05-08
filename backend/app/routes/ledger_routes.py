from flask import Blueprint, jsonify
from app.extensions import db
from sqlalchemy import text
from flask_jwt_extended import jwt_required, get_jwt_identity

ledger_bp = Blueprint('ledger', __name__)

@ledger_bp.route('', methods=['GET'])
@jwt_required()
def get_ledger():
    user_id = int(get_jwt_identity())
    # Query the unified ledger view and join for names/categories
    sql = '''
        SELECT l.*,
               c.category_name,
               u1.first_name || ' ' || u1.last_name AS from_name,
               u2.first_name || ' ' || u2.last_name AS to_name,
               pay.payment_type AS payment_subtype
        FROM user_transaction_ledger l
        LEFT JOIN category c ON c.category_id = l.category_id
        LEFT JOIN users u1 ON u1.user_id = l.from_user
        LEFT JOIN users u2 ON u2.user_id = l.to_user
        LEFT JOIN payment pay ON l.entry_type = 'PAYMENT' AND pay.payment_id = l.reference_id
        WHERE l.from_user = :uid OR l.to_user = :uid
        ORDER BY l.created_at DESC
        LIMIT 100
    '''
    result = db.session.execute(text(sql), {'uid': user_id})
    rows = [dict(r._mapping) for r in result]
    return jsonify(rows), 200
