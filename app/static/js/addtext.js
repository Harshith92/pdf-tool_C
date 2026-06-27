let addTextFileId = null;
let addTextPageWidth = 0;
let addTextPageHeight = 0;
let addTextX = null;
let addTextY = null;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('addtext-upload-zone');
    const fileInput = document.getElementById('addtext-file-input');
    const uploadError = document.getElementById('addtext-upload-error');
    const canvasWrapper = document.getElementById('addtext-canvas-wrapper');
    const canvasImg = document.getElementById('addtext-canvas-img');
    const controls = document.getElementById('addtext-controls');
    const textInput = document.getElementById('addtext-text-input');
    const downloadBtn = document.getElementById('addtext-download-btn');
    const processError = document.getElementById('addtext-process-error');

    if (!uploadZone || !fileInput || !uploadError || !canvasWrapper || !canvasImg || !controls || !textInput || !downloadBtn || !processError) {
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

        // Reset state & display states
        uploadError.textContent = '';
        uploadError.classList.add('hidden');
        processError.textContent = '';
        processError.classList.add('hidden');
        canvasWrapper.classList.add('hidden');
        controls.classList.add('hidden');
        textInput.value = '';
        addTextX = null;
        addTextY = null;

        // Remove any existing marker
        const existingMarker = document.getElementById('addtext-marker');
        if (existingMarker) {
            existingMarker.remove();
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
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });

    // Click on canvas image to place marker and record coords
    canvasImg.addEventListener('click', (e) => {
        const rect = canvasImg.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        const fracX = offsetX / rect.width;
        const fracY = offsetY / rect.height;

        addTextX = fracX * addTextPageWidth;
        addTextY = fracY * addTextPageHeight;

        // Create or reposition marker
        let marker = document.getElementById('addtext-marker');
        if (!marker) {
            marker = document.createElement('div');
            marker.id = 'addtext-marker';
            marker.classList.add('addtext-marker');
            canvasWrapper.appendChild(marker);
        }

        marker.style.left = `${offsetX}px`;
        marker.style.top = `${offsetY}px`;

        // Reveal controls
        controls.classList.remove('hidden');
    });

    // Handle PDF download
    downloadBtn.addEventListener('click', () => {
        processError.textContent = '';
        processError.classList.add('hidden');

        const text = textInput.value;
        if (!text || !text.trim()) {
            processError.textContent = 'Please enter some text';
            processError.classList.remove('hidden');
            return;
        }

        if (addTextX === null || addTextY === null) {
            processError.textContent = 'Click the page first to place your text';
            processError.classList.remove('hidden');
            return;
        }

        fetch('/pages/add-text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_id: addTextFileId,
                text: text,
                x: addTextX,
                y: addTextY
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
            a.download = 'text_added.pdf';
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
