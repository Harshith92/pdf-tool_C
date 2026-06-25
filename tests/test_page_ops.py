import os
import tempfile
import pytest
import fitz
from app.pdf_core.page_ops import get_page_count, render_thumbnail

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
