// Cache for tracking textareas that already have buttons
const processedTextareas = new WeakSet();

// Create a button for a textarea
function createButton(textarea) {
  const button = document.createElement('button');
  button.textContent = '📋';
  button.style.cssText = `
      position: absolute;
      background: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      cursor: pointer;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

  // Position the button
  const updatePosition = () => {
    const rect = textarea.getBoundingClientRect();
    button.style.top = `${rect.bottom - 30 + window.scrollY}px`;
    button.style.left = `${rect.right - 30 + window.scrollX}px`;
  };

  // Add click handler
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    alert(textarea.value);
  });

  // Append button to the document
  document.body.appendChild(button);
  updatePosition();

  // Update position on scroll and resize
  window.addEventListener('scroll', updatePosition);
  window.addEventListener('resize', updatePosition);
}

// Find all textareas and create overlays
function createOverlays() {
  const textareas = document.querySelectorAll('textarea');

  textareas.forEach((textarea) => {
    if (processedTextareas.has(textarea)) return; // Skip if already processed

    createButton(textarea);
    processedTextareas.add(textarea);
  });
}

// Listen for count requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCount') {
    sendResponse({ count: document.querySelectorAll('textarea').length });
  }
  return true; // Keep the message channel open for async response
});

// MutationObserver for dynamic content
const observer = new MutationObserver(() => {
  createOverlays();
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial run
createOverlays();
