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
