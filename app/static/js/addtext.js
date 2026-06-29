let addTextFileId = null;
let addTextPageWidth = 0;
let addTextPageHeight = 0;
let addTextBox = null;
let addTextFontSize = 24;
let addTextOpacity = 1;
let addTextRotation = 0;
let addTextPageIndex = 0;
let addTextTotalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('addtext-upload-zone');
    const fileInput = document.getElementById('addtext-file-input');
    const uploadError = document.getElementById('addtext-upload-error');
    const canvasWrapper = document.getElementById('addtext-canvas-wrapper');
    const canvasImg = document.getElementById('addtext-canvas-img');
    const addBoxBtn = document.getElementById('addtext-add-box-btn');
    const downloadBtn = document.getElementById('addtext-download-btn');
    const processError = document.getElementById('addtext-process-error');

    // Styling controls and displays
    const styleControls = document.getElementById('addtext-style-controls');
    const opacityInput = document.getElementById('addtext-opacity-input');
    const rotationInput = document.getElementById('addtext-rotation-input');
    const rotationNumberInput = document.getElementById('addtext-rotation-number-input');
    const opacityValue = document.getElementById('addtext-opacity-value');
    const fontsizeValue = document.getElementById('addtext-fontsize-value');

    // Page navigation selectors
    const pageNav = document.getElementById('addtext-page-nav');
    const prevPageBtn = document.getElementById('addtext-prev-page-btn');
    const nextPageBtn = document.getElementById('addtext-next-page-btn');
    const pageIndicator = document.getElementById('addtext-page-indicator');

    // Watermark checkboxes selectors
    const applyAllCheckbox = document.getElementById('addtext-apply-all-checkbox');
    const applyAllLabel = document.getElementById('addtext-apply-all-label');

    if (!uploadZone || !fileInput || !uploadError || !canvasWrapper || !canvasImg || !addBoxBtn || !downloadBtn || !processError || !styleControls || !opacityInput || !rotationInput || !rotationNumberInput || !opacityValue || !fontsizeValue || !pageNav || !prevPageBtn || !nextPageBtn || !pageIndicator || !applyAllCheckbox || !applyAllLabel) {
        return;
    }

    // Load preview of a specific PDF page
    async function loadAddTextPage(pageIndex) {
        try {
            const response = await fetch(`/page-info/${addTextFileId}/${pageIndex}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to retrieve page specifications');
            }
            const dimensions = await response.json();
            addTextPageWidth = dimensions.width;
            addTextPageHeight = dimensions.height;
            addTextPageIndex = pageIndex;

            canvasImg.src = `/thumbnail/${addTextFileId}/${pageIndex}?zoom=1.5`;
            pageIndicator.textContent = `Page ${pageIndex + 1} of ${addTextTotalPages}`;
            prevPageBtn.disabled = (pageIndex === 0);
            nextPageBtn.disabled = (pageIndex === addTextTotalPages - 1);
        } catch (error) {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        }
    }

    // Helper to apply rotation to the content block and synchronize inputs
    function applyAddTextRotation(value) {
        let angle = parseFloat(value);
        if (isNaN(angle)) {
            angle = 0;
        }
        addTextRotation = angle;

        if (addTextBox) {
            const contentArea = addTextBox.querySelector('.addtext-box-content');
            if (contentArea) {
                contentArea.style.transform = `rotate(${angle}deg)`;
            }
        }
        rotationInput.value = angle;
        rotationNumberInput.value = angle;
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
        processError.textContent = '';
        processError.classList.add('hidden');
        canvasWrapper.classList.add('hidden');
        addBoxBtn.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        styleControls.classList.add('hidden');
        pageNav.classList.add('hidden');
        applyAllLabel.classList.add('hidden');
        applyAllCheckbox.checked = false;
        addTextBox = null;
        addTextPageIndex = 0;

        // Reset style states and slider defaults
        addTextFontSize = 24;
        addTextOpacity = 1;
        addTextRotation = 0;

        opacityInput.value = 1;
        rotationInput.value = 0;
        rotationNumberInput.value = 0;
        opacityValue.textContent = '100%';
        fontsizeValue.textContent = '24px';

        // Remove any existing box
        const oldBox = document.getElementById('addtext-box');
        if (oldBox) {
            oldBox.remove();
        }

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
            addTextFileId = data.file_id;
            addTextTotalPages = data.page_count;

            canvasWrapper.classList.remove('hidden');
            addBoxBtn.classList.remove('hidden');
            downloadBtn.classList.remove('hidden');
            pageNav.classList.remove('hidden');
            applyAllLabel.classList.remove('hidden');

            await loadAddTextPage(0);
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });

    // Previous page click handler
    prevPageBtn.addEventListener('click', async () => {
        if (addTextPageIndex > 0) {
            await loadAddTextPage(addTextPageIndex - 1);
        }
    });

    // Next page click handler
    nextPageBtn.addEventListener('click', async () => {
        if (addTextPageIndex < addTextTotalPages - 1) {
            await loadAddTextPage(addTextPageIndex + 1);
        }
    });

    // Add Box button click handler
    addBoxBtn.addEventListener('click', () => {
        if (addTextBox) return;

        // Create the box container
        const box = document.createElement('div');
        box.id = 'addtext-box';
        box.className = 'addtext-box';
        box.style.left = '40%';
        box.style.top = '40%';

        // Create the drag handle
        const handle = document.createElement('div');
        handle.className = 'addtext-box-handle';
        handle.textContent = '⠿';

        // Create the editable content area
        const content = document.createElement('div');
        content.className = 'addtext-box-content';
        content.contentEditable = 'true';
        content.textContent = '';
        content.dataset.placeholder = 'Type here...';

        // Create the corner resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'addtext-resize-handle';

        // Assembly
        box.appendChild(handle);
        box.appendChild(content);
        box.appendChild(resizeHandle);
        canvasWrapper.appendChild(box);
        addTextBox = box;

        // Reveal styling controls panel
        styleControls.classList.remove('hidden');

        // Apply current style states to the new textbox (rotating content area directly)
        content.style.fontSize = `${addTextFontSize}px`;
        content.style.opacity = addTextOpacity;
        content.style.transform = `rotate(${addTextRotation}deg)`;

        // Implement dragging via plain mouse events on the move handle
        handle.addEventListener('mousedown', (event) => {
            event.preventDefault();
            const dragStartClientX = event.clientX;
            const dragStartClientY = event.clientY;
            const dragStartLeftPx = box.offsetLeft;
            const dragStartTopPx = box.offsetTop;

            function onMouseMove(e) {
                const deltaX = e.clientX - dragStartClientX;
                const deltaY = e.clientY - dragStartClientY;
                box.style.left = `${dragStartLeftPx + deltaX}px`;
                box.style.top = `${dragStartTopPx + deltaY}px`;
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Implement resize dragging via mouse events on the corner resize handle
        resizeHandle.addEventListener('mousedown', (event) => {
            event.stopPropagation(); // prevent triggering parent box move-dragging
            event.preventDefault();
            const dragStartClientX = event.clientX;
            const dragStartClientY = event.clientY;
            const startWidth = box.offsetWidth;
            const startFontSize = addTextFontSize;

            function onMouseMoveResize(e) {
                const deltaX = e.clientX - dragStartClientX;
                const deltaY = e.clientY - dragStartClientY;

                // Adjust width based on horizontal delta
                const newWidth = Math.max(60, startWidth + deltaX);
                box.style.width = `${newWidth}px`;

                // Adjust font size based on vertical delta
                const newFontSize = Math.max(10, Math.min(120, startFontSize + deltaY));
                content.style.fontSize = `${newFontSize}px`;
                addTextFontSize = newFontSize;
                fontsizeValue.textContent = `${Math.round(newFontSize)}px`;
            }

            function onMouseUpResize() {
                document.removeEventListener('mousemove', onMouseMoveResize);
                document.removeEventListener('mouseup', onMouseUpResize);
            }

            document.addEventListener('mousemove', onMouseMoveResize);
            document.addEventListener('mouseup', onMouseUpResize);
        });

        // Set focus to the editable area so the user can immediately type
        content.focus();
    });

    // Opacity range input change listener
    opacityInput.addEventListener('input', () => {
        const val = parseFloat(opacityInput.value);
        addTextOpacity = val;
        opacityValue.textContent = `${Math.round(val * 100)}%`;
        if (addTextBox) {
            const contentArea = addTextBox.querySelector('.addtext-box-content');
            if (contentArea) {
                contentArea.style.opacity = val;
            }
        }
    });

    // Rotation range input change listener
    rotationInput.addEventListener('input', () => {
        applyAddTextRotation(rotationInput.value);
    });

    // Rotation number input change listener
    rotationNumberInput.addEventListener('input', () => {
        applyAddTextRotation(rotationNumberInput.value);
    });

    // Download/Apply button click handler
    downloadBtn.addEventListener('click', () => {
        processError.textContent = '';
        processError.classList.add('hidden');

        if (!addTextBox) {
            processError.textContent = 'Add a text box first';
            processError.classList.remove('hidden');
            return;
        }

        const contentEl = addTextBox.querySelector('.addtext-box-content');
        const text = contentEl.textContent.trim();
        if (!text) {
            processError.textContent = 'Type some text in the box first';
            processError.classList.remove('hidden');
            return;
        }

        const wrapperRect = canvasWrapper.getBoundingClientRect();
        const scaleFactor = wrapperRect.width / addTextPageWidth;

        // Compute positioning anchoring at left bottom corner of layout content box
        const anchorXpx = addTextBox.offsetLeft + contentEl.offsetLeft;
        const anchorYpx = addTextBox.offsetTop + contentEl.offsetTop + contentEl.offsetHeight;

        const pdfX = anchorXpx / scaleFactor;
        const pdfY = anchorYpx / scaleFactor;
        const pdfFontSize = addTextFontSize / scaleFactor;
        const applyAll = applyAllCheckbox.checked;

        fetch('/pages/add-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_id: addTextFileId,
                text: text,
                x: pdfX,
                y: pdfY,
                font_size: pdfFontSize,
                rotation: addTextRotation,
                opacity: addTextOpacity,
                apply_to_all_pages: applyAll,
                page_index: addTextPageIndex
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || 'Text insertion failed');
                });
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'output.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        })
        .catch(error => {
            processError.textContent = error.message;
            processError.classList.remove('hidden');
        });
    });
});
