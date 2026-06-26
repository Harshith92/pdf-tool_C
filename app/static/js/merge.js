let mergeFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('merge-upload-zone');
    const fileInput = document.getElementById('merge-file-input');
    const uploadError = document.getElementById('merge-upload-error');
    const fileList = document.getElementById('merge-file-list');
    const fileCountInfo = document.getElementById('merge-file-count-info');

    if (!uploadZone || !fileInput || !uploadError || !fileList || !fileCountInfo) {
        return;
    }

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

            fileList.appendChild(card);
        });

        if (mergeFiles.length === 0) {
            fileCountInfo.classList.add('hidden');
            fileCountInfo.textContent = '';
        } else {
            fileCountInfo.classList.remove('hidden');
            fileCountInfo.textContent = `${mergeFiles.length} file(s) added`;
        }
    }
});
