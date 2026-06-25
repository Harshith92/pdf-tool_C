import os
from flask import Flask

def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB upload limit

    os.makedirs(os.path.join(app.instance_path, 'uploads'), exist_ok=True)

    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app

