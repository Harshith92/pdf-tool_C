let highlightFileId = null;
let highlightPageWidth = 0;
let highlightPageHeight = 0;
let highlightPageIndex = 0;
let highlightTotalPages = 1;
let isSelecting = false;
let selectionStartIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('highlight-upload-zone');
    const fileInput = document.getElementById('highlight-file-input');
    const uploadError = document.getElementById('highlight-upload-error');
    const canvasWrapper = document.getElementById('highlight-canvas-wrapper');
    const canvasImg = document.getElementById('highlight-canvas-img');
    const textLayer = document.getElementById('highlight-text-layer');
    const pageNav = document.getElementById('highlight-page-nav');
    const prevPageBtn = document.getElementById('highlight-prev-page-btn');
    const nextPageBtn = document.getElementById('highlight-next-page-btn');
    const pageIndicator = document.getElementById('highlight-page-indicator');

    if (!uploadZone || !fileInput || !uploadError || !canvasWrapper || !canvasImg || !textLayer || !pageNav || !prevPageBtn || !nextPageBtn || !pageIndicator) {
        return;
    }

    function getSpans() {
        return Array.from(textLayer.querySelectorAll('.highlight-word'));
    }

    function clearSelection() {
        getSpans().forEach(s => s.classList.remove('word-selected'));
    }

    function getSpanIndexAtPoint(x, y) {
        // Temporarily disable pointer-events so elementFromPoint can find the span
        textLayer.style.pointerEvents = 'none';
        const el = document.elementFromPoint(x, y);
        textLayer.style.pointerEvents = 'auto';
        if (!el || !el.classList.contains('highlight-word')) return -1;
        return getSpans().indexOf(el);
    }

    function selectRange(startIdx, endIdx) {
        const spans = getSpans();
        const lo = Math.min(startIdx, endIdx);
        const hi = Math.max(startIdx, endIdx);
        spans.forEach((s, i) => {
            if (i >= lo && i <= hi) {
                s.classList.add('word-selected');
            } else {
                s.classList.remove('word-selected');
            }
        });
    }

    // Mouse selection on text layer
    textLayer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        clearSelection();
        const idx = getSpanIndexAtPoint(e.clientX, e.clientY);
        if (idx === -1) return;
        isSelecting = true;
        selectionStartIndex = idx;
        getSpans()[idx].classList.add('word-selected');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isSelecting || selectionStartIndex === -1) return;
        const idx = getSpanIndexAtPoint(e.clientX, e.clientY);
        if (idx === -1) return;
        selectRange(selectionStartIndex, idx);
    });

    document.addEventListener('mouseup', () => {
        isSelecting = false;
    });

    function renderTextLayer(words) {
        textLayer.innerHTML = '';

        function buildSpans() {
            const wrapperRect = canvasWrapper.getBoundingClientRect();
            const scaleFactor = wrapperRect.width / highlightPageWidth;

            words.forEach(word => {
                const span = document.createElement('span');
                span.textContent = word.text;
                span.className = 'highlight-word';
                span.style.left = `${word.x0 * scaleFactor}px`;
                span.style.top = `${word.y0 * scaleFactor}px`;
                span.style.width = `${(word.x1 - word.x0) * scaleFactor}px`;
                span.style.height = `${(word.y1 - word.y0) * scaleFactor}px`;
                span.dataset.x0 = word.x0;
                span.dataset.y0 = word.y0;
                span.dataset.x1 = word.x1;
                span.dataset.y1 = word.y1;
                textLayer.appendChild(span);
            });
        }

        if (canvasImg.complete && canvasImg.naturalWidth > 0) {
            buildSpans();
        } else {
            canvasImg.onload = buildSpans;
        }
    }

    async function loadHighlightPage(pageIndex) {
        try {
            const responseInfo = await fetch(`/page-info/${highlightFileId}/${pageIndex}`);
            if (!responseInfo.ok) throw new Error('Failed to retrieve page info');
            const dimensions = await responseInfo.json();
            highlightPageWidth = dimensions.width;
            highlightPageHeight = dimensions.height;
            highlightPageIndex = pageIndex;

            canvasImg.src = `/thumbnail/${highlightFileId}/${pageIndex}?zoom=1.5`;
            canvasImg.ondragstart = () => false;
            pageIndicator.textContent = `Page ${pageIndex + 1} of ${highlightTotalPages}`;
            prevPageBtn.disabled = (pageIndex === 0);
            nextPageBtn.disabled = (pageIndex === highlightTotalPages - 1);

            const responseWords = await fetch(`/page-words/${highlightFileId}/${pageIndex}`);
            if (!responseWords.ok) throw new Error('Failed to retrieve page words');
            const wordsData = await responseWords.json();
            renderTextLayer(wordsData.words);
        } catch (error) {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        }
    }

    uploadZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        uploadError.textContent = '';
        uploadError.classList.add('hidden');
        canvasWrapper.classList.add('hidden');
        pageNav.classList.add('hidden');
        textLayer.innerHTML = '';
        highlightPageIndex = 0;
        isSelecting = false;
        selectionStartIndex = -1;

        const formData = new FormData();
        formData.append('pdf_file', file);

        fetch('/upload', { method: 'POST', body: formData })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Upload failed'); }))
        .then(async data => {
            highlightFileId = data.file_id;
            highlightTotalPages = data.page_count;
            canvasWrapper.classList.remove('hidden');
            pageNav.classList.remove('hidden');
            await loadHighlightPage(0);
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });

    prevPageBtn.addEventListener('click', async () => {
        if (highlightPageIndex > 0) await loadHighlightPage(highlightPageIndex - 1);
    });

    nextPageBtn.addEventListener('click', async () => {
        if (highlightPageIndex < highlightTotalPages - 1) await loadHighlightPage(highlightPageIndex + 1);
    });
});