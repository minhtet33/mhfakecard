import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';
import { PDFEditor } from './pdfEditor.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

let pdfEditor = null;

const uploadInput = document.getElementById('pdf-upload');
const uploadContainer = document.getElementById('upload-container');
const editorContainer = document.getElementById('editor-container');
const canvasWrapper = document.getElementById('canvas-wrapper');
const exportBtn = document.getElementById('export-btn');

uploadInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  uploadContainer.style.display = 'none';
  editorContainer.style.display = 'flex';

  canvasWrapper.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading PDF...</p></div>';

  try {
    const arrayBuffer = await file.arrayBuffer();

    pdfEditor = new PDFEditor(canvasWrapper);
    await pdfEditor.loadPDF(arrayBuffer);

    exportBtn.disabled = false;
  } catch (error) {
    console.error('Error loading PDF:', error);
    alert('Failed to load PDF. Please try another file.');
    canvasWrapper.innerHTML = '<p style="padding: 2rem;">Error loading PDF</p>';
  }
});

exportBtn.addEventListener('click', async () => {
  if (!pdfEditor) return;

  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';

  try {
    await pdfEditor.exportPDF();
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Failed to export PDF. Please try again.');
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export PDF';
  }
});
