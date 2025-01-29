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
  button.addEventListener('click', async (e) => {
    e.stopPropagation();

    // Get settings from storage
    const settings = await chrome.storage.sync.get(['apiKey', 'model']);

    if (!settings.apiKey || !settings.model) {
        alert('Please configure your API key and model in the extension popup');
        return;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [
                    {
                        role: 'user',
                        content: textarea.value
                    }
                ],
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        // Clear the textarea before starting
        const originalText = textarea.value;
        textarea.value = '';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk
            const chunk = decoder.decode(value);

            // Split into lines and process each one
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.trim() === 'data: [DONE]') continue;
                if (!line.startsWith('data: ')) continue;

                try {
                    // Parse the JSON data
                    const jsonData = JSON.parse(line.replace('data: ', ''));
                    const content = jsonData.choices[0]?.delta?.content;

                    if (content) {
                        // Append the new content to the textarea
                        textarea.value += content;
                        // Scroll to the bottom of the textarea
                        textarea.scrollTop = textarea.scrollHeight;
                    }
                } catch (error) {
                    console.error('Error parsing chunk:', error);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error making API request: ' + error.message);
        // Restore original text in case of error
        textarea.value = originalText;
    }
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
