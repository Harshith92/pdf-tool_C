let currentFileId = null;
let currentPageCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('reorder-upload-zone');
    const fileInput = document.getElementById('reorder-file-input');
    const uploadError = document.getElementById('reorder-upload-error');
    const thumbnailsContainer = document.getElementById('reorder-thumbnails');
    const pageCountInfo = document.getElementById('reorder-page-count-info');

    if (!uploadZone || !fileInput || !uploadError || !thumbnailsContainer || !pageCountInfo) {
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
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });
});

