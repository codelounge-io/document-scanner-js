class DocumentScanner {
    constructor(options) {
        this.element = typeof options.element === 'string' ? document.querySelector(options.element) : options.element;
        if (!this.element || this.element.tagName !== 'INPUT' || this.element.type !== 'file') {
            throw new Error('DocumentScanner must be initialized on a file input element.');
        }
        this.onSave = options.onSave;
        this.mode = options.mode || 'samePage';
        this.images = [];
        this.isDragging = false;
        this.dragCorner = null;
        this.modalTitle = options.modalTitle || 'Document Scanner';
        this.scanDocumentBtnText = options.scanDocumentBtnText || 'Scan Document';
        this.okBtnText = options.okBtnText || 'OK';
        this.saveBtnText = options.saveBtnText || 'Save Scan';
        this.addAnotherPageBtnText = options.addAnotherPageBtnText || 'Add another page';
        this.retakeBtnText = options.retakeBtnText || 'Retake';
        this.deleteBtnText = options.deleteBtnText || 'Delete';
        this.deletePageBtnText = options.deletePageBtnText || options.deleteBtnText || 'Delete';
        this.viewPageBtnText = options.viewPageBtnText || 'View';
        this.downloadScanBtnText = options.downloadScanBtnText || 'Download';
        this.showDownloadBtn = options.showDownloadBtn || true;
        this.savedPdf = null;
        this.styleFileInput();
        this.initHTML();
        this.initServiceWorker();
        this.loadOpenCV();
        this.loadJscanify();
        this.loadJsPDF();
        this.addEventListeners();
    }

    styleFileInput() {
        this.element.style.display = 'none';

        this.buttonLabel = document.createElement('label');
        this.buttonLabel.innerHTML = this.scanDocumentBtnText;
        this.buttonLabel.setAttribute('for', this.element.id);
        this.buttonLabel.style.display = 'inline-flex';
        this.buttonLabel.style.padding = '10px 20px';
        this.buttonLabel.style.backgroundColor = 'transparent';
        this.buttonLabel.style.color = '#007bff';
        this.buttonLabel.style.border = '1px solid #007bff';
        this.buttonLabel.style.borderRadius = '5px';
        this.buttonLabel.style.cursor = 'pointer';
        this.buttonLabel.style.fontSize = '16px';
        this.buttonLabel.style.textAlign = 'center';
        this.buttonLabel.style.justifyContent = 'space-evenly';
        this.buttonLabel.style.alignItems = 'center';
        this.buttonLabel.style.flexDirection = 'column';
        this.buttonLabel.style.minHeight = '150px';
        this.buttonLabel.style.minWidth = '150px';
        this.buttonLabel.style.marginTop = '10px';




        const icon = document.createElement('span');
        icon.className = 'glyphicon glyphicon-print';
        icon.style.fontSize='40px';
        icon.style.color = '#007bff';
        this.buttonLabel.prepend(icon);
        this.buttonLabel.addEventListener('click', (event) => this.handleButtonClick(event));
        this.element.parentNode.insertBefore(this.buttonLabel, this.element.nextSibling);

        // Label for managing saved PDF
        this.pdfButtonLabel = document.createElement('div');
        this.pdfButtonLabel.style.display = 'none';
        this.pdfButtonLabel.style.textAlign = 'center';
        this.pdfButtonLabel.style.padding = '10px 20px';
        this.pdfButtonLabel.style.backgroundColor = 'transparent';
        this.pdfButtonLabel.style.color = '#007bff';
        this.pdfButtonLabel.style.border = '1px solid #007bff';
        this.pdfButtonLabel.style.borderRadius = '5px';
        this.pdfButtonLabel.style.cursor = 'pointer';
        this.pdfButtonLabel.style.fontSize = '16px';
        this.pdfButtonLabel.style.textAlign = 'center';
        this.pdfButtonLabel.style.justifyContent = 'space-evenly';
        this.pdfButtonLabel.style.alignItems = 'center';
        this.pdfButtonLabel.style.flexDirection = 'column';
        this.pdfButtonLabel.style.minHeight = '150px';
        this.pdfButtonLabel.style.minWidth = '150px';
        this.pdfButtonLabel.style.marginTop = '10px';

        const pdfIcon = document.createElement('span');
        pdfIcon.className = 'glyphicon glyphicon-file';
        pdfIcon.style.fontSize = '40px';
        pdfIcon.style.color = '#007bff';
        this.pdfButtonLabel.appendChild(pdfIcon);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = this.deleteBtnText;
        deleteButton.style.marginTop = '10px';
        deleteButton.addEventListener('click', (event) => this.deletePdf(event));

        const retakeButton = document.createElement('button');
        retakeButton.className = 'btn btn-primary';
        retakeButton.textContent = this.retakeBtnText;
        retakeButton.style.marginTop = '10px';
        retakeButton.addEventListener('click', (event) => this.retakeScan(event));

        const downloadPDFButton = document.createElement('button');
        downloadPDFButton.className = 'btn btn-success';
        downloadPDFButton.textContent = this.downloadScanBtnText;
        downloadPDFButton.style.marginTop = '10px';

        downloadPDFButton.addEventListener('click', (event) => this.downloadScanPDF(event));

        this.pdfButtonLabel.appendChild(deleteButton);
        this.pdfButtonLabel.appendChild(retakeButton);
        if(this.showDownloadBtn){
            this.pdfButtonLabel.appendChild(downloadPDFButton);
        }

        this.element.parentNode.insertBefore(this.pdfButtonLabel, this.buttonLabel.nextSibling);
    }

    initHTML() {
        this.scannerUI = document.createElement('div');
        this.scannerUI.innerHTML = `
            <div class="loader hidden" id="loader"></div>
<!--            <div class="row mb-3">-->
<!--                <div class="col-xs-12">-->
<!--                    <div id="controls" class="d-flex justify-content-between">-->
<!--                        <input type="file" id="imageInput" accept="image/*" capture="environment" class="form-control" style="display:none;">-->
<!--                    </div>-->
<!--                </div>-->
<!--            </div>-->
<!--            <div id="highlightViewContainer" class="row hidden">-->
<!--                <div class="col-xs-12 mb-3">-->
<!--                    <div class="canvas-container">-->
<!--                        <canvas id="highlightedCanvas"></canvas>-->
<!--                    </div>-->
<!--                </div>-->
<!--            </div>-->
            <div id="adjustViewContainer" class="row hidden">
                <div class="col-xs-12 mb-3">
                    <div class="adjust-container">
                        <canvas id="adjustCanvas"></canvas>
                        <div id="topLeftCorner" class="corner"><div class="corner-inside"></div></div>
                        <div id="topRightCorner" class="corner"><div class="corner-inside"></div></div>
                        <div id="bottomLeftCorner" class="corner"><div class="corner-inside"></div></div>
                        <div id="bottomRightCorner" class="corner"><div class="corner-inside"></div></div>
                    </div>
                    
                </div>
                <div class="col-xs-12 d-flex justify-content-around " style="margin-top: 10px; margin-bottom: 10px;">
                    <button type="button" id="okBtn" class="btn btn-primary btn-lg hidden">${this.okBtnText}</button>
                </div>
            </div>
            <div id="largeViewContainer" class="row hidden">
                <div class="col-xs-12 mb-3">
                    <img id="largeViewImage" src="" style="width: 100%; height: auto; border: 1px solid #ccc; border-radius: 5px;">
                </div>
            </div>
            <div class="row">
                <div class="col-xs-12">
                    <div id="resultPages"></div>
                </div>
            </div>
            <div class="row mb-3">
                <div class="col-xs-12 d-flex justify-content-around">
                    <button type="button" id="saveBtn" class="btn btn-success btn-lg hidden">${this.saveBtnText}</button>
                </div>
            </div>
        `;
        if (this.mode === 'modal') {
            this.createModal();
        } else {
            this.element.parentNode.insertBefore(this.scannerUI, this.element.nextSibling);
        }
        this.loader = this.scannerUI.querySelector("#loader");
        //this.highlightedCanvas = this.scannerUI.querySelector("#highlightedCanvas");
        this.adjustCanvas = this.scannerUI.querySelector("#adjustCanvas");
        //this.highlightedCtx = this.highlightedCanvas.getContext("2d");
        this.adjustCtx = this.adjustCanvas.getContext("2d");
        this.imageInput = this.element;
        this.okBtn = this.scannerUI.querySelector("#okBtn");
        // this.addPageBtn = this.scannerUI.querySelector("#addPageBtn");
        this.saveBtn = this.scannerUI.querySelector("#saveBtn");
        this.resultPages = this.scannerUI.querySelector("#resultPages");
        this.cornerElements = {
            topLeftCorner: this.scannerUI.querySelector("#topLeftCorner"),
            topRightCorner: this.scannerUI.querySelector("#topRightCorner"),
            bottomLeftCorner: this.scannerUI.querySelector("#bottomLeftCorner"),
            bottomRightCorner: this.scannerUI.querySelector("#bottomRightCorner")
        };
        this.cornerPoints = {
            topLeftCorner: {x: 50, y: 50},
            topRightCorner: {x: 590, y: 50},
            bottomLeftCorner: {x: 50, y: 430},
            bottomRightCorner: {x: 590, y: 430}
        };
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'modal fade';
        this.modal.id = 'scannerModal';
        this.modal.tabIndex = '-1';
        this.modal.setAttribute('aria-labelledby', 'scannerModalLabel');
        this.modal.setAttribute('aria-hidden', 'true');
        this.modal.setAttribute('data-keyboard', 'false');
        this.modal.setAttribute('data-backdrop', 'static');
        this.modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="scannerModalLabel">${this.modalTitle}</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.modal);
        this.modalBody = this.modal.querySelector('.modal-body');
        this.modalBody.appendChild(this.scannerUI);

    }

    initServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('src/js/service-worker.js')
                .then(function (registration) {
                    console.log('Service worker registered with scope:', registration.scope);
                }).catch(function (error) {
                console.log('Service worker registration failed:', error);
            });
        }
    }

    loadOpenCV() {
        const script = document.createElement('script');
        script.src = 'src/js/opencv/opencv-4.7.0.js';
        script.async = true;
        document.head.appendChild(script);
    }

    loadJscanify() {
        const script = document.createElement('script');
        script.src = 'src/js/jscanify/src/jscanify.js';
        script.async = true;
        script.onload = () => {
            this.jscanify = new window.jscanify();
        };
        document.head.appendChild(script);
    }

    loadJsPDF() {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.4.0/jspdf.umd.min.js';
        script.async = true;
        script.onload = () => {
            this.jspdf = window.jspdf.jsPDF;
        };
        document.head.appendChild(script);
    }

    addEventListeners() {
        this.element.addEventListener("change", this.handleImageInput.bind(this));
        //this.buttonLabel.addEventListener("click", this.handleButtonClick.bind(this));
        this.okBtn.addEventListener("click", this.handleOkClick.bind(this));
        //this.addPageBtn.addEventListener("click", this.handleAddPageClick.bind(this));
        this.saveBtn.addEventListener("click", this.handleSaveClick.bind(this));
        for (let corner in this.cornerElements) {
            this.cornerElements[corner].addEventListener('pointerdown', this.onPointerDown(corner).bind(this));
        }
    }

    handleButtonClick(event) {
        event.preventDefault(); // Prevent default behavior
        if (!this.savedPdf) {
            this.imageInput.click();
            if (this.mode === 'modal') {
                $('#' + this.modal.id).modal('show');
            }
        }
    }

    handleImageInput(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.showLoader();

                    //this.highlightedCanvas.width = img.width;
                    //this.highlightedCanvas.height = img.height;
                    this.adjustCanvas.width = img.width;
                    this.adjustCanvas.height = img.height;

                    //this.highlightedCtx.drawImage(img, 0, 0, this.highlightedCanvas.width, this.highlightedCanvas.height);

                    const resultCanvas = this.jscanify.highlightPaper(img);
                    //this.highlightedCtx.drawImage(resultCanvas, 0, 0, this.highlightedCanvas.width, this.highlightedCanvas.height);

                    const contour = this.jscanify.findPaperContour(cv.imread(resultCanvas));
                    this.cornerPoints = this.jscanify.getCornerPoints(contour);

                    const scaleX = this.adjustCanvas.width / resultCanvas.width;
                    const scaleY = this.adjustCanvas.height / resultCanvas.height;
                    const defaultCornerPoints = {
                        topLeftCorner: { x: 0, y: 0 },
                        topRightCorner: { x: this.adjustCanvas.width, y: 0 },
                        bottomLeftCorner: { x: 0, y: this.adjustCanvas.height },
                        bottomRightCorner: { x: this.adjustCanvas.width, y: this.adjustCanvas.height }
                    };
                    for (let corner in this.cornerPoints) {
                        if (!this.cornerPoints[corner]) {
                            this.cornerPoints[corner] = defaultCornerPoints[corner];
                        }
                        this.cornerPoints[corner].x *= scaleX;
                        this.cornerPoints[corner].y *= scaleY;
                    }

                    this.adjustCanvas.image = img;
                    this.drawHighlightRect();
                    this.updateCornerElements();

                    this.hideLoader();
                    //this.scannerUI.querySelector("#highlightViewContainer").classList.remove('hidden');
                    this.okBtn.classList.remove('hidden');
                    this.scannerUI.querySelector("#adjustViewContainer").classList.remove('hidden');
                    this.scannerUI.querySelector("#largeViewContainer").classList.add('hidden');
                    setTimeout(this.updateCornerElements.bind(this), 100);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    handleOkClick() {
        this.showLoader();

        const width = this.adjustCanvas.width;
        const height = this.adjustCanvas.height;
        const resultCanvas = this.jscanify.extractPaper(this.adjustCanvas.image, width, height, this.cornerPoints);

        const image = resultCanvas.toDataURL("image/png");
        this.images.push(image);

        this.displayPages();
        this.resetForNewPage();

        this.hideLoader();
    }

    handleAddPageClick() {
        this.resetForNewPageInput();
        this.imageInput.click(); // Open file input dialog again
    }

    handleSaveClick() {
        this.showLoader();
        if(this.images.length < 1){
            this.hideLoader();
            if (this.mode === 'modal') {
                $('#' + this.modal.id).modal('hide');
            }
            if (this.onSave) {
                this.onSave(null);
            }
            return;
        }
        const doc = new this.jspdf();

        this.images.forEach((img, index) => {
            if (index > 0) {
                doc.addPage();
            }
            doc.addImage(img, 'PNG', 0, 0, 210, 297);
        });

        const pdfData = doc.output('blob');
        this.savedPdf = pdfData; // Store the PDF reference
        if (this.onSave) {
            this.onSave(pdfData);
        }
        this.images = []; // Clear the images list
        this.displayPages(); // Update the display
        this.updateButtonLabelToPdf(); // Update the button label
        this.hideLoader();
        if (this.mode === 'modal') {
            $('#' + this.modal.id).modal('hide');
        }
    }

    onPointerDown(corner) {
        return function (e) {
            e.preventDefault();
            this.isDragging = true;
            this.dragCorner = corner;
            document.addEventListener('pointermove', this.onPointerMove.bind(this));
            document.addEventListener('pointerup', this.onPointerUp.bind(this));
            document.addEventListener('pointercancel', this.onPointerUp.bind(this));
            document.addEventListener('touchmove', this.preventScroll, { passive: false });
        }.bind(this);
    }

    onPointerMove(e) {
        if (this.isDragging) {
            e.preventDefault();
            const rect = this.adjustCanvas.getBoundingClientRect();
            this.cornerPoints[this.dragCorner].x = (e.clientX - rect.left) * this.adjustCanvas.width / rect.width;
            this.cornerPoints[this.dragCorner].y = (e.clientY - rect.top) * this.adjustCanvas.height / rect.height;
            this.drawHighlightRect();
            this.updateCornerElements();
        }
    }

    onPointerUp() {
        this.isDragging = false;
        this.dragCorner = null;
        document.removeEventListener('pointermove', this.onPointerMove.bind(this));
        document.removeEventListener('pointerup', this.onPointerUp.bind(this));
        document.removeEventListener('pointercancel', this.onPointerUp.bind(this));
        document.removeEventListener('touchmove', this.preventScroll);
    }

    preventScroll(e) {
        e.preventDefault();
    }

    showLoader() {
        this.loader.classList.remove("hidden");
    }

    hideLoader() {
        this.loader.classList.add("hidden");
    }

    updateCornerElements() {
        const rect = this.adjustCanvas.getBoundingClientRect();
        for (let corner in this.cornerPoints) {
            this.cornerElements[corner].style.left = (this.cornerPoints[corner].x * rect.width / this.adjustCanvas.width - 12.5) + 'px';
            this.cornerElements[corner].style.top = (this.cornerPoints[corner].y * rect.height / this.adjustCanvas.height - 12.5) + 'px';
        }
    }

    drawHighlightRect() {
        this.adjustCtx.clearRect(0, 0, this.adjustCanvas.width, this.adjustCanvas.height);
        this.adjustCtx.drawImage(this.adjustCanvas.image, 0, 0, this.adjustCanvas.width, this.adjustCanvas.height);
        this.adjustCtx.strokeStyle = 'red';
        this.adjustCtx.lineWidth = window.innerWidth <= 768 ? 5 : 2;
        this.adjustCtx.beginPath();
        this.adjustCtx.moveTo(this.cornerPoints.topLeftCorner.x, this.cornerPoints.topLeftCorner.y);
        this.adjustCtx.lineTo(this.cornerPoints.topRightCorner.x, this.cornerPoints.topRightCorner.y);
        this.adjustCtx.lineTo(this.cornerPoints.bottomRightCorner.x, this.cornerPoints.bottomRightCorner.y);
        this.adjustCtx.lineTo(this.cornerPoints.bottomLeftCorner.x, this.cornerPoints.bottomLeftCorner.y);
        this.adjustCtx.closePath();
        this.adjustCtx.stroke();
    }

    displayPagesBig() {
        this.resultPages.innerHTML = '';
        this.images.forEach((img, index) => {
            let imgElement = document.createElement("img");
            imgElement.src = img;
            imgElement.classList.add("page");

            let pageNumber = document.createElement("div");
            pageNumber.textContent = "Page " + (index + 1);

            this.resultPages.appendChild(pageNumber);
            this.resultPages.appendChild(imgElement);
        });
    }

    displayPagesWithoutDelete() {
        this.resultPages.innerHTML = '';
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid-container';

        this.images.forEach((img, index) => {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';

            const imgElement = document.createElement('img');
            imgElement.src = img;
            imgElement.classList.add('page');

            const pageNumber = document.createElement('div');
            pageNumber.textContent = "Page " + (index + 1);

            gridItem.appendChild(imgElement);
            gridItem.appendChild(pageNumber);
            gridContainer.appendChild(gridItem);
        });

        const addPageButton = document.createElement('div');
        addPageButton.className = 'add-page-button';
        addPageButton.innerHTML = this.addAnotherPageBtnText;
        addPageButton.addEventListener('click', this.handleAddPageClick.bind(this));
        gridContainer.appendChild(addPageButton);

        this.resultPages.appendChild(gridContainer);
    }
    displayPages() {
        this.resultPages.innerHTML = '';
        const gridContainer = document.createElement('div');
        gridContainer.className = 'grid-container';

        this.images.forEach((img, index) => {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';

            const imgElement = document.createElement('img');
            imgElement.src = img;
            imgElement.classList.add('page');

            const pageNumber = document.createElement('div');
            pageNumber.textContent = "Page " + (index + 1);

            const pageOverlay = document.createElement('div');
            pageOverlay.className = 'page-overlay';

            const deleteButton = document.createElement('button');
            deleteButton.className = 'page-button delete';
            deleteButton.textContent = this.deletePageBtnText;
            deleteButton.addEventListener('click', () => this.deletePage(index));

            const viewButton = document.createElement('button');
            viewButton.className = 'page-button view';
            viewButton.textContent = this.viewPageBtnText;
            viewButton.addEventListener('click', () => this.viewLargePage(index));

            pageOverlay.appendChild(deleteButton);
            pageOverlay.appendChild(viewButton);

            gridItem.appendChild(imgElement);
            gridItem.appendChild(pageNumber);
            gridItem.appendChild(pageOverlay);
            gridContainer.appendChild(gridItem);
        });

        const addPageButton = document.createElement('div');
        addPageButton.className = 'add-page-button';
        addPageButton.innerHTML = this.addAnotherPageBtnText;
        addPageButton.addEventListener('click', this.handleAddPageClick.bind(this));
        gridContainer.appendChild(addPageButton);

        this.resultPages.appendChild(gridContainer);
    }
    resetForNewPage() {
        this.okBtn.classList.add('hidden');
        //this.scannerUI.querySelector("#highlightViewContainer").classList.add('hidden');
        this.scannerUI.querySelector("#adjustViewContainer").classList.add('hidden');
        //this.addPageBtn.classList.remove('hidden');
        this.saveBtn.classList.remove('hidden');
        this.imageInput.value = '';
    }

    resetForNewPageInput() {
        //this.scannerUI.querySelector("#highlightViewContainer").classList.add('hidden');
        this.scannerUI.querySelector("#adjustViewContainer").classList.add('hidden');
        this.okBtn.classList.add('hidden');
        this.imageInput.value = '';
    }

    deletePage(index) {
        this.images.splice(index, 1);
        this.displayPages();
        if (this.currentViewedImageIndex === index) {
            this.clearLargeView();
        }
    }

    viewLargePage(index) {
        this.currentViewedImageIndex = index;
        const largeViewImage = this.scannerUI.querySelector('#largeViewImage');
        largeViewImage.src = this.images[index];
        this.scannerUI.querySelector("#largeViewContainer").classList.remove('hidden');
    }

    clearLargeView() {
        const largeViewImage = this.scannerUI.querySelector('#largeViewImage');
        largeViewImage.src = '';
        this.scannerUI.querySelector("#largeViewContainer").classList.add('hidden');
    }


    updateButtonLabelToPdf() {
        this.buttonLabel.style.display = 'none';
        this.pdfButtonLabel.style.display = 'inline-flex';
    }

    deletePdf(event) {
        event.stopPropagation();
        this.savedPdf = null;
        this.images = []; // Clear the images list
        this.displayPages(); // Update the display
        this.resetButtonLabel();
    }

    retakeScan(event) {
        event.stopPropagation();
        this.savedPdf = null;
        this.images = []; // Clear the images list
        this.displayPages(); // Update the display
        this.clearLargeView();
        this.resetButtonLabel();
        this.resetForNewPageInput();
        this.handleButtonClick(event);
    }

    downloadScanPDF(event) {
        event.stopPropagation();
        if (this.savedPdf) {
            const url = URL.createObjectURL(this.savedPdf);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scanned_document.pdf';
            a.target = '_blank'; // Open in a new tab
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url); // Clean up the URL object
        } else {
            alert('No PDF available to download.');
        }
    }

    resetButtonLabel() {
        this.pdfButtonLabel.style.display = 'none';
        this.buttonLabel.style.display = 'inline-flex';
    }
}

window.DocumentScanner = DocumentScanner;