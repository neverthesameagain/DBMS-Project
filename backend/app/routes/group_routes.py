from flask import Blueprint, request, jsonify
from app.models import Group, GroupMember, User
from app.extensions import db
from flask_jwt_extended import jwt_required, get_jwt_identity

group_bp = Blueprint('groups', __name__)


@group_bp.route('', methods=['GET'])
@jwt_required()
def get_groups():
    """Return all groups the current user belongs to."""
    current_user_id = int(get_jwt_identity())
    memberships = GroupMember.query.filter_by(user_id=current_user_id).all()

    result = []
    for m in memberships:
        g = m.group
        result.append({
            'group_id': g.group_id,
            'group_name': g.group_name,
            'role': m.role,
            'joined_at': m.joined_at.isoformat(),
            'member_count': len(g.members),
        })
    return jsonify(result), 200


@group_bp.route('/create', methods=['POST'])
@jwt_required()
def create_group():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    group_name = data.get('group_name', '').strip()
    if not group_name:
        return jsonify({"error": "Group name is required"}), 400

    new_group = Group(group_name=group_name, created_by=current_user_id)
    db.session.add(new_group)
    db.session.flush()  # get group_id before commit

    # Creator is automatically Admin
    membership = GroupMember(group_id=new_group.group_id, user_id=current_user_id, role='Admin')
    db.session.add(membership)
    db.session.commit()

    return jsonify(new_group.to_dict()), 201


@group_bp.route('/<int:group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    current_user_id = int(get_jwt_identity())

    # Verify membership
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first()
    if not membership:
        return jsonify({"error": "Access denied"}), 403

    group = Group.query.get_or_404(group_id)
    return jsonify(group.to_dict()), 200


@group_bp.route('/<int:group_id>/members', methods=['GET'])
@jwt_required()
def get_group_members(group_id):
    current_user_id = int(get_jwt_identity())

    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id).first()
    if not membership:
        return jsonify({"error": "Access denied"}), 403

    members = GroupMember.query.filter_by(group_id=group_id).all()
    result = []
    for m in members:
        user = User.query.get(m.user_id)
        result.append({
            'user_id': user.user_id,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'phone_number': user.phone_number,
            'role': m.role,
            'joined_at': m.joined_at.isoformat(),
        })
    return jsonify(result), 200


@group_bp.route('/<int:group_id>/members', methods=['POST'])
@jwt_required()
def add_group_member(group_id):
    """Admin can add a member by user_id or email."""
    current_user_id = int(get_jwt_identity())

    # Only admins can add members
    membership = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id, role='Admin').first()
    if not membership:
        return jsonify({"error": "Only admins can add members"}), 403

    data = request.get_json()
    target_user = None
    if data.get('email'):
        target_user = User.query.filter_by(email=data['email']).first()
    elif data.get('user_id'):
        target_user = User.query.get(data['user_id'])

    if not target_user:
        return jsonify({"error": "User not found"}), 404

    existing = GroupMember.query.filter_by(group_id=group_id, user_id=target_user.user_id).first()
    if existing:
        return jsonify({"error": "User is already a member"}), 409

    new_member = GroupMember(group_id=group_id, user_id=target_user.user_id, role='Member')
    db.session.add(new_member)
    db.session.commit()

    return jsonify({"message": f"{target_user.first_name} added to group"}), 201


@group_bp.route('/<int:group_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
def remove_group_member(group_id, user_id):
    current_user_id = int(get_jwt_identity())

    admin_check = GroupMember.query.filter_by(group_id=group_id, user_id=current_user_id, role='Admin').first()
    if not admin_check and current_user_id != user_id:
        return jsonify({"error": "Access denied"}), 403

    member = GroupMember.query.filter_by(group_id=group_id, user_id=user_id).first()
    if not member:
        return jsonify({"error": "Member not found"}), 404

    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "Member removed"}), 200
