// Cache for tracking textareas that already have buttons
const processedTextareas = new WeakSet();

// Find all textareas and create overlays
function createOverlays() {
  const textareas = document.querySelectorAll('textarea');

  textareas.forEach(textarea => {
    // Skip if this textarea already has a button
    if (processedTextareas.has(textarea)) return;

    const button = document.createElement('button');
    button.setAttribute('data-textarea-overlay', 'true');

    // Style the button
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

    button.textContent = '📋';

    // Use more efficient positioning
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

    // Optimize hover effect using classList
    button.addEventListener('mouseenter', () => {
      button.style.background = '#2b76f5';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#4285f4';
    });

    document.body.appendChild(button);
    processedTextareas.add(textarea);
    updatePosition();

    // Update position on scroll and resize
    const debouncedUpdatePosition = debounce(updatePosition, 100);
    window.addEventListener('scroll', debouncedUpdatePosition, { passive: true });
    window.addEventListener('resize', debouncedUpdatePosition, { passive: true });
  });
}

// More efficient debounce function
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Listen for count requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCount") {
    sendResponse({count: document.querySelectorAll('textarea').length});
  }
  return true; // Keep the message channel open for async response
});

// Initialize
const debouncedCreateOverlays = debounce(createOverlays, 250);

// More efficient mutation observer
const observer = new MutationObserver((mutations) => {
  // Only run if we actually see new nodes added
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      debouncedCreateOverlays();
      break;
    }
  }
});

// Start observing with optimized options
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});

// Initial run
createOverlays();
