let currentFileId = null;
let currentPageCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('reorder-upload-zone');
    const fileInput = document.getElementById('reorder-file-input');
    const uploadError = document.getElementById('reorder-upload-error');
    const thumbnailsContainer = document.getElementById('reorder-thumbnails');
    const pageCountInfo = document.getElementById('reorder-page-count-info');
    const resetBtn = document.getElementById('reorder-reset-btn');
    const downloadBtn = document.getElementById('reorder-download-btn');
    const processError = document.getElementById('reorder-process-error');

    if (!uploadZone || !fileInput || !uploadError || !thumbnailsContainer || !pageCountInfo || !resetBtn || !downloadBtn || !processError) {
        return;
    }

    // Update remaining vs total page count display message
    function updatePageCountDisplay() {
        const remainingCount = thumbnailsContainer.querySelectorAll('.thumb:not(.deleted)').length;
        pageCountInfo.textContent = `${remainingCount} of ${currentPageCount} pages kept`;
        if (remainingCount === 0) {
            pageCountInfo.classList.add('all-deleted');
        } else {
            pageCountInfo.classList.remove('all-deleted');
        }
    }

    // Allow dropping and reorder visually in the DOM
    thumbnailsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingEl = thumbnailsContainer.querySelector('.dragging');
        if (!draggingEl) return;

        const target = e.target.closest('.thumb');
        if (!target || target === draggingEl) return;

        const rect = target.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        if (e.clientX < midpoint) {
            thumbnailsContainer.insertBefore(draggingEl, target);
        } else {
            thumbnailsContainer.insertBefore(draggingEl, target.nextSibling);
        }
    });

    // Trigger click on input when clicking the upload zone
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle file selection
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        // Clear error and hide
        uploadError.textContent = '';
        uploadError.classList.add('hidden');

        // Clear thumbnails and page count text
        thumbnailsContainer.innerHTML = '';
        pageCountInfo.textContent = '';
        pageCountInfo.classList.remove('all-deleted');
        resetBtn.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        processError.textContent = '';
        processError.classList.add('hidden');

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
            currentFileId = data.file_id;
            currentPageCount = data.page_count;

            for (let pageIndex = 0; pageIndex < currentPageCount; pageIndex++) {
                const thumbDiv = document.createElement('div');
                thumbDiv.classList.add('thumb');
                thumbDiv.dataset.pageIndex = pageIndex;
                thumbDiv.draggable = true;

                // Drag events
                thumbDiv.addEventListener('dragstart', (e) => {
                    thumbDiv.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', '');
                });

                thumbDiv.addEventListener('dragend', () => {
                    thumbDiv.classList.remove('dragging');
                });

                const img = document.createElement('img');
                img.src = `/thumbnail/${currentFileId}/${pageIndex}`;
                img.alt = `Page ${pageIndex + 1} thumbnail`;

                const deleteBtn = document.createElement('button');
                deleteBtn.classList.add('delete-btn');
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', () => {
                    const isDeleted = thumbDiv.classList.toggle('deleted');
                    deleteBtn.textContent = isDeleted ? '↺' : '×';
                    updatePageCountDisplay();
                });

                const label = document.createElement('span');
                label.classList.add('page-label');
                label.textContent = `Page ${pageIndex + 1}`;

                thumbDiv.appendChild(img);
                thumbDiv.appendChild(deleteBtn);
                thumbDiv.appendChild(label);
                thumbnailsContainer.appendChild(thumbDiv);
            }
            updatePageCountDisplay();
            resetBtn.classList.remove('hidden');
            downloadBtn.classList.remove('hidden');
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });

    // Reset button click handler
    resetBtn.addEventListener('click', () => {
        const thumbs = Array.from(thumbnailsContainer.querySelectorAll('.thumb'));
        thumbs.sort((a, b) => parseInt(a.dataset.pageIndex) - parseInt(b.dataset.pageIndex));
        
        thumbs.forEach(thumb => {
            thumbnailsContainer.appendChild(thumb);
            thumb.classList.remove('deleted');
            const deleteBtn = thumb.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.textContent = '×';
            }
        });
        
        updatePageCountDisplay();
    });

    // Download button click handler
    downloadBtn.addEventListener('click', () => {
        processError.textContent = '';
        processError.classList.add('hidden');

        const activeThumbs = Array.from(thumbnailsContainer.querySelectorAll('.thumb:not(.deleted)'));
        const page_order = activeThumbs.map(thumb => parseInt(thumb.dataset.pageIndex, 10));

        if (page_order.length === 0) {
            processError.textContent = 'Cannot download -- all pages are deleted';
            processError.classList.remove('hidden');
            return;
        }

        fetch('/pages/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_id: currentFileId,
                page_order: page_order
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || 'Processing failed');
                });
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'processed.pdf';
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

