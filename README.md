# PDF Tool

A personal PDF editing app (merge, split, edit, sign) — built as a learning project.

## Features (in progress)

- [ ] Merge, split, reorder, and delete pages
- [ ] Add text, images, watermarks, and highlights
- [ ] Fill PDF forms and add e-signatures
- [ ] Edit existing text inside a PDF

## Tech Stack

- **Backend:** Flask (Python)
- **PDF processing:** PyMuPDF (planned)
- **Testing:** pytest

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
