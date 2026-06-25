import io
import os
import pytest
import fitz
from app import create_app

@pytest.fixture
def app():
    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    yield app

@pytest.fixture
def client(app):
    return app.test_client()

def test_index_route(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'PDF Tool is alive!' in response.data

def test_upload_valid_pdf(client, app):
    # Build a small 1-page valid PDF in-memory with fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Test PDF")
    pdf_bytes = doc.write()
    doc.close()

    # POST to /upload
    data = {
        'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')
    }
    response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 200
    
    json_data = response.get_json()
    assert 'file_id' in json_data
    assert json_data['page_count'] == 1

    # Cleanup the saved file
    file_id = json_data['file_id']
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_upload_invalid_file_extension(client):
    # Uploading a non-pdf file
    data = {
        'pdf_file': (io.BytesIO(b'plain text content'), 'test.txt')
    }
    response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 400
    assert 'error' in response.get_json()

def test_upload_corrupt_pdf(client):
    # Uploading a corrupt PDF file (correct extension but invalid content)
    data = {
        'pdf_file': (io.BytesIO(b'corrupted pdf content'), 'corrupt.pdf')
    }
    response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert response.status_code == 400
    assert 'error' in response.get_json()

def test_upload_no_file(client):
    # Uploading without file parts
    response = client.post('/upload', data={}, content_type='multipart/form-data')
    assert response.status_code == 400
    assert 'error' in response.get_json()

def test_get_thumbnail_success(client, app):
    # Build a small 1-page valid PDF in-memory with fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Test PDF")
    pdf_bytes = doc.write()
    doc.close()

    # Upload PDF
    data = {
        'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')
    }
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert upload_response.status_code == 200
    file_id = upload_response.get_json()['file_id']

    # GET thumbnail for page 0
    response = client.get(f'/thumbnail/{file_id}/0')
    assert response.status_code == 200
    assert response.content_type == 'image/png'
    assert response.data.startswith(b'\x89PNG')

    # Cleanup the saved file
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_get_thumbnail_out_of_range(client, app):
    # Build a small 1-page valid PDF in-memory with fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Test PDF")
    pdf_bytes = doc.write()
    doc.close()

    # Upload PDF
    data = {
        'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')
    }
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert upload_response.status_code == 200
    file_id = upload_response.get_json()['file_id']

    # GET thumbnail for out-of-range page 99
    response = client.get(f'/thumbnail/{file_id}/99')
    assert response.status_code == 400
    assert 'error' in response.get_json()

    # Cleanup the saved file
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_get_thumbnail_invalid_uuid(client):
    # GET thumbnail with non-UUID file_id format
    response = client.get('/thumbnail/not-a-real-uuid/0')
    assert response.status_code == 400
    assert 'error' in response.get_json()

def test_get_thumbnail_file_not_found(client):
    import uuid
    # GET thumbnail with random UUID format but not uploaded
    random_uuid = str(uuid.uuid4())
    response = client.get(f'/thumbnail/{random_uuid}/0')
    assert response.status_code == 404
    assert 'error' in response.get_json()


