let mergeFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('merge-upload-zone');
    const fileInput = document.getElementById('merge-file-input');
    const uploadError = document.getElementById('merge-upload-error');
    const fileList = document.getElementById('merge-file-list');
    const fileCountInfo = document.getElementById('merge-file-count-info');
    const downloadBtn = document.getElementById('merge-download-btn');
    const processError = document.getElementById('merge-process-error');

    if (!uploadZone || !fileInput || !uploadError || !fileList || !fileCountInfo || !downloadBtn || !processError) {
        return;
    }

    // Drag over container
    fileList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingEl = fileList.querySelector('.dragging');
        if (!draggingEl) return;

        const target = e.target.closest('.file-card');
        if (!target || target === draggingEl) return;

        const rect = target.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (e.clientY < midpoint) {
            fileList.insertBefore(draggingEl, target);
        } else {
            fileList.insertBefore(draggingEl, target.nextSibling);
        }
    });

    // Rebuild array order based on DOM order when drag finishes
    fileList.addEventListener('dragend', () => {
        const cards = Array.from(fileList.querySelectorAll('.file-card'));
        mergeFiles = cards.map(card => {
            return mergeFiles.find(f => f.fileId === card.dataset.fileId);
        }).filter(Boolean);
    });

    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files);
        if (files.length === 0) return;

        // Clear error display before new batch starts
        uploadError.textContent = '';
        uploadError.classList.add('hidden');

        const uploadPromises = files.map(file => {
            const formData = new FormData();
            formData.append('pdf_file', file);

            return fetch('/upload', {
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
                return {
                    fileId: data.file_id,
                    fileName: file.name,
                    pageCount: data.page_count
                };
            })
            .catch(error => {
                throw new Error(`${file.name}: ${error.message}`);
            });
        });

        Promise.allSettled(uploadPromises)
        .then(results => {
            const errors = [];
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    mergeFiles.push(result.value);
                } else {
                    errors.push(result.reason.message || String(result.reason));
                }
            });

            fileInput.value = '';
            renderMergeFileList();

            if (errors.length > 0) {
                uploadError.textContent = errors.join(', ');
                uploadError.classList.remove('hidden');
            }
        });
    });

    function renderMergeFileList() {
        fileList.innerHTML = '';

        mergeFiles.forEach(fileEntry => {
            const card = document.createElement('div');
            card.classList.add('file-card');
            card.draggable = true;
            card.dataset.fileId = fileEntry.fileId;

            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', '');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });

            const img = document.createElement('img');
            img.src = `/thumbnail/${fileEntry.fileId}/0`;
            img.alt = `${fileEntry.fileName} first page preview`;

            const info = document.createElement('div');
            info.classList.add('file-info');

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('file-name');
            nameSpan.textContent = fileEntry.fileName;

            const pageCountSpan = document.createElement('span');
            pageCountSpan.classList.add('file-pagecount');
            pageCountSpan.textContent = `${fileEntry.pageCount} page${fileEntry.pageCount !== 1 ? 's' : ''}`;

            info.appendChild(nameSpan);
            info.appendChild(pageCountSpan);

            card.appendChild(img);
            card.appendChild(info);

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('remove-btn');
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                const idx = mergeFiles.findIndex(f => f.fileId === fileEntry.fileId);
                if (idx !== -1) {
                    mergeFiles.splice(idx, 1);
                    renderMergeFileList();
                }
            });
            card.appendChild(removeBtn);

            fileList.appendChild(card);
        });

        if (mergeFiles.length === 0) {
            fileCountInfo.classList.add('hidden');
            fileCountInfo.textContent = '';
        } else {
            fileCountInfo.classList.remove('hidden');
            fileCountInfo.textContent = `${mergeFiles.length} file(s) added`;
        }

        if (mergeFiles.length >= 2) {
            downloadBtn.classList.remove('hidden');
        } else {
            downloadBtn.classList.add('hidden');
        }
    }

    // Merge and Download button click handler
    downloadBtn.addEventListener('click', () => {
        processError.textContent = '';
        processError.classList.add('hidden');

        const file_ids = mergeFiles.map(f => f.fileId);

        fetch('/pages/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_ids: file_ids
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || 'Merge failed');
                });
            }
            return response.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'merged.pdf';
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
