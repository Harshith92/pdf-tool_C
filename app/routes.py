import os
import uuid
import io
import zipfile
from flask import Blueprint, request, jsonify, current_app, Response
from werkzeug.utils import secure_filename
from app.pdf_core.page_ops import get_page_count, render_thumbnail, reorder_and_delete_pages, merge_pdfs, split_pdf

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

@main.route('/pages/process', methods=['POST'])
def process_pages():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    file_id = data.get("file_id")
    if not file_id:
        return jsonify({"error": "Missing file_id in JSON body"}), 400

    try:
        uuid.UUID(file_id)
    except ValueError:
        return jsonify({"error": "Invalid file_id format"}), 400

    filename = secure_filename(f"{file_id}.pdf")
    path = os.path.join(current_app.instance_path, 'uploads', filename)

    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404

    if "page_order" not in data or not isinstance(data["page_order"], list):
        return jsonify({"error": "page_order is missing or not a list"}), 400

    page_order = data["page_order"]

    try:
        pdf_bytes = reorder_and_delete_pages(path, page_order)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    response = Response(pdf_bytes, mimetype='application/pdf')
    response.headers['Content-Disposition'] = 'attachment; filename=processed.pdf'
    return response, 200

@main.route('/pages/merge', methods=['POST'])
def merge_pages():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    file_ids = data.get("file_ids")
    if not file_ids or not isinstance(file_ids, list) or len(file_ids) < 2:
        return jsonify({"error": "file_ids is missing, not a list, or has fewer than 2 entries"}), 400

    paths = []
    for file_id in file_ids:
        try:
            uuid.UUID(file_id)
        except ValueError:
            return jsonify({"error": f"Invalid file_id format: {file_id}"}), 400

        filename = secure_filename(f"{file_id}.pdf")
        path = os.path.join(current_app.instance_path, 'uploads', filename)

        if not os.path.exists(path):
            return jsonify({"error": f"File not found: {file_id}"}), 404
        
        paths.append(path)

    try:
        pdf_bytes = merge_pdfs(paths)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    response = Response(pdf_bytes, mimetype='application/pdf')
    response.headers['Content-Disposition'] = 'attachment; filename=merged.pdf'
    return response, 200

@main.route('/pages/split', methods=['POST'])
def split_pages():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    file_id = data.get("file_id")
    if not file_id:
        return jsonify({"error": "Missing file_id in JSON body"}), 400

    try:
        uuid.UUID(file_id)
    except ValueError:
        return jsonify({"error": "Invalid file_id format"}), 400

    filename = secure_filename(f"{file_id}.pdf")
    path = os.path.join(current_app.instance_path, 'uploads', filename)

    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404

    if "page_groups" not in data or not isinstance(data["page_groups"], list) or not data["page_groups"]:
        return jsonify({"error": "page_groups is missing, not a list, or empty"}), 400

    page_groups = data["page_groups"]

    try:
        split_results = split_pdf(path, page_groups)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Build ZIP archive in-memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for idx, pdf_bytes in enumerate(split_results, start=1):
            zip_file.writestr(f"split_{idx}.pdf", pdf_bytes)

    zip_buffer.seek(0)
    zip_bytes = zip_buffer.getvalue()

    response = Response(zip_bytes, mimetype='application/zip')
    response.headers['Content-Disposition'] = 'attachment; filename=split_files.zip'
    return response, 200





