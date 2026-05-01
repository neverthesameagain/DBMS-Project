from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models import UpiId
from flask_jwt_extended import jwt_required, get_jwt_identity

upi_bp = Blueprint('upi', __name__)

@upi_bp.route('', methods=['GET'])
@jwt_required()
def get_upis():
    user_id = int(get_jwt_identity())
    upis = UpiId.query.filter_by(user_id=user_id).all()
    return jsonify([u.to_dict() for u in upis]), 200

@upi_bp.route('', methods=['POST'])
@jwt_required()
def add_upi():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    handle = data.get('upi_handle')
    
    if not handle:
        return jsonify({'error': 'UPI handle is required'}), 400

    existing = UpiId.query.filter_by(upi_handle=handle).first()
    if existing:
        return jsonify({'error': 'UPI handle already registered to an account'}), 400

    new_upi = UpiId(user_id=user_id, upi_handle=handle)
    db.session.add(new_upi)
    db.session.commit()

    return jsonify(new_upi.to_dict()), 201

@upi_bp.route('/<int:upi_id>', methods=['DELETE'])
@jwt_required()
def delete_upi(upi_id):
    user_id = int(get_jwt_identity())
    upi = UpiId.query.filter_by(upi_id=upi_id, user_id=user_id).first()
    
    if not upi:
        return jsonify({'error': 'UPI not found'}), 404

    db.session.delete(upi)
    db.session.commit()
    return jsonify({'message': 'UPI deleted successfully'}), 200
