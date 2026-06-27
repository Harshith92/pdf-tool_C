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
    assert b'PDF Tool' in response.data


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

def test_process_pages_success(client, app):
    # Build a small 3-page valid PDF in-memory with fitz
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page()
        page.insert_text((50, 50), f"This is page {i + 1}")
    pdf_bytes = doc.write()
    doc.close()

    # Upload PDF
    data = {
        'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')
    }
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert upload_response.status_code == 200
    file_id = upload_response.get_json()['file_id']

    # POST to /pages/process
    process_data = {
        "file_id": file_id,
        "page_order": [2, 0]
    }
    response = client.post('/pages/process', json=process_data)
    assert response.status_code == 200
    assert response.mimetype == 'application/pdf'
    assert response.headers.get('Content-Disposition') == 'attachment; filename=processed.pdf'

    # Verify the response body opens with fitz as a valid 2-page PDF
    with fitz.open(stream=response.data, filetype="pdf") as result_doc:
        assert result_doc.page_count == 2
        assert "page 3" in result_doc[0].get_text()
        assert "page 1" in result_doc[1].get_text()

    # Cleanup the saved file
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_process_pages_missing_page_order(client, app):
    # Build a small 3-page valid PDF in-memory
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page()
        page.insert_text((50, 50), f"This is page {i + 1}")
    pdf_bytes = doc.write()
    doc.close()

    # Upload PDF
    data = {
        'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')
    }
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert upload_response.status_code == 200
    file_id = upload_response.get_json()['file_id']

    # POST to /pages/process with missing page_order
    process_data = {
        "file_id": file_id
    }
    response = client.post('/pages/process', json=process_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

    # Cleanup the saved file
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_process_pages_out_of_range(client, app):
    # Build a small 3-page valid PDF in-memory
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page()
        page.insert_text((50, 50), f"This is page {i + 1}")
    pdf_bytes = doc.write()
    doc.close()

    # Upload PDF
    data = {
        'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')
    }
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert upload_response.status_code == 200
    file_id = upload_response.get_json()['file_id']

    # POST to /pages/process with out of range page_order
    process_data = {
        "file_id": file_id,
        "page_order": [0, 99]
    }
    response = client.post('/pages/process', json=process_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

    # Cleanup the saved file
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_process_pages_invalid_uuid(client):
    process_data = {
        "file_id": "not-a-uuid",
        "page_order": [0]
    }
    response = client.post('/pages/process', json=process_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

def test_merge_pages_success(client, app):
    # PDF 1: 2 pages
    doc1 = fitz.open()
    doc1.new_page()
    doc1.new_page()
    pdf_bytes1 = doc1.write()
    doc1.close()

    # PDF 2: 1 page
    doc2 = fitz.open()
    doc2.new_page()
    pdf_bytes2 = doc2.write()
    doc2.close()

    # Upload PDF 1
    data1 = {'pdf_file': (io.BytesIO(pdf_bytes1), 'test1.pdf')}
    res1 = client.post('/upload', data=data1, content_type='multipart/form-data')
    assert res1.status_code == 200
    id1 = res1.get_json()['file_id']

    # Upload PDF 2
    data2 = {'pdf_file': (io.BytesIO(pdf_bytes2), 'test2.pdf')}
    res2 = client.post('/upload', data=data2, content_type='multipart/form-data')
    assert res2.status_code == 200
    id2 = res2.get_json()['file_id']

    # Merge POST
    merge_data = {"file_ids": [id1, id2]}
    response = client.post('/pages/merge', json=merge_data)
    assert response.status_code == 200
    assert response.mimetype == 'application/pdf'
    assert response.headers.get('Content-Disposition') == 'attachment; filename=merged.pdf'

    with fitz.open(stream=response.data, filetype="pdf") as merged_doc:
        assert merged_doc.page_count == 3

    # Cleanup
    for fid in [id1, id2]:
        saved_path = os.path.join(app.instance_path, 'uploads', f"{fid}.pdf")
        if os.path.exists(saved_path):
            os.remove(saved_path)

def test_merge_pages_single_file_id(client, app):
    doc = fitz.open()
    doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    res = client.post('/upload', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    id1 = res.get_json()['file_id']

    # Merge POST with only 1 file_id in the list
    merge_data = {"file_ids": [id1]}
    response = client.post('/pages/merge', json=merge_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

    saved_path = os.path.join(app.instance_path, 'uploads', f"{id1}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_merge_pages_invalid_uuid(client, app):
    doc = fitz.open()
    doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    res = client.post('/upload', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    id1 = res.get_json()['file_id']

    # Merge POST with invalid UUID
    merge_data = {"file_ids": [id1, "not-a-uuid"]}
    response = client.post('/pages/merge', json=merge_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

    saved_path = os.path.join(app.instance_path, 'uploads', f"{id1}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_merge_pages_nonexistent_uuid(client, app):
    doc = fitz.open()
    doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    res = client.post('/upload', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    id1 = res.get_json()['file_id']

    import uuid
    random_uuid = str(uuid.uuid4())

    # Merge POST with one nonexistent UUID
    merge_data = {"file_ids": [id1, random_uuid]}
    response = client.post('/pages/merge', json=merge_data)
    assert response.status_code == 404
    assert 'error' in response.get_json()
    assert random_uuid in response.get_json()['error']

    saved_path = os.path.join(app.instance_path, 'uploads', f"{id1}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_split_pages_success(client, app):
    # Build a small 3-page valid PDF in-memory with fitz
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page()
        page.insert_text((50, 50), f"This is page {i + 1}")
    pdf_bytes = doc.write()
    doc.close()

    # Upload PDF
    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    assert upload_response.status_code == 200
    file_id = upload_response.get_json()['file_id']

    # POST to /pages/split
    split_data = {
        "file_id": file_id,
        "page_groups": [[0], [1, 2]]
    }
    response = client.post('/pages/split', json=split_data)
    assert response.status_code == 200
    assert response.mimetype == 'application/zip'
    assert response.headers.get('Content-Disposition') == 'attachment; filename=split_files.zip'

    # Open response.data as a zip
    import zipfile
    with zipfile.ZipFile(io.BytesIO(response.data)) as zfile:
        namelist = zfile.namelist()
        assert len(namelist) == 2
        assert "split_1.pdf" in namelist
        assert "split_2.pdf" in namelist

        # Verify split_1.pdf is a 1-page PDF
        pdf1_bytes = zfile.read("split_1.pdf")
        with fitz.open(stream=pdf1_bytes, filetype="pdf") as doc1:
            assert doc1.page_count == 1

        # Verify split_2.pdf is a 2-page PDF
        pdf2_bytes = zfile.read("split_2.pdf")
        with fitz.open(stream=pdf2_bytes, filetype="pdf") as doc2:
            assert doc2.page_count == 2

    # Cleanup
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_split_pages_missing_page_groups(client, app):
    # Build PDF
    doc = fitz.open()
    doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    file_id = upload_response.get_json()['file_id']

    # POST to /pages/split with missing page_groups
    split_data = {"file_id": file_id}
    response = client.post('/pages/split', json=split_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

    # Cleanup
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_split_pages_empty_page_groups(client, app):
    # Build PDF
    doc = fitz.open()
    doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
    file_id = upload_response.get_json()['file_id']

    # POST to /pages/split with empty page_groups list []
    split_data = {"file_id": file_id, "page_groups": []}
    response = client.post('/pages/split', json=split_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

    # Cleanup
    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_split_pages_invalid_uuid(client):
    split_data = {
        "file_id": "not-a-uuid",
        "page_groups": [[0]]
    }
    response = client.post('/pages/split', json=split_data)
    assert response.status_code == 400
    assert 'error' in response.get_json()

def test_get_page_info_success(client, app):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Test PDF")
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    res = client.post('/upload', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    file_id = res.get_json()['file_id']

    response = client.get(f'/page-info/{file_id}/0')
    assert response.status_code == 200
    json_data = response.get_json()
    assert 'width' in json_data
    assert 'height' in json_data
    assert isinstance(json_data['width'], float)
    assert isinstance(json_data['height'], float)
    assert json_data['width'] > 0
    assert json_data['height'] > 0

    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_get_page_info_out_of_range(client, app):
    doc = fitz.open()
    page = doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    res = client.post('/upload', data=data, content_type='multipart/form-data')
    file_id = res.get_json()['file_id']

    response = client.get(f'/page-info/{file_id}/99')
    assert response.status_code == 400
    assert 'error' in response.get_json()

    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_get_page_info_invalid_uuid(client):
    response = client.get('/page-info/not-a-valid-uuid/0')
    assert response.status_code == 400
    assert 'error' in response.get_json()

def test_get_thumbnail_zoom_success(client, app):
    doc = fitz.open()
    page = doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    res = client.post('/upload', data=data, content_type='multipart/form-data')
    file_id = res.get_json()['file_id']

    response = client.get(f'/thumbnail/{file_id}/0?zoom=1.5')
    assert response.status_code == 200
    assert response.content_type == 'image/png'

    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_get_thumbnail_zoom_invalid(client, app):
    doc = fitz.open()
    page = doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    data = {'pdf_file': (io.BytesIO(pdf_bytes), 'test.pdf')}
    res = client.post('/upload', data=data, content_type='multipart/form-data')
    file_id = res.get_json()['file_id']

    response = client.get(f'/thumbnail/{file_id}/0?zoom=10')
    assert response.status_code == 400
    assert 'error' in response.get_json()

    saved_path = os.path.join(app.instance_path, 'uploads', f"{file_id}.pdf")
    if os.path.exists(saved_path):
        os.remove(saved_path)








