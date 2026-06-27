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
    Pages from files with a different page size than the very first page get scaled
    (never stretched) to match it, so the merged result looks visually consistent.

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
    target_width = None
    target_height = None

    try:
        for path in pdf_paths:
            try:
                with fitz.open(path) as doc:
                    for page_index in range(doc.page_count):
                        page = doc.load_page(page_index)
                        rect = page.rect
                        if target_width is None:
                            target_width = rect.width
                            target_height = rect.height

                        # Check if this page's size matches the target within tolerance of 1.0
                        if abs(rect.width - target_width) < 1.0 and abs(rect.height - target_height) < 1.0:
                            result_doc.insert_pdf(doc, from_page=page_index, to_page=page_index)
                        else:
                            new_page = result_doc.new_page(width=target_width, height=target_height)
                            new_page.show_pdf_page(new_page.rect, doc, pno=page_index, keep_proportion=True)
            except Exception as e:
                raise ValueError(f"Failed to open or read PDF file at {path}: {e}") from e
        return result_doc.write()
    finally:
        result_doc.close()

def split_pdf(pdf_path: str, page_groups: list[list[int]]) -> list[bytes]:
    """
    Splits a PDF document into multiple documents defined by lists of page indices, returning a list of byte streams.

    Why this exists:
    Splitting a document is really just producing several smaller documents, each defined by which pages 
    (and in what order) it should contain. This function reuses the already-tested `reorder_and_delete_pages`
    function for each group of indices, preventing duplication of selection and range-checking logic.
    """
    if not page_groups:
        raise ValueError("page_groups cannot be empty")

    split_results = []
    for group in page_groups:
        result_bytes = reorder_and_delete_pages(pdf_path, group)
        split_results.append(result_bytes)
        
    return split_results

def get_page_dimensions(pdf_path: str, page_number: int) -> tuple[float, float]:
    """
    Opens the PDF at the given path and returns the width and height of the specified page.

    Why this exists:
    The frontend's interactive page editor needs to know a page's real point-dimensions
    to correctly convert a click position (in on-screen pixels) into the PDF
    coordinate space text actually gets placed in.
    """
    try:
        with fitz.open(pdf_path) as doc:
            if page_number < 0 or page_number >= doc.page_count:
                raise ValueError(
                    f"Page number {page_number} is out of range. The PDF contains {doc.page_count} pages."
                )
            page = doc.load_page(page_number)
            rect = page.rect
            return (float(rect.width), float(rect.height))
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Could not get page dimensions from PDF file at {pdf_path}: {e}") from e




