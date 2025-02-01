const processedTextareas = new WeakSet();
let cachedSettings = null;

main();

function main() {
    createOverlays();
    setupMutationObserver();
    setupStorageListener();
}

function setupMutationObserver() {
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                createOverlays();
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function setupStorageListener() {
    chrome.storage.onChanged.addListener(() => {
        cachedSettings = null;
    });
}

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// Create a button for a textarea
function createButton(textarea) {
    if (textarea.dataset.hasButton) return; // Skip if button already exists
    textarea.dataset.hasButton = true;

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
    const updatePosition = debounce(() => {
        const rect = textarea.getBoundingClientRect();
        button.style.top = `${rect.bottom - 30 + window.scrollY}px`;
        button.style.left = `${rect.right - 30 + window.scrollX}px`;
    }, 100);

    button.addEventListener('click', () => handleButtonClick(textarea, button));

    // Append button to the document and update its position
    document.body.appendChild(button);
    updatePosition();

    const debouncedUpdate = debounce(updatePosition, 100);
    window.addEventListener('scroll', debouncedUpdate);
    window.addEventListener('resize', debouncedUpdate);

    // Clean up event listeners when the button is removed
    new MutationObserver(() => {
        if (!document.body.contains(button)) {
            window.removeEventListener('scroll', debouncedUpdate);
            window.removeEventListener('resize', debouncedUpdate);
        }
    }).observe(document.body, { childList: true, subtree: true });
}

async function handleButtonClick(textarea, button) {
    button.disabled = true;
    button.textContent = '⏳';

    const originalText = textarea.value;

    try {
        const settings = await getSettings();
        if (!settings.apiKey || !settings.model) {
            alert('Please configure your API key and model in the extension popup.');
            return;
        }

        const prompt = preparePrompt(settings.customPrompt, originalText);

        const response = await fetchChatCompletion(settings.apiKey, settings.model, prompt);

        await streamResponseToTextarea(response, textarea);
    } catch (error) {
        console.error('Error:', error);
        alert('Error making API request: ' + error.message);
        textarea.value = originalText;
    } finally {
        button.disabled = false;
        button.textContent = '🗿';
    }
}

function preparePrompt(customPrompt, originalText) {
    if (!customPrompt) {
        return originalText;
    }

    return `${customPrompt}\n\n${originalText}`;
}

async function getSettings() {
    if (cachedSettings) return cachedSettings;
    cachedSettings = await chrome.storage.sync.get(['apiKey', 'model', 'ignoredUrls', 'customPrompt']);
    return cachedSettings;
}

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

async function streamResponseToTextarea(response, textarea) {
    const originalText = textarea.value;
    textarea.value = '';
    let buffer = '';

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const newContent = processChunk(chunk);
            if (newContent) {
                buffer += newContent;
                textarea.value = buffer;
                textarea.scrollTop = textarea.scrollHeight;
            }
        }
    } catch (error) {
        console.error('Error streaming response:', error);
        textarea.value = originalText;
        throw error;
    }
}

function processChunk(chunk) {
    const lines = chunk.split('\n').filter((line) => line.trim() !== '');

    let content = '';
    for (const line of lines) {
        if (line === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;

        try {
            const jsonData = JSON.parse(line.replace('data: ', ''));
            // Only append content if it exists, don't throw error if it doesn't
            const deltaContent = jsonData.choices?.[0]?.delta?.content;
            if (deltaContent) {
                content += deltaContent;
            }
        } catch (error) {
            console.error('Error parsing JSON from chunk:', error);
            // Continue processing other lines instead of breaking the entire stream
            continue;
        }
    }

    return content;
}

function createOverlays() {
    const textareas = document.querySelectorAll('textarea:not([data-has-button])');

    textareas.forEach((textarea) => {
        createButton(textarea);
        processedTextareas.add(textarea);
    });
}
