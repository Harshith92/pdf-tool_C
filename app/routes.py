import os
import uuid
import io
import zipfile
import tempfile
from flask import Blueprint, request, jsonify, current_app, Response, render_template
from werkzeug.utils import secure_filename
from app.pdf_core.page_ops import get_page_count, render_thumbnail, reorder_and_delete_pages, merge_pdfs, split_pdf, get_page_dimensions, insert_text_at_position, insert_image_at_position, get_page_words




main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('base.html'), 200


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

    zoom = request.args.get('zoom', default=0.3, type=float)
    if not (0.1 <= zoom <= 3.0):
        return jsonify({"error": "zoom must be between 0.1 and 3.0 inclusive"}), 400

    try:
        png_bytes = render_thumbnail(path, page_number, zoom=zoom)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return Response(png_bytes, mimetype='image/png'), 200

@main.route('/page-info/<file_id>/<int:page_number>', methods=['GET'])
def get_page_info(file_id, page_number):
    try:
        uuid.UUID(file_id)
    except ValueError:
        return jsonify({"error": "Invalid file_id format"}), 400

    filename = secure_filename(f"{file_id}.pdf")
    path = os.path.join(current_app.instance_path, 'uploads', filename)

    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404

    try:
        width, height = get_page_dimensions(path, page_number)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"width": width, "height": height}), 200


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

@main.route('/pages/add-text', methods=['POST'])
def add_text_route():
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

    if "text" not in data:
        return jsonify({"error": "Missing text in JSON body"}), 400

    text = data["text"]
    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "text cannot be empty"}), 400

    if "x" not in data or "y" not in data:
        return jsonify({"error": "x and y are required in JSON body"}), 400

    x = data["x"]
    y = data["y"]
    if isinstance(x, bool) or isinstance(y, bool) or not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return jsonify({"error": "x and y must be numbers"}), 400

    # Optional fields validation
    if "font_size" in data:
        fs = data["font_size"]
        if isinstance(fs, bool) or not isinstance(fs, (int, float)):
            return jsonify({"error": "font_size must be a number"}), 400

    if "rotation" in data:
        rot = data["rotation"]
        if isinstance(rot, bool) or not isinstance(rot, (int, float)):
            return jsonify({"error": "rotation must be a number"}), 400

    if "opacity" in data:
        op = data["opacity"]
        if isinstance(op, bool) or not isinstance(op, (int, float)):
            return jsonify({"error": "opacity must be a number"}), 400

    if "apply_to_all_pages" in data:
        app_to_all = data["apply_to_all_pages"]
        if not isinstance(app_to_all, bool):
            return jsonify({"error": "apply_to_all_pages must be true or false"}), 400

    if "color" in data:
        col = data["color"]
        if not isinstance(col, list) or len(col) != 3:
            return jsonify({"error": "color must be a list of 3 numbers between 0 and 1"}), 400
        for c in col:
            if isinstance(c, bool) or not isinstance(c, (int, float)) or not (0 <= c <= 1):
                return jsonify({"error": "color must be a list of 3 numbers between 0 and 1"}), 400

    apply_to_all = data.get("apply_to_all_pages", False)
    if apply_to_all:
        try:
            total_pages = get_page_count(path)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        page_indices = list(range(total_pages))
    else:
        page_index = data.get("page_index", 0)
        if not isinstance(page_index, int) or isinstance(page_index, bool):
            return jsonify({"error": "page_index must be an integer"}), 400
        page_indices = [page_index]

    try:
        pdf_bytes = insert_text_at_position(
            path,
            page_indices=page_indices,
            text=text,
            x=float(x),
            y=float(y),
            font_size=float(data.get("font_size", 24)),
            rotation=float(data.get("rotation", 0)),
            opacity=float(data.get("opacity", 1.0)),
            color=tuple(data.get("color", (0, 0, 0)))
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    filename = 'watermarked.pdf' if apply_to_all else 'text_added.pdf'
    response = Response(pdf_bytes, mimetype='application/pdf')
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    return response, 200


@main.route('/pages/add-image', methods=['POST'])
def add_image_route():
    file_id = request.form.get('file_id')
    if not file_id:
        return jsonify({"error": "Missing file_id in form data"}), 400

    try:
        uuid.UUID(file_id)
    except ValueError:
        return jsonify({"error": "Invalid file_id format"}), 400

    filename = secure_filename(f"{file_id}.pdf")
    path = os.path.join(current_app.instance_path, 'uploads', filename)
    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404

    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image_file = request.files['image']
    if not image_file or not image_file.filename:
        return jsonify({"error": "No image file provided"}), 400

    orig_filename = image_file.filename.lower()
    allowed_exts = ('.png', '.jpg', '.jpeg', '.gif', '.bmp')
    ext = None
    for allowed_ext in allowed_exts:
        if orig_filename.endswith(allowed_ext):
            ext = allowed_ext
            break

    if ext is None:
        return jsonify({"error": "Unsupported image format"}), 400

    # Save to NamedTemporaryFile
    temp_img = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    temp_img_path = temp_img.name
    try:
        image_file.save(temp_img_path)
        temp_img.close()

        # Parse coordinate parameters
        try:
            x_str = request.form.get('x')
            y_str = request.form.get('y')
            w_str = request.form.get('width')
            h_str = request.form.get('height')
            if x_str is None or y_str is None or w_str is None or h_str is None:
                raise ValueError("Missing coordinate parameters")
            x = float(x_str)
            y = float(y_str)
            width = float(w_str)
            height = float(h_str)
        except ValueError:
            return jsonify({"error": "x, y, width, and height must be numbers"}), 400

        # Parse optional rotation
        try:
            rot_str = request.form.get('rotation', '0')
            rotation = float(rot_str)
        except ValueError:
            return jsonify({"error": "rotation must be a number"}), 400

        # Parse apply_to_all_pages
        apply_to_all = request.form.get('apply_to_all_pages', 'false').lower() == 'true'

        if apply_to_all:
            try:
                total_pages = get_page_count(path)
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            page_indices = list(range(total_pages))
        else:
            try:
                page_index = int(request.form.get('page_index', '0'))
            except ValueError:
                return jsonify({"error": "page_index must be an integer"}), 400
            page_indices = [page_index]

        try:
            pdf_bytes = insert_image_at_position(
                path,
                page_indices=page_indices,
                image_path=temp_img_path,
                x=x,
                y=y,
                width=width,
                height=height,
                rotation=rotation
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        filename = 'image_watermarked.pdf' if apply_to_all else 'image_added.pdf'
        response = Response(pdf_bytes, mimetype='application/pdf')
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        return response, 200

    finally:
        if os.path.exists(temp_img_path):
            os.remove(temp_img_path)


@main.route('/page-words/<file_id>/<int:page_number>', methods=['GET'])
def get_page_words_route(file_id, page_number):
    try:
        uuid.UUID(file_id)
    except ValueError:
        return jsonify({"error": "Invalid file_id format"}), 400

    filename = secure_filename(f"{file_id}.pdf")
    path = os.path.join(current_app.instance_path, 'uploads', filename)
    if not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404

    try:
        words = get_page_words(path, page_number)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({"words": words}), 200







