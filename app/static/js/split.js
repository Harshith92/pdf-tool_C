let splitFileId = null;
let splitPageCount = 0;
let splitGroups = [];

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('split-upload-zone');
    const fileInput = document.getElementById('split-file-input');
    const uploadError = document.getElementById('split-upload-error');
    const thumbnailsContainer = document.getElementById('split-thumbnails');
    const selectionInfo = document.getElementById('split-selection-info');
    const createGroupBtn = document.getElementById('split-create-group-btn');
    const groupsList = document.getElementById('split-groups-list');

    if (!uploadZone || !fileInput || !uploadError || !thumbnailsContainer || !selectionInfo || !createGroupBtn || !groupsList) {
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

            splitGroups = [];
            selectionInfo.classList.remove('hidden');
            createGroupBtn.classList.remove('hidden');
            updateSplitSelectionInfo();
            renderSplitGroupsList();
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });

    // Event delegation on container to toggle selected highlight
    thumbnailsContainer.addEventListener('click', (e) => {
        const thumb = e.target.closest('.thumb');
        if (!thumb) return;

        if (thumb.classList.contains('grouped')) {
            return;
        }

        thumb.classList.toggle('selected');
        updateSplitSelectionInfo();
    });

    function updateSplitSelectionInfo() {
        const selectedThumbs = thumbnailsContainer.querySelectorAll('.thumb.selected');
        const count = selectedThumbs.length;
        if (count > 0) {
            selectionInfo.textContent = `${count} page(s) selected`;
        } else {
            selectionInfo.textContent = "Click pages to select them";
        }
    }

    createGroupBtn.addEventListener('click', () => {
        const selectedThumbs = Array.from(thumbnailsContainer.querySelectorAll('.thumb.selected'));
        if (selectedThumbs.length === 0) return;

        const pageIndices = selectedThumbs
            .map(thumb => parseInt(thumb.dataset.pageIndex, 10))
            .sort((a, b) => a - b);

        splitGroups.push(pageIndices);

        selectedThumbs.forEach(thumb => {
            thumb.classList.remove('selected');
            thumb.classList.add('grouped');

            const badge = document.createElement('span');
            badge.classList.add('group-badge');
            badge.textContent = `G${splitGroups.length}`;
            thumb.appendChild(badge);
        });

        updateSplitSelectionInfo();
        renderSplitGroupsList();
    });

    function renderSplitGroupsList() {
        groupsList.innerHTML = '';

        splitGroups.forEach((group, i) => {
            const card = document.createElement('div');
            card.classList.add('file-card');

            const span = document.createElement('span');
            span.textContent = `Group ${i + 1}: pages ${group.map(p => p + 1).join(', ')}`;

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('remove-btn');
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                const targetBadgeText = `G${i + 1}`;
                
                // Remove group
                splitGroups.splice(i, 1);

                // Find and clean up thumbnails belonging to the removed group
                const thumbs = Array.from(thumbnailsContainer.querySelectorAll('.thumb'));
                thumbs.forEach(thumb => {
                    const badge = thumb.querySelector('.group-badge');
                    if (badge && badge.textContent === targetBadgeText) {
                        thumb.classList.remove('grouped');
                        badge.remove();
                    }
                });

                // Update badge numbers of remaining groups
                splitGroups.forEach((remGroup, remIdx) => {
                    remGroup.forEach(pageIndex => {
                        const thumb = thumbnailsContainer.querySelector(`.thumb[data-page-index="${pageIndex}"]`);
                        if (thumb) {
                            const badge = thumb.querySelector('.group-badge');
                            if (badge) {
                                badge.textContent = `G${remIdx + 1}`;
                            }
                        }
                    });
                });

                renderSplitGroupsList();
            });

            card.appendChild(span);
            card.appendChild(removeBtn);
            groupsList.appendChild(card);
        });
    }
});
