// app.js — Aviary Bird Species Identifier
// Stage 1: Static UI — drag-and-drop, image preview, results toggle

const uploadZone  = document.getElementById('uploadZone');
const fileInput   = document.getElementById('fileInput');
const uploadIdle  = document.getElementById('uploadIdle');
const uploadPreview = document.getElementById('uploadPreview');
const previewImg  = document.getElementById('previewImg');
const changeBtn   = document.getElementById('changeBtn');
const dragOverlay = document.getElementById('dragOverlay');
const predictBtn  = document.getElementById('predictBtn');
const resultsPanel = document.getElementById('resultsPanel');
const resetBtn    = document.getElementById('resetBtn');

// ── Show image preview ──────────────────────────────────────────
function showPreview(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    uploadIdle.style.display   = 'none';
    uploadPreview.classList.add('is-visible');
    predictBtn.hidden = false;
    resultsPanel.hidden = true;   // hide stale results if any
  };
  reader.readAsDataURL(file);
}

// ── Reset to idle state ─────────────────────────────────────────
function resetToIdle() {
  previewImg.src = '';
  uploadPreview.classList.remove('is-visible');
  uploadIdle.style.display = '';
  predictBtn.hidden = true;
  resultsPanel.hidden = true;
  fileInput.value = '';           // allow re-selecting the same file
}

// ── Click the zone → open file picker ──────────────────────────
uploadZone.addEventListener('click', (e) => {
  // Don't re-open picker when clicking the Change button
  if (e.target.closest('.upload-zone__change')) return;
  fileInput.click();
});

// Keyboard: Enter or Space activates the zone
uploadZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

// ── File input change ───────────────────────────────────────────
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) showPreview(fileInput.files[0]);
});

// ── Change photo button ─────────────────────────────────────────
changeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  resetToIdle();
  fileInput.click();
});

// ── Drag-and-drop ───────────────────────────────────────────────
let dragCounter = 0;  // track nested drag-enter/leave events

uploadZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  uploadZone.classList.add('is-dragging');
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();  // required to allow drop
});

uploadZone.addEventListener('dragleave', () => {
  dragCounter--;
  if (dragCounter === 0) uploadZone.classList.remove('is-dragging');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  uploadZone.classList.remove('is-dragging');
  const file = e.dataTransfer.files[0];
  if (file) showPreview(file);
});

// ── Predict button → show results ──────────────────────────────
predictBtn.addEventListener('click', () => {
  resultsPanel.hidden = false;
  resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ── Reset button ────────────────────────────────────────────────
resetBtn.addEventListener('click', resetToIdle);