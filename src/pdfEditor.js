import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export class PDFEditor {
  constructor(container) {
    this.container = container;
    this.pdfData = null;
    this.pages = [];
    this.textEdits = new Map();
  }

  async loadPDF(arrayBuffer) {
    this.pdfData = arrayBuffer;
    this.container.innerHTML = '';

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      await this.renderPage(page, pageNum);
    }
  }

  async renderPage(page, pageNum) {
    const viewport = page.getViewport({ scale: 1.5 });

    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${viewport.width}px`;
    pageContainer.style.height = `${viewport.height}px`;

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-canvas';
    const context = canvas.getContext('2d');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const textLayer = document.createElement('div');
    textLayer.className = 'text-layer';

    const textContent = await page.getTextContent();

    textContent.items.forEach((item, index) => {
      if (!item.str.trim()) return;

      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

      const fontSize = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
      const fontFamily = item.fontName || 'sans-serif';

      const textElement = document.createElement('div');
      textElement.className = 'text-element';
      textElement.textContent = item.str;

      textElement.style.left = `${tx[4]}px`;
      textElement.style.top = `${tx[5] - fontSize}px`;
      textElement.style.fontSize = `${fontSize}px`;
      textElement.style.fontFamily = fontFamily;
      textElement.style.transform = `scaleX(${item.width / (item.str.length * fontSize * 0.5)})`;
      textElement.style.transformOrigin = 'left top';

      const textId = `page${pageNum}-text${index}`;
      textElement.dataset.textId = textId;
      textElement.dataset.pageNum = pageNum;

      this.textEdits.set(textId, {
        originalText: item.str,
        currentText: item.str,
        x: tx[4],
        y: tx[5] - fontSize,
        fontSize: fontSize,
        fontFamily: fontFamily,
        transform: item.transform,
        width: item.width
      });

      textElement.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.startEditing(textElement, textId);
      });

      textLayer.appendChild(textElement);
    });

    pageContainer.appendChild(canvas);
    pageContainer.appendChild(textLayer);
    this.container.appendChild(pageContainer);

    this.pages.push({
      pageNum,
      canvas,
      textLayer,
      viewport
    });
  }

  startEditing(textElement, textId) {
    if (textElement.classList.contains('editing')) return;

    const textData = this.textEdits.get(textId);
    const rect = textElement.getBoundingClientRect();
    const containerRect = textElement.parentElement.getBoundingClientRect();

    textElement.classList.add('editing');
    textElement.style.visibility = 'hidden';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.value = textData.currentText;

    input.style.left = textElement.style.left;
    input.style.top = textElement.style.top;
    input.style.fontSize = textElement.style.fontSize;
    input.style.fontFamily = textElement.style.fontFamily;
    input.style.width = `${Math.max(200, rect.width)}px`;

    const saveEdit = () => {
      const newText = input.value;
      textData.currentText = newText;
      textElement.textContent = newText;
      textElement.classList.remove('editing');
      textElement.style.visibility = 'visible';
      input.remove();
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveEdit();
      } else if (e.key === 'Escape') {
        input.value = textData.currentText;
        saveEdit();
      }
    });

    textElement.parentElement.appendChild(input);
    input.focus();
    input.select();
  }

  async exportPDF() {
    const pdfDoc = await PDFDocument.load(this.pdfData);
    const pages = pdfDoc.getPages();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    this.textEdits.forEach((textData, textId) => {
      if (textData.currentText === textData.originalText) return;

      const pageNum = parseInt(textId.match(/page(\d+)/)[1]);
      const page = pages[pageNum - 1];
      const { height } = page.getSize();

      const viewport = this.pages[pageNum - 1].viewport;
      const scale = 1.5;

      const pdfX = textData.x / scale;
      const pdfY = height - (textData.y / scale);

      const pdfFontSize = textData.fontSize / scale;

      page.drawRectangle({
        x: pdfX - 2,
        y: pdfY - pdfFontSize - 2,
        width: (textData.width / scale) + 4,
        height: pdfFontSize + 4,
        color: rgb(1, 1, 1),
        borderWidth: 0
      });

      if (textData.currentText.trim()) {
        page.drawText(textData.currentText, {
          x: pdfX,
          y: pdfY - pdfFontSize,
          size: pdfFontSize,
          font: font,
          color: rgb(0, 0, 0)
        });
      }
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'edited-document.pdf';
    link.click();

    URL.revokeObjectURL(url);
  }
}
