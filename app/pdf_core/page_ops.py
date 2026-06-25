import fitz

def get_page_count(pdf_path: str) -> int:
    """
    Opens the PDF at the given path and returns the total number of pages.

    Why this exists:
    This function is used by the visual page editor to determine the total page
    count of the document, which is critical for setting up pagination, rendering
    navigation controls, and validating page selection boundaries.
    """
    try:
        with fitz.open(pdf_path) as doc:
            return doc.page_count
    except Exception as e:
        raise ValueError(f"Could not open PDF file at {pdf_path}: {e}") from e

def render_thumbnail(pdf_path: str, page_number: int, zoom: float = 0.3) -> bytes:
    """
    Opens the PDF and renders the specified 0-indexed page to a PNG image at the given zoom level.

    Why this exists:
    This function is used by the visual page editor to generate lightweight preview
    thumbnails of pages. These thumbnails are displayed in the editor interface to allow
    users to visually organize, reorder, or select pages before applying document operations.
    """
    try:
        with fitz.open(pdf_path) as doc:
            if page_number < 0 or page_number >= doc.page_count:
                raise ValueError(
                    f"Page number {page_number} is out of range. The PDF contains {doc.page_count} pages."
                )
            
            page = doc.load_page(page_number)
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            return pix.tobytes("png")
    except ValueError:
        # Re-raise validation error directly
        raise
    except Exception as e:
        raise ValueError(f"Could not process PDF file at {pdf_path}: {e}") from e

def reorder_and_delete_pages(pdf_path: str, page_order: list[int]) -> bytes:
    """
    Reorders and/or deletes pages in a PDF document based on a list of page indices, and returns the result as bytes.

    Why this exists:
    This function powers both the 'reorder' and 'delete' operations in the visual page editor.
    Instead of performing incremental page manipulation, the frontend submits the final desired state
    as a list of page indices to keep. This single function handles reordering, deleting, and duplicating
    pages in one efficient operation using PyMuPDF's select method.
    """
    if not page_order:
        raise ValueError("page_order cannot be empty")

    try:
        with fitz.open(pdf_path) as doc:
            for idx in page_order:
                if idx < 0 or idx >= doc.page_count:
                    raise ValueError(f"Page index {idx} is out of range. The PDF contains {doc.page_count} pages.")
            
            doc.select(page_order)
            return doc.write()
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Could not reorder/delete pages in PDF file at {pdf_path}: {e}") from e

def merge_pdfs(pdf_paths: list[str]) -> bytes:
    """
    Merges multiple PDF documents into a single PDF and returns the result as bytes.

    Why this exists:
    This function lets users combine multiple uploaded PDFs into a single output file.
    The pages of each input PDF are appended onto the end of the output PDF in the
    exact order they are specified in the pdf_paths list.
    """
    if not pdf_paths:
        raise ValueError("pdf_paths cannot be empty")
    if len(pdf_paths) < 2:
        raise ValueError("merge requires at least 2 PDF files")

    result_doc = fitz.open()
    try:
        for path in pdf_paths:
            try:
                with fitz.open(path) as doc:
                    result_doc.insert_pdf(doc)
            except Exception as e:
                raise ValueError(f"Failed to open or read PDF file at {path}: {e}") from e
        return result_doc.write()
    finally:
        result_doc.close()


