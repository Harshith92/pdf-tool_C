let splitFileId = null;
let splitPageCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('split-upload-zone');
    const fileInput = document.getElementById('split-file-input');
    const uploadError = document.getElementById('split-upload-error');
    const thumbnailsContainer = document.getElementById('split-thumbnails');

    if (!uploadZone || !fileInput || !uploadError || !thumbnailsContainer) {
        return;
    }

    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        // Clear previous error and thumbnails
        uploadError.textContent = '';
        uploadError.classList.add('hidden');
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
            splitFileId = data.file_id;
            splitPageCount = data.page_count;

            for (let pageIndex = 0; pageIndex < splitPageCount; pageIndex++) {
                const thumbDiv = document.createElement('div');
                thumbDiv.classList.add('thumb');
                thumbDiv.dataset.pageIndex = pageIndex;

                const img = document.createElement('img');
                img.src = `/thumbnail/${splitFileId}/${pageIndex}`;
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

    // Event delegation on container to toggle selected highlight
    thumbnailsContainer.addEventListener('click', (e) => {
        const thumb = e.target.closest('.thumb');
        if (thumb) {
            thumb.classList.toggle('selected');
        }
    });
});
