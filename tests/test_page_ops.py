import os
import tempfile
import pytest
import fitz
from app.pdf_core.page_ops import get_page_count, render_thumbnail, reorder_and_delete_pages, merge_pdfs, split_pdf


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

@pytest.fixture
def temp_pdf_factory():
    created_files = []

    def _create_temp_pdf(pages_text: list[str]) -> str:
        doc = fitz.open()
        for text in pages_text:
            page = doc.new_page()
            page.insert_text((50, 50), text)
        
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
            temp_path = tf.name
            
        doc.save(temp_path)
        doc.close()
        created_files.append(temp_path)
        return temp_path

    yield _create_temp_pdf

    for path in created_files:
        if os.path.exists(path):
            os.remove(path)


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

def test_merge_pdfs_success(temp_pdf_factory):
    path_a = temp_pdf_factory(["A1", "A2"])
    path_b = temp_pdf_factory(["B1"])

    result_bytes = merge_pdfs([path_a, path_b])

    with fitz.open(stream=result_bytes, filetype="pdf") as result_doc:
        assert result_doc.page_count == 3
        assert "A1" in result_doc[0].get_text()
        assert "A2" in result_doc[1].get_text()
        assert "B1" in result_doc[2].get_text()

def test_merge_pdfs_single_file(temp_pdf_factory):
    path_a = temp_pdf_factory(["A1"])
    with pytest.raises(ValueError, match="merge requires at least 2 PDF files"):
        merge_pdfs([path_a])

def test_merge_pdfs_empty_list():
    with pytest.raises(ValueError, match="pdf_paths cannot be empty"):
        merge_pdfs([])

def test_merge_pdfs_nonexistent_file(temp_pdf_factory):
    path_a = temp_pdf_factory(["X"])
    with pytest.raises(ValueError, match="Failed to open or read PDF file at nonexistent_file.pdf"):
        merge_pdfs([path_a, "nonexistent_file.pdf"])

def test_split_pdf_success(temp_pdf):
    blobs = split_pdf(temp_pdf, [[0], [1, 2]])
    assert len(blobs) == 2
    assert isinstance(blobs[0], bytes)
    assert isinstance(blobs[1], bytes)

    with fitz.open(stream=blobs[0], filetype="pdf") as doc1:
        assert doc1.page_count == 1
        assert "page 1" in doc1[0].get_text()

    with fitz.open(stream=blobs[1], filetype="pdf") as doc2:
        assert doc2.page_count == 2
        assert "page 2" in doc2[0].get_text()
        assert "page 3" in doc2[1].get_text()

def test_split_pdf_empty_groups(temp_pdf):
    with pytest.raises(ValueError, match="page_groups cannot be empty"):
        split_pdf(temp_pdf, [])

def test_split_pdf_empty_group_nested(temp_pdf):
    with pytest.raises(ValueError, match="page_order cannot be empty"):
        split_pdf(temp_pdf, [[]])

def test_split_pdf_out_of_range(temp_pdf):
    with pytest.raises(ValueError):
        split_pdf(temp_pdf, [[0], [5]])

def test_merge_pdfs_normalizes_different_page_sizes(tmp_path):
    path_a = tmp_path / "a.pdf"
    path_b = tmp_path / "b.pdf"

    doc_a = fitz.open()
    doc_a.new_page(width=300, height=300)
    doc_a.save(str(path_a))
    doc_a.close()

    doc_b = fitz.open()
    doc_b.new_page(width=600, height=800)
    doc_b.save(str(path_b))
    doc_b.close()

    result_bytes = merge_pdfs([str(path_a), str(path_b)])

    with fitz.open(stream=result_bytes, filetype="pdf") as result_doc:
        assert result_doc.page_count == 2
        assert abs(result_doc[0].rect.width - 300) < 1
        assert abs(result_doc[0].rect.height - 300) < 1
        assert abs(result_doc[1].rect.width - 300) < 1
        assert abs(result_doc[1].rect.height - 300) < 1




