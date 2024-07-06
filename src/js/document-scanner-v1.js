class DocumentScannerV1 {
    constructor(options) {
        this.element = typeof options.element === 'string' ? document.querySelector(options.element) : options.element;
        this.onSave = options.onSave;
        this.images = [];
        this.isDragging = false;
        this.dragCorner = null;

        this.initHTML();
        this.initServiceWorker();
        this.loadOpenCV();
        this.loadJscanify();
        this.loadJsPDF();
        this.addEventListeners();
    }

    initHTML() {
        this.element.innerHTML = `
            <div class="loader hidden" id="loader"></div>
            <div class="row mb-3">
                <div class="col-xs-12">
                    <div id="controls" class="d-flex justify-content-between">
                        <input type="file" id="imageInput" accept="image/*" capture="environment" class="form-control">
                    </div>
                </div>
            </div>
            <div id="highlightViewContainer" class="row hidden">
                <div class="col-xs-12 mb-3">
                    <h3>Highlighted Image (Debug)</h3>
                    <div class="canvas-container">
                        <canvas id="highlightedCanvas"></canvas>
                    </div>
                </div>
            </div>
            <div id="adjustViewContainer" class="row hidden">
                <div class="col-xs-12 mb-3">
                    <h3>Adjust Rectangle</h3>
                    <div class="adjust-container">
                        <canvas id="adjustCanvas"></canvas>
                        <div id="topLeftCorner" class="corner"><div class="corner-inside"></div></div>
                        <div id="topRightCorner" class="corner"><div class="corner-inside"></div></div>
                        <div id="bottomLeftCorner" class="corner"><div class="corner-inside"></div></div>
                        <div id="bottomRightCorner" class="corner"><div class="corner-inside"></div></div>
                    </div>
                    <div class="d-flex justify-content-center mt-3">
                        <button type="button" id="okBtn" class="btn btn-success hidden">OK</button>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-12">
                    <div id="resultPages"></div>
                </div>
            </div>
            <div class="row mb-3">
                <div class="col-xs-12 d-flex justify-content-between">
                    <button type="button" id="addPageBtn" class="btn btn-primary hidden">Add Another Page</button>
                    <button type="button" id="saveBtn" class="btn btn-secondary hidden">Save Scan</button>
                </div>
            </div>
        `;
        this.loader = this.element.querySelector("#loader");
        this.highlightedCanvas = this.element.querySelector("#highlightedCanvas");
        this.adjustCanvas = this.element.querySelector("#adjustCanvas");
        this.highlightedCtx = this.highlightedCanvas.getContext("2d");
        this.adjustCtx = this.adjustCanvas.getContext("2d");
        this.imageInput = this.element.querySelector("#imageInput");
        this.okBtn = this.element.querySelector("#okBtn");
        this.addPageBtn = this.element.querySelector("#addPageBtn");
        this.saveBtn = this.element.querySelector("#saveBtn");
        this.resultPages = this.element.querySelector("#resultPages");
        this.cornerElements = {
            topLeftCorner: this.element.querySelector("#topLeftCorner"),
            topRightCorner: this.element.querySelector("#topRightCorner"),
            bottomLeftCorner: this.element.querySelector("#bottomLeftCorner"),
            bottomRightCorner: this.element.querySelector("#bottomRightCorner")
        };
        this.cornerPoints = {
            topLeftCorner: {x: 50, y: 50},
            topRightCorner: {x: 590, y: 50},
            bottomLeftCorner: {x: 50, y: 430},
            bottomRightCorner: {x: 590, y: 430}
        };
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
        this.imageInput.addEventListener("change", this.handleImageInput.bind(this));
        this.okBtn.addEventListener("click", this.handleOkClick.bind(this));
        this.addPageBtn.addEventListener("click", this.handleAddPageClick.bind(this));
        this.saveBtn.addEventListener("click", this.handleSaveClick.bind(this));
        for (let corner in this.cornerElements) {
            this.cornerElements[corner].addEventListener('pointerdown', this.onPointerDown(corner).bind(this));
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

                    this.highlightedCanvas.width = img.width;
                    this.highlightedCanvas.height = img.height;
                    this.adjustCanvas.width = img.width;
                    this.adjustCanvas.height = img.height;

                    this.highlightedCtx.drawImage(img, 0, 0, this.highlightedCanvas.width, this.highlightedCanvas.height);

                    const resultCanvas = this.jscanify.highlightPaper(img);
                    this.highlightedCtx.drawImage(resultCanvas, 0, 0, this.highlightedCanvas.width, this.highlightedCanvas.height);

                    const contour = this.jscanify.findPaperContour(cv.imread(resultCanvas));
                    this.cornerPoints = this.jscanify.getCornerPoints(contour);

                    const scaleX = this.adjustCanvas.width / resultCanvas.width;
                    const scaleY = this.adjustCanvas.height / resultCanvas.height;
                    for (let corner in this.cornerPoints) {
                        this.cornerPoints[corner].x *= scaleX;
                        this.cornerPoints[corner].y *= scaleY;
                    }

                    this.adjustCanvas.image = img;
                    this.drawHighlightRect();
                    this.updateCornerElements();

                    this.hideLoader();
                    this.element.querySelector("#highlightViewContainer").classList.remove('hidden');
                    this.okBtn.classList.remove('hidden');
                    this.element.querySelector("#adjustViewContainer").classList.remove('hidden');
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
        this.imageInput.click();
    }

    handleSaveClick() {
        this.showLoader();
        const doc = new this.jspdf();

        this.images.forEach((img, index) => {
            if (index > 0) {
                doc.addPage();
            }
            doc.addImage(img, 'PNG', 0, 0, 210, 297);
        });

        const pdfData = doc.output('blob');
        if (this.onSave) {
            this.onSave(pdfData);
        }

        this.hideLoader();
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
        };
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
            this.cornerElements[corner].style.left = (this.cornerPoints[corner].x * rect.width / this.adjustCanvas.width - 7.5) + 'px';
            this.cornerElements[corner].style.top = (this.cornerPoints[corner].y * rect.height / this.adjustCanvas.height - 7.5) + 'px';
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

    displayPages() {
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

    resetForNewPage() {
        this.okBtn.classList.add('hidden');
        this.element.querySelector("#highlightViewContainer").classList.add('hidden');
        this.element.querySelector("#adjustViewContainer").classList.add('hidden');
        this.addPageBtn.classList.remove('hidden');
        this.saveBtn.classList.remove('hidden');
        this.imageInput.value = '';
    }

    resetForNewPageInput() {
        this.element.querySelector("#highlightViewContainer").classList.add('hidden');
        this.element.querySelector("#adjustViewContainer").classList.add('hidden');
        this.okBtn.classList.add('hidden');
        this.imageInput.value = '';
    }
}

window.DocumentScanner = DocumentScanner;