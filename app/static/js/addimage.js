let addImageFileId = null;
let addImagePageWidth = 0;
let addImagePageHeight = 0;
let addImagePageIndex = 0;
let addImageTotalPages = 1;
let addImageBox = null;
let addImageRotation = 0;

document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('addimage-upload-zone');
    const fileInput = document.getElementById('addimage-file-input');
    const uploadError = document.getElementById('addimage-upload-error');
    const canvasWrapper = document.getElementById('addimage-canvas-wrapper');
    const canvasImg = document.getElementById('addimage-canvas-img');
    const imageFileInput = document.getElementById('addimage-image-file-input');
    const addImageBtn = document.getElementById('addimage-add-image-btn');
    const downloadBtn = document.getElementById('addimage-download-btn');
    const processError = document.getElementById('addimage-process-error');

    // Page navigation selectors
    const pageNav = document.getElementById('addimage-page-nav');
    const prevPageBtn = document.getElementById('addimage-prev-page-btn');
    const nextPageBtn = document.getElementById('addimage-next-page-btn');
    const pageIndicator = document.getElementById('addimage-page-indicator');

    if (!uploadZone || !fileInput || !uploadError || !canvasWrapper || !canvasImg || !imageFileInput || !addImageBtn || !downloadBtn || !processError || !pageNav || !prevPageBtn || !nextPageBtn || !pageIndicator) {
        return;
    }

    // Load preview of a specific PDF page
    async function loadAddImagePage(pageIndex) {
        try {
            const response = await fetch(`/page-info/${addImageFileId}/${pageIndex}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to retrieve page specifications');
            }
            const dimensions = await response.json();
            addImagePageWidth = dimensions.width;
            addImagePageHeight = dimensions.height;
            addImagePageIndex = pageIndex;

            canvasImg.src = `/thumbnail/${addImageFileId}/${pageIndex}?zoom=1.5`;
            pageIndicator.textContent = `Page ${pageIndex + 1} of ${addImageTotalPages}`;
            prevPageBtn.disabled = (pageIndex === 0);
            nextPageBtn.disabled = (pageIndex === addImageTotalPages - 1);
        } catch (error) {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        }
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
        addImageBtn.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        pageNav.classList.add('hidden');
        addImageBox = null;
        addImagePageIndex = 0;
        addImageRotation = 0;

        // Remove any existing box
        const oldBox = document.getElementById('addimage-box');
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
            addImageFileId = data.file_id;
            addImageTotalPages = data.page_count;

            canvasWrapper.classList.remove('hidden');
            addImageBtn.classList.remove('hidden');
            downloadBtn.classList.remove('hidden');
            pageNav.classList.remove('hidden');

            await loadAddImagePage(0);
        })
        .catch(error => {
            uploadError.textContent = error.message;
            uploadError.classList.remove('hidden');
        });
    });

    // Previous page click handler
    prevPageBtn.addEventListener('click', async () => {
        if (addImagePageIndex > 0) {
            await loadAddImagePage(addImagePageIndex - 1);
        }
    });

    // Next page click handler
    nextPageBtn.addEventListener('click', async () => {
        if (addImagePageIndex < addImageTotalPages - 1) {
            await loadAddImagePage(addImagePageIndex + 1);
        }
    });

    // Add Image button click handler
    addImageBtn.addEventListener('click', () => {
        imageFileInput.click();
    });

    // Handle image file selection
    imageFileInput.addEventListener('change', () => {
        if (addImageBox) return;

        const file = imageFileInput.files[0];
        if (!file) return;

        // Create the box container
        const box = document.createElement('div');
        box.id = 'addimage-box';
        box.className = 'addimage-box';
        box.style.left = '30%';
        box.style.top = '30%';
        box.style.width = '150px';
        box.style.height = '150px';

        // Create the drag handle
        const handle = document.createElement('div');
        handle.className = 'addtext-box-handle';
        handle.textContent = '⠿';

        // Create the image element
        const imgEl = document.createElement('img');
        imgEl.className = 'addimage-box-img';
        imgEl.src = URL.createObjectURL(file);

        // Create the corner resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'addtext-resize-handle';

        // Create the rotate handle and stem
        const rotateStem = document.createElement('div');
        rotateStem.className = 'addtext-rotate-stem';
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'addtext-rotate-handle';

        // Assembly
        box.appendChild(handle);
        box.appendChild(imgEl);
        box.appendChild(resizeHandle);
        box.appendChild(rotateStem);
        box.appendChild(rotateHandle);
        canvasWrapper.appendChild(box);
        addImageBox = box;

        // Set initial rotation
        box.style.transform = `rotate(${addImageRotation}deg)`;

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
            const startHeight = box.offsetHeight;

            function onMouseMove(e) {
                const deltaX = e.clientX - dragStartClientX;
                const deltaY = e.clientY - dragStartClientY;
                box.style.width = `${Math.max(40, startWidth + deltaX)}px`;
                box.style.height = `${Math.max(40, startHeight + deltaY)}px`;
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Implement drag-to-rotate logic on rotateHandle
        rotateHandle.addEventListener('mousedown', (event) => {
            event.stopPropagation();
            event.preventDefault();

            function onMouseMoveRotate(e) {
                const wrapperRect = canvasWrapper.getBoundingClientRect();
                const pivotX = wrapperRect.left + box.offsetLeft;
                const pivotY = wrapperRect.top + box.offsetTop + box.offsetHeight;
                const angleRad = Math.atan2(e.clientY - pivotY, e.clientX - pivotX);
                let degrees = (angleRad * 180 / Math.PI) + 90;
                if (degrees > 180) degrees -= 360;
                if (degrees < -180) degrees += 360;
                addImageRotation = Math.round(degrees);
                box.style.transform = `rotate(${addImageRotation}deg)`;
            }

            function onMouseUpRotate() {
                document.removeEventListener('mousemove', onMouseMoveRotate);
                document.removeEventListener('mouseup', onMouseUpRotate);
            }

            document.addEventListener('mousemove', onMouseMoveRotate);
            document.addEventListener('mouseup', onMouseUpRotate);
        });
    });

    // Apply & Download handler (Placeholder for this step)
    downloadBtn.addEventListener('click', () => {
        processError.textContent = '';
        processError.classList.add('hidden');

        if (!addImageBox) {
            processError.textContent = 'Add an image first';
            processError.classList.remove('hidden');
        } else {
            processError.textContent = 'Apply and download is coming next!';
            processError.classList.remove('hidden');
        }
    });
});
