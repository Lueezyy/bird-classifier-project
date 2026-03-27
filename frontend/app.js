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

// For the results panel content (these IDs don't exist in your HTML)
// We'll create references to the existing elements instead
const speciesName = document.querySelector('.results__name');
const confidenceValue = document.querySelector('.confidence__value');
const confidenceFill = document.querySelector('.confidence__fill');
const birdDescription = document.querySelector('.results__description');
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

// ── Predict button → send image to backend ──────────────────────────────
predictBtn.addEventListener('click', async () => {
  // Check if we have an image
  if (!previewImg.src || previewImg.src === '') {
    alert('Please upload a bird photo first');
    return;
  }

  // Get the file from the file input
  const file = fileInput.files[0];
  if (!file) {
    alert('No image file found. Please upload again.');
    return;
  }

  // Save original button content
  const originalHTML = predictBtn.innerHTML;
  
  // Disable button and show loading state
  predictBtn.disabled = true;
  predictBtn.classList.add('btn-predict--loading');
  predictBtn.innerHTML = `
    <span class="btn-predict__spinner" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: spin 0.8s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-opacity="0.3"/>
        <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </span>
    Analyzing image...
  `;

  try {
    // Optional: Add a 3-second delay to make loading state visible (remove this in production)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create form data and append the image
    const formData = new FormData();
    formData.append('image', file);

    // Send to Flask backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch('http://localhost:5000/predict', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle HTTP error status codes
      let errorMessage = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) errorMessage = errorData.error;
      } catch (e) {
        // If response isn't JSON, use default message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Clear any previous error state
    resultsPanel.classList.remove('results--error');
    
    // Update results panel with backend data
    const speciesName = document.querySelector('.results__name');
    const latinName = document.querySelector('.results__latin');
    const confidenceValue = document.querySelector('.confidence__value');
    const confidenceFill = document.querySelector('.confidence__fill');
    const confidenceTrack = document.querySelector('.confidence__track');
    const birdDescription = document.querySelector('.results__description');
    const tags = document.querySelectorAll('.results__tags .tag');

    // Update species name
    if (speciesName) speciesName.textContent = data.species;
    
    // Update Latin name (if provided, otherwise show placeholder)
    if (latinName) {
      if (data.latin_name) {
        latinName.innerHTML = `<em>${data.latin_name}</em>`;
      } else {
        latinName.innerHTML = `<em>Species identified</em>`;
      }
    }
    
    // Update confidence percentage and progress bar
    const confidencePercent = Math.round(data.confidence * 100);
    if (confidenceValue) confidenceValue.textContent = `${confidencePercent}%`;
    if (confidenceFill) {
      confidenceFill.style.width = `${confidencePercent}%`;
      // Update aria attributes for accessibility
      if (confidenceTrack) {
        confidenceTrack.setAttribute('aria-valuenow', confidencePercent);
      }
    }
    
    // Update description
    if (birdDescription) birdDescription.textContent = data.description;
    
    // Optional: Update tags if provided in response
    if (data.tags && tags.length) {
      tags.forEach((tag, index) => {
        if (data.tags[index]) {
          tag.textContent = data.tags[index];
        }
      });
    }

    // Show results panel with success styling
    resultsPanel.hidden = false;
    resultsPanel.classList.remove('results--error');
    resultsPanel.classList.add('results--animate');
    setTimeout(() => {
      resultsPanel.classList.remove('results--animate');
    }, 500);
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (error) {
    console.error('Error:', error);
    
    // Determine error type and create user-friendly message
    let errorTitle = 'Unable to identify bird';
    let errorMessage = '';
    let errorIcon = '⚠️';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Request timed out. The server is taking too long to respond. Please check if Flask is running and try again.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage = 'Cannot connect to the backend server. Please make sure Flask is running on http://localhost:5000 and try again.';
    } else if (error.message.includes('Server error: 500')) {
      errorMessage = 'The server encountered an internal error. Please check the Flask terminal for details.';
    } else if (error.message.includes('Server error: 404')) {
      errorMessage = 'The /predict endpoint was not found. Make sure your Flask app has this route defined.';
    } else if (error.message.includes('Server error: 400')) {
      errorMessage = 'Invalid request. Please make sure you uploaded a valid image file.';
    } else {
      errorMessage = error.message || 'An unexpected error occurred. Please try again.';
    }
    
    // Show error state in results panel
    const speciesName = document.querySelector('.results__name');
    const latinName = document.querySelector('.results__latin');
    const confidenceValue = document.querySelector('.confidence__value');
    const confidenceFill = document.querySelector('.confidence__fill');
    const confidenceTrack = document.querySelector('.confidence__track');
    const birdDescription = document.querySelector('.results__description');
    const tags = document.querySelectorAll('.results__tags .tag');
    
    // Update UI with error information
    if (speciesName) speciesName.textContent = errorTitle;
    if (latinName) latinName.innerHTML = `<em>${errorIcon} Error</em>`;
    if (confidenceValue) confidenceValue.textContent = '—';
    if (confidenceFill) confidenceFill.style.width = '0%';
    if (confidenceTrack) confidenceTrack.setAttribute('aria-valuenow', 0);
    if (birdDescription) {
      birdDescription.innerHTML = `
        <strong style="color: var(--error-color, #d32f2f);">${errorMessage}</strong><br><br>
        <small>💡 Tips:</small><br>
        • Make sure Flask is running: <code>python app.py</code><br>
        • Check that the server is on port 5000<br>
        • Verify your image is a valid JPG or PNG<br>
        • Look at the Flask terminal for error details
      `;
    }
    
    // Update tags to show error state
    if (tags.length) {
      tags.forEach(tag => {
        tag.textContent = '⚠️';
      });
    }
    
    // Add error class for styling
    resultsPanel.classList.add('results--error');
    resultsPanel.classList.remove('results--animate');
    
    // Show results panel with error
    resultsPanel.hidden = false;
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
  } finally {
    // Restore button state
    predictBtn.disabled = false;
    predictBtn.classList.remove('btn-predict--loading');
    predictBtn.innerHTML = originalHTML;
  }
});
// ── Reset button ────────────────────────────────────────────────
resetBtn.addEventListener('click', resetToIdle);