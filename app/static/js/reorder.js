let currentFileId = null;
let currentPageCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('reorder-upload-zone');
    const fileInput = document.getElementById('reorder-file-input');
    const uploadError = document.getElementById('reorder-upload-error');
    const thumbnailsContainer = document.getElementById('reorder-thumbnails');

    if (!uploadZone || !fileInput || !uploadError || !thumbnailsContainer) {
        return;
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

        // Clear thumbnails
        thumbnailsContainer.innerHTML = '';

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

                const img = document.createElement('img');
                img.src = `/thumbnail/${currentFileId}/${pageIndex}`;
                img.alt = `Page ${pageIndex + 1} thumbnail`;

                const label = document.createElement('span');
                label.classList.add('page-label');
                label.textContent = `Page ${pageIndex + 1}`;

                thumbDiv.appendChild(img);
                thumbDiv.appendChild(label);
                thumbnailsContainer.appendChild(thumbDiv);
            }
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });
});
