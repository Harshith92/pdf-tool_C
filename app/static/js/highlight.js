let highlightFileId = null;
let highlightPageWidth = 0;
let highlightPageHeight = 0;
let highlightPageIndex = 0;
let highlightTotalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('highlight-upload-zone');
    const fileInput = document.getElementById('highlight-file-input');
    const uploadError = document.getElementById('highlight-upload-error');
    const canvasWrapper = document.getElementById('highlight-canvas-wrapper');
    const canvasImg = document.getElementById('highlight-canvas-img');
    const textLayer = document.getElementById('highlight-text-layer');

    // Page navigation selectors
    const pageNav = document.getElementById('highlight-page-nav');
    const prevPageBtn = document.getElementById('highlight-prev-page-btn');
    const nextPageBtn = document.getElementById('highlight-next-page-btn');
    const pageIndicator = document.getElementById('highlight-page-indicator');

    if (!uploadZone || !fileInput || !uploadError || !canvasWrapper || !canvasImg || !textLayer || !pageNav || !prevPageBtn || !nextPageBtn || !pageIndicator) {
        return;
    }

    // Render the invisible word overlay spans once canvas image is loaded
    function renderTextLayer(words) {
        textLayer.innerHTML = '';

        canvasImg.onload = () => {
            const wrapperRect = canvasWrapper.getBoundingClientRect();
            const scaleFactor = wrapperRect.width / highlightPageWidth;

            words.forEach(word => {
                const span = document.createElement('span');
                span.textContent = word.text;
                span.className = 'highlight-word';
                span.style.position = 'absolute';
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
        };
    }

    // Load preview of a specific PDF page
    async function loadHighlightPage(pageIndex) {
        try {
            const responseInfo = await fetch(`/page-info/${highlightFileId}/${pageIndex}`);
            if (!responseInfo.ok) {
                const errData = await responseInfo.json();
                throw new Error(errData.error || 'Failed to retrieve page specifications');
            }
            const dimensions = await responseInfo.json();
            highlightPageWidth = dimensions.width;
            highlightPageHeight = dimensions.height;
            highlightPageIndex = pageIndex;

            canvasImg.src = `/thumbnail/${highlightFileId}/${pageIndex}?zoom=1.5`;
            canvasImg.ondragstart = () => false;
            pageIndicator.textContent = `Page ${pageIndex + 1} of ${highlightTotalPages}`;
            prevPageBtn.disabled = (pageIndex === 0);
            nextPageBtn.disabled = (pageIndex === highlightTotalPages - 1);

            // Fetch words coordinates
            const responseWords = await fetch(`/page-words/${highlightFileId}/${pageIndex}`);
            if (!responseWords.ok) {
                const errData = await responseWords.json();
                throw new Error(errData.error || 'Failed to retrieve page words coordinates');
            }
            const wordsData = await responseWords.json();
            renderTextLayer(wordsData.words);

        } catch (error) {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        }
    }

    // Trigger click on hidden file input when clicking upload zone
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        // Reset display states
        uploadError.textContent = '';
        uploadError.classList.add('hidden');
        canvasWrapper.classList.add('hidden');
        pageNav.classList.add('hidden');
        textLayer.innerHTML = '';
        highlightPageIndex = 0;

        const formData = new FormData();
        formData.append('pdf_file', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || 'Upload failed');
                });
            }
            return response.json();
        })
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

    // Previous page click handler
    prevPageBtn.addEventListener('click', async () => {
        if (highlightPageIndex > 0) {
            await loadHighlightPage(highlightPageIndex - 1);
        }
    });

    // Next page click handler
    nextPageBtn.addEventListener('click', async () => {
        if (highlightPageIndex < highlightTotalPages - 1) {
            await loadHighlightPage(highlightPageIndex + 1);
        }
    });
});
