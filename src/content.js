let cachedSettings = null;

main();

async function main() {
    if (await shouldProcessPage()) {
        createOverlays();
        setupMutationObserver();
        setupStorageListener();
    }
}

function setupMutationObserver() {
    let cleanupTimeout;

    const observer = new MutationObserver((mutationsList) => {
        clearTimeout(cleanupTimeout);
        cleanupTimeout = setTimeout(() => {
            if (!mutationsList.some(m => m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
                return;
            }

            const textareas = document.querySelectorAll('textarea:not([data-chad-id])');
            textareas.forEach(createButton);

            const buttons = document.querySelectorAll('button[data-chad-button]');
            buttons.forEach(button => {
                const textareaId = button.getAttribute('data-textarea-id');
                if (textareaId && !document.querySelector(`textarea[data-chad-id="${textareaId}"]`)) {
                    button.remove();
                }
            });
        }, 200);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    window.addEventListener('unload', () => {
        clearTimeout(cleanupTimeout);
        observer.disconnect();
        document.querySelectorAll('button[data-chad-button]').forEach(b => b.remove());
    });

    window.addEventListener('popstate', () => {
        document.querySelectorAll('button[data-chad-button]').forEach(b => b.remove());
    });

    return observer;
}

async function shouldProcessPage() {
    const settings = await getSettings();
    if (!settings.ignoredUrls) return true;

    const ignoredUrls = settings.ignoredUrls.split('\n')
        .map(url => url.trim())
        .filter(Boolean);

    return !ignoredUrls.some(url => window.location.href.includes(url));
}

function setupStorageListener() {
    chrome.storage.onChanged.addListener(() => {
        cachedSettings = null;
    });
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function createButton(textarea) {
    if (textarea.getAttribute('data-chad-id')) return;

    const textareaId = `chad-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    textarea.setAttribute('data-chad-id', textareaId);

    const button = document.createElement('button');
    button.textContent = '🗿';
    button.setAttribute('data-chad-button', 'true');
    button.setAttribute('data-textarea-id', textareaId);
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

    const updatePosition = debounce(() => {
        if (!document.body.contains(textarea)) {
            button.remove();
            return;
        }
        const rect = textarea.getBoundingClientRect();
        button.style.top = `${rect.bottom - 30 + window.scrollY}px`;
        button.style.left = `${rect.right - 30 + window.scrollX}px`;
    }, 100);

    button.addEventListener('click', () => handleButtonClick(textarea, button));

    document.body.appendChild(button);
    updatePosition();

    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    new MutationObserver((mutations, observer) => {
        if (!document.body.contains(textarea)) {
            button.remove();
            observer.disconnect();
            window.removeEventListener('scroll', updatePosition);
            window.removeEventListener('resize', updatePosition);
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
    document.querySelectorAll('button[data-chad-button]').forEach(button => {
        const textareaId = button.getAttribute('data-textarea-id');
        if (textareaId && !document.querySelector(`textarea[data-chad-id="${textareaId}"]`)) {
            button.remove();
        }
    });

    document.querySelectorAll('textarea').forEach(createButton);
}
