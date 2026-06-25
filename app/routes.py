import os
import uuid
from flask import Blueprint, request, jsonify, current_app, Response
from werkzeug.utils import secure_filename
from app.pdf_core.page_ops import get_page_count, render_thumbnail

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return 'PDF Tool is alive!', 200

@main.route('/upload', methods=['POST'])
def upload_pdf():
    if 'pdf_file' not in request.files:
        return jsonify({"error": "No pdf_file file part in request"}), 400

    file = request.files['pdf_file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400

    file_id = str(uuid.uuid4())
    filename = secure_filename(f"{file_id}.pdf")
    save_path = os.path.join(current_app.instance_path, 'uploads', filename)

    try:
        file.save(save_path)
    except Exception as e:
        return jsonify({"error": f"Failed to save file: {e}"}), 500

    try:
        page_count = get_page_count(save_path)
    except ValueError as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        return jsonify({"error": f"Invalid or corrupted PDF file: {e}"}), 400

    return jsonify({"file_id": file_id, "page_count": page_count}), 200

@main.route('/thumbnail/<file_id>/<int:page_number>', methods=['GET'])
def get_thumbnail(file_id, page_number):
    try:
        uuid.UUID(file_id)
    except ValueError:
        return jsonify({"error": "Invalid file_id format"}), 400

    filename = secure_filename(f"{file_id}.pdf")
    path = os.path.join(current_app.instance_path, 'uploads', filename)

    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404

    try:
        png_bytes = render_thumbnail(path, page_number)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return Response(png_bytes, mimetype='image/png'), 200


