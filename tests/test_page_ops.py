import os
import tempfile
import pytest
import fitz
from app.pdf_core.page_ops import get_page_count, render_thumbnail, reorder_and_delete_pages

@pytest.fixture
def temp_pdf():
    # Build a temporary 3-page PDF in-memory using fitz
    doc = fitz.open()
    for i in range(3):
        page = doc.new_page()
        page.insert_text((50, 50), f"This is page {i + 1}")
    
    # Save to a temp file via tempfile
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        temp_path = tf.name
        
    doc.save(temp_path)
    doc.close()
    
    yield temp_path
    
    # Clean up the temp file after the tests run
    if os.path.exists(temp_path):
        os.remove(temp_path)

def test_get_page_count(temp_pdf):
    assert get_page_count(temp_pdf) == 3

def test_render_thumbnail(temp_pdf):
    png_bytes = render_thumbnail(temp_pdf, 0)
    assert isinstance(png_bytes, bytes)
    assert png_bytes.startswith(b'\x89PNG')

def test_render_thumbnail_out_of_range(temp_pdf):
    with pytest.raises(ValueError):
        render_thumbnail(temp_pdf, 3)
    with pytest.raises(ValueError):
        render_thumbnail(temp_pdf, -1)

def test_nonexistent_file():
    with pytest.raises(ValueError):
        get_page_count("nonexistent_file.pdf")
    with pytest.raises(ValueError):
        render_thumbnail("nonexistent_file.pdf", 0)

def test_reorder_and_delete_pages_success(temp_pdf):
    # Call reorder_and_delete_pages(temp_pdf, [2, 0])
    result_bytes = reorder_and_delete_pages(temp_pdf, [2, 0])
    
    # Open the returned bytes with fitz.open(stream=..., filetype="pdf") and check page_count == 2
    with fitz.open(stream=result_bytes, filetype="pdf") as result_doc:
        assert result_doc.page_count == 2
        # Extract text from each page and confirm page 0 of the result contains "page 3"
        # and page 1 contains "page 1"
        text_page_0 = result_doc[0].get_text()
        text_page_1 = result_doc[1].get_text()
        assert "page 3" in text_page_0
        assert "page 1" in text_page_1

def test_reorder_and_delete_pages_empty_list(temp_pdf):
    with pytest.raises(ValueError, match="page_order cannot be empty"):
        reorder_and_delete_pages(temp_pdf, [])

def test_reorder_and_delete_pages_out_of_range(temp_pdf):
    with pytest.raises(ValueError):
        reorder_and_delete_pages(temp_pdf, [0, 5])

