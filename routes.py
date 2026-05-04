import re
import secrets
import logging
from flask import Blueprint, request, jsonify, render_template
from flask_login import login_user, logout_user, login_required, current_user
from models import db, Admin, Opportunity

bp = Blueprint('main', __name__)
logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


# ── Serve UI ──────────────────────────────────────────────────────────────────

@bp.route('/')
def index():
    return render_template('admin.html')


# ── Auth ──────────────────────────────────────────────────────────────────────

@bp.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json(silent=True) or {}
    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    confirm = data.get('confirm_password') or ''

    if not full_name:
        return jsonify({'error': 'Full name is required'}), 400
    if not EMAIL_RE.match(email):
        return jsonify({'error': 'Invalid email address'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if password != confirm:
        return jsonify({'error': 'Passwords do not match'}), 400
    if Admin.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    admin = Admin(full_name=full_name, email=email)
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Account created successfully'}), 201


@bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    remember = bool(data.get('remember', False))

    admin = Admin.query.filter_by(email=email).first()
    if not admin or not admin.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    login_user(admin, remember=remember)
    return jsonify({'status': 'success', 'user': admin.to_dict()}), 200


@bp.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'status': 'success'}), 200


@bp.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()

    if not EMAIL_RE.match(email):
        return jsonify({'error': 'Invalid email address'}), 400

    # Always return success to prevent email enumeration (US-1.3)
    admin = Admin.query.filter_by(email=email).first()
    if admin:
        token = secrets.token_urlsafe(32)
        reset_link = f'http://localhost:5000/reset-password?token={token}'
        logger.info('Password reset link for %s: %s', email, reset_link)
        print(f'\n[PASSWORD RESET] Link for {email}: {reset_link}\n')

    return jsonify({'status': 'success', 'message': 'If that email is registered, a reset link has been sent'}), 200


# ── Opportunities CRUD ────────────────────────────────────────────────────────

@bp.route('/api/opportunities', methods=['GET'])
@login_required
def get_opportunities():
    ops = Opportunity.query.filter_by(admin_id=current_user.id).all()
    return jsonify({'status': 'success', 'data': [o.to_dict() for o in ops]}), 200


@bp.route('/api/opportunities', methods=['POST'])
@login_required
def create_opportunity():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    duration = (data.get('duration') or '').strip()
    start_date = (data.get('start_date') or '').strip()
    description = (data.get('description') or '').strip()
    skills_raw = data.get('skills') or ''
    category = (data.get('category') or '').strip()
    future = (data.get('future_opportunities') or '').strip()
    max_applicants = data.get('max_applicants')

    if not all([name, duration, start_date, description, category, future]):
        return jsonify({'error': 'All required fields must be filled'}), 400
    if category not in Opportunity.ALLOWED_CATEGORIES:
        return jsonify({'error': f'Category must be one of: {", ".join(Opportunity.ALLOWED_CATEGORIES)}'}), 400

    # skills can be a list or comma-separated string
    if isinstance(skills_raw, list):
        skills_str = ','.join(s.strip() for s in skills_raw if s.strip())
    else:
        skills_str = ','.join(s.strip() for s in str(skills_raw).split(',') if s.strip())

    if not skills_str:
        return jsonify({'error': 'At least one skill is required'}), 400

    opp = Opportunity(
        name=name, duration=duration, start_date=start_date,
        description=description, skills=skills_str, category=category,
        future_opportunities=future,
        max_applicants=int(max_applicants) if max_applicants else None,
        admin_id=current_user.id,
    )
    db.session.add(opp)
    db.session.commit()
    return jsonify({'status': 'success', 'data': opp.to_dict()}), 201


@bp.route('/api/opportunities/<int:opp_id>', methods=['GET'])
@login_required
def get_opportunity(opp_id):
    opp = Opportunity.query.filter_by(id=opp_id, admin_id=current_user.id).first_or_404()
    return jsonify({'status': 'success', 'data': opp.to_dict()}), 200


@bp.route('/api/opportunities/<int:opp_id>', methods=['PUT'])
@login_required
def update_opportunity(opp_id):
    opp = Opportunity.query.filter_by(id=opp_id, admin_id=current_user.id).first_or_404()
    data = request.get_json(silent=True) or {}

    if 'name' in data:
        opp.name = data['name'].strip()
    if 'duration' in data:
        opp.duration = data['duration'].strip()
    if 'start_date' in data:
        opp.start_date = data['start_date'].strip()
    if 'description' in data:
        opp.description = data['description'].strip()
    if 'skills' in data:
        raw = data['skills']
        if isinstance(raw, list):
            opp.skills = ','.join(s.strip() for s in raw if s.strip())
        else:
            opp.skills = ','.join(s.strip() for s in str(raw).split(',') if s.strip())
    if 'category' in data:
        if data['category'] not in Opportunity.ALLOWED_CATEGORIES:
            return jsonify({'error': f'Invalid category'}), 400
        opp.category = data['category']
    if 'future_opportunities' in data:
        opp.future_opportunities = data['future_opportunities'].strip()
    if 'max_applicants' in data:
        opp.max_applicants = int(data['max_applicants']) if data['max_applicants'] else None

    db.session.commit()
    return jsonify({'status': 'success', 'data': opp.to_dict()}), 200


@bp.route('/api/opportunities/<int:opp_id>', methods=['DELETE'])
@login_required
def delete_opportunity(opp_id):
    opp = Opportunity.query.filter_by(id=opp_id, admin_id=current_user.id).first_or_404()
    db.session.delete(opp)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Opportunity deleted'}), 200


# ── Current user ──────────────────────────────────────────────────────────────

@bp.route('/api/me', methods=['GET'])
@login_required
def me():
    return jsonify({'status': 'success', 'user': current_user.to_dict()}), 200
