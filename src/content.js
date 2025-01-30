// Cache for tracking textareas that already have buttons
const processedTextareas = new WeakSet();

// Create a button for a textarea
function createButton(textarea) {
    const button = document.createElement('button');
    button.textContent = '🗿';
    button.style.cssText = `
    position: absolute;
    background: white;
    border: solid 1px lightgrey;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;

    // Position the button relative to the textarea
    const updatePosition = () => {
        const rect = textarea.getBoundingClientRect();
        button.style.top = `${rect.bottom - 30 + window.scrollY}px`;
        button.style.left = `${rect.right - 30 + window.scrollX}px`;
    };

    // Handle button click event
    button.addEventListener('click', () => handleButtonClick(textarea));

    // Append button to the document and update its position
    document.body.appendChild(button);
    updatePosition();

    // Update position on scroll and resize
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
}

// Handle button click event
async function handleButtonClick(textarea) {
    const settings = await getSettings();
    if (!settings.apiKey || !settings.model) {
        alert('Please configure your API key and model in the extension popup.');
        return;
    }

    try {
        const response = await fetchChatCompletion(settings.apiKey, settings.model, textarea.value);
        await streamResponseToTextarea(response, textarea);
    } catch (error) {
        console.error('Error:', error);
        alert('Error making API request: ' + error.message);
        textarea.value = originalText; // Restore original text on error
    }
}

// Get settings from storage
async function getSettings() {
    return await chrome.storage.sync.get(['apiKey', 'model', 'ignoredUrls']);
}

// Fetch chat completion from OpenAI API
async function fetchChatCompletion(apiKey, model, prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
        }),
    });

    if (!response.ok) {
        throw new Error('API request failed');
    }

    return response;
}

// Stream response to textarea
async function streamResponseToTextarea(response, textarea) {
    const originalText = textarea.value;
    textarea.value = ''; // Clear the textarea before streaming

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            processChunk(chunk, textarea);
        }
    } catch (error) {
        console.error('Error streaming response:', error);
        textarea.value = originalText; // Restore original text on error
        throw error;
    }
}

// Process a single chunk of the streamed response
function processChunk(chunk, textarea) {
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');

    for (const line of lines) {
        if (line === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;

        try {
            const jsonData = JSON.parse(line.replace('data: ', ''));
            const content = jsonData.choices[0]?.delta?.content;

            if (content) {
                textarea.value += content;
                textarea.scrollTop = textarea.scrollHeight; // Scroll to the bottom
            }
        } catch (error) {
            console.error('Error parsing chunk:', error);
        }
    }
}

// Find all textareas and create buttons for them
function createOverlays() {
    getSettings()
        .then((res) => {
            const urls = res.ignoredUrls.split('\n');
            if (urls.includes(window.location.href)) {
                console.log('skipped on ', window.location.href);
                return;
            }
        })
        .catch((err) => {
            console.log(err);
        });

    const textareas = document.querySelectorAll('textarea');

    textareas.forEach((textarea) => {
        if (processedTextareas.has(textarea)) return; // Skip if already processed

        createButton(textarea);
        processedTextareas.add(textarea);
    });
}

// Set up MutationObserver to handle dynamically added textareas
const observer = new MutationObserver(createOverlays);
observer.observe(document.body, { childList: true, subtree: true });

// Initial run to create buttons for existing textareas
createOverlays();
