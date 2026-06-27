let addTextFileId = null;
let addTextPageWidth = 0;
let addTextPageHeight = 0;
let addTextBox = null;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('addtext-upload-zone');
    const fileInput = document.getElementById('addtext-file-input');
    const uploadError = document.getElementById('addtext-upload-error');
    const canvasWrapper = document.getElementById('addtext-canvas-wrapper');
    const canvasImg = document.getElementById('addtext-canvas-img');
    const addBoxBtn = document.getElementById('addtext-add-box-btn');
    const downloadBtn = document.getElementById('addtext-download-btn');
    const processError = document.getElementById('addtext-process-error');

    if (!uploadZone || !fileInput || !uploadError || !canvasWrapper || !canvasImg || !addBoxBtn || !downloadBtn || !processError) {
        return;
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
        addTextBox = null;

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
        .then(data => {
            addTextFileId = data.file_id;
            // Fetch page info (width/height of page 0)
            return fetch(`/page-info/${addTextFileId}/0`);
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || 'Failed to retrieve page specifications');
                });
            }
            return response.json();
        })
        .then(dimensions => {
            addTextPageWidth = dimensions.width;
            addTextPageHeight = dimensions.height;

            // Set canvas image src with zoom parameter
            canvasImg.src = `/thumbnail/${addTextFileId}/0?zoom=1.5`;
            canvasWrapper.classList.remove('hidden');
            addBoxBtn.classList.remove('hidden');
            downloadBtn.classList.remove('hidden');
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
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

        // Assembly
        box.appendChild(handle);
        box.appendChild(content);
        canvasWrapper.appendChild(box);
        addTextBox = box;

        // Implement dragging via plain mouse events on the handle
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

        // Set focus to the editable area so the user can immediately type
        content.focus();
    });

    // Download/Apply button click handler (Placeholder behavior for this step)
    downloadBtn.addEventListener('click', () => {
        processError.textContent = '';
        processError.classList.add('hidden');

        if (!addTextBox) {
            processError.textContent = 'Add a text box first';
            processError.classList.remove('hidden');
        } else {
            processError.textContent = 'Coming in the next step!';
            processError.classList.remove('hidden');
        }
    });
});
