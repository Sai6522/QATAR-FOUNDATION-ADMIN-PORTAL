from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Admin(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    opportunities = db.relationship('Opportunity', backref='creator', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'full_name': self.full_name, 'email': self.email}


class Opportunity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    duration = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, nullable=False)
    skills = db.Column(db.String(500), nullable=False)          # comma-separated
    category = db.Column(db.String(50), nullable=False)
    future_opportunities = db.Column(db.String(500), nullable=False)
    max_applicants = db.Column(db.Integer, nullable=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('admin.id'), nullable=False)

    ALLOWED_CATEGORIES = ['Technology', 'Business', 'Design', 'Marketing', 'Science', 'Arts', 'Other']

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'duration': self.duration,
            'start_date': self.start_date,
            'description': self.description,
            'skills': [s.strip() for s in self.skills.split(',') if s.strip()],
            'category': self.category,
            'future_opportunities': self.future_opportunities,
            'max_applicants': self.max_applicants,
            'admin_id': self.admin_id,
        }
