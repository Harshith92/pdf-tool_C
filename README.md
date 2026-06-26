# PDF Tool

A personal PDF editing app (merge, split, edit, sign) — built as a learning project, with Claude as a senior-dev mentor and Antigravity as the AI coding agent doing the implementation.

## Features
- [x] Merge, split, reorder, and delete pages
- [ ] Add text, images, watermarks, and highlights
- [ ] Fill PDF forms and add e-signatures
- [ ] Edit existing text inside a PDF

## Tech Stack
- **Backend:** Flask (Python)
- **PDF processing:** PyMuPDF
- **Testing:** pytest
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)

## How to Use

Run the app (see Setup below), then open `http://127.0.0.1:5000` in your browser. The Page Tools page has three tabs:

- **Reorder & Delete** — upload a PDF, drag its page thumbnails into any order, click the × on a page to remove it (click again to undo), then click "Download PDF" for the result.
- **Merge** — upload two or more PDFs, drag the file cards into the order you want them combined, then click "Merge & Download". Pages from differently-sized source files are automatically scaled to match, so the result looks consistent.
- **Split** — upload a PDF, click pages to select them, click "Create Group" to bundle a selection into one output file, repeat for as many groups as you want, then click "Split & Download" to get a ZIP with one PDF per group.

## Setup

1. Clone the repo:
```bash
   git clone https://github.com/Harshith92/pdf-tool_C.git
   cd pdf-tool_C
```

2. Create and activate a virtual environment:
```bash
   python -m venv venv
   .\venv\Scripts\Activate.ps1   # Windows PowerShell
```

3. Install dependencies:
```bash
   pip install -r requirements.txt -r requirements-dev.txt
```

4. Run the app:
```bash
   python run.py
```
   Then open http://127.0.0.1:5000 in your browser.

5. Run tests:
```bash
   python -m pytest
```

## Project Structure