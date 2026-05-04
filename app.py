from flask import Flask
from flask_login import LoginManager
from config import Config
from models import db, Admin
from routes import bp

def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config.from_object(Config)

    db.init_app(app)

    login_manager = LoginManager(app)
    login_manager.login_view = None  # API-only; return 401 instead of redirect

    @login_manager.user_loader
    def load_user(user_id):
        return Admin.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        from flask import jsonify
        return jsonify({'error': 'Authentication required'}), 401

    app.register_blueprint(bp)

    with app.app_context():
        db.create_all()

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
