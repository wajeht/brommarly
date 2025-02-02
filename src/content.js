let cachedSettings = null;
let selectorMode = false;
let highlightedElement = null;

function setupMutationObserver() {
    let cleanupTimeout;

    const observer = new MutationObserver(async (mutationsList) => {
        clearTimeout(cleanupTimeout);
        cleanupTimeout = setTimeout(async () => {
            const settings = await getSettings();

            // Remove all buttons if they're not manually added
            document.querySelectorAll('[data-chad-id]').forEach(element => {
                if (element.getAttribute('data-chad-manual') !== 'true') {
                    const buttonId = element.getAttribute('data-chad-id');
                    const button = document.querySelector(`button[data-textarea-id="${buttonId}"]`);
                    if (button) button.remove();
                    element.removeAttribute('data-chad-id');
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

    return observer;
}

function setupStorageListener() {
    chrome.storage.onChanged.addListener(async (changes) => {
        cachedSettings = null;
        if (changes.domainSelectors) {
            await restoreSavedSelectors();
        }
    });
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

async function createButton(element) {
    if (element.getAttribute('data-chad-id')) return;

    const textareaId = `chad-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    element.setAttribute('data-chad-id', textareaId);
    element.setAttribute('data-chad-manual', 'true');

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
        if (!document.body.contains(element)) {
            button.remove();
            return;
        }
        const rect = element.getBoundingClientRect();
        button.style.top = `${rect.bottom - 30 + window.scrollY}px`;
        button.style.left = `${rect.right - 30 + window.scrollX}px`;
    }, 100);

    button.addEventListener('click', () => {
        const text = element.value || element.textContent;
        handleButtonClick(element, button, text);
    });

    document.body.appendChild(button);
    updatePosition();

    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    new MutationObserver((mutations, observer) => {
        if (!document.body.contains(element)) {
            button.remove();
            observer.disconnect();
            window.removeEventListener('scroll', updatePosition);
            window.removeEventListener('resize', updatePosition);
        }
    }).observe(document.body, { childList: true, subtree: true });
}

async function handleButtonClick(element, button, originalText) {
    button.disabled = true;
    button.textContent = '⏳';

    try {
        const settings = await getSettings();
        if (!settings.apiKey || !settings.model) {
            alert('Please configure your API key and model in the extension popup.');
            return;
        }

        const prompt = preparePrompt(settings.customPrompt, originalText);

        const response = await fetchChatCompletion(settings.apiKey, settings.model, prompt);

        await streamResponseToTextarea(response, element);
    } catch (error) {
        console.error('Error:', error);
        alert('Error making API request: ' + error.message);
        if (element.value !== undefined) {
            element.value = originalText;
        } else {
            element.textContent = originalText;
        }
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

    const defaults = {
        domainSelectors: {}
    };

    cachedSettings = await chrome.storage.sync.get(['apiKey', 'model', 'customPrompt', 'domainSelectors']);
    cachedSettings = { ...defaults, ...cachedSettings };

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

async function streamResponseToTextarea(response, element) {
    const originalText = element.value || element.textContent;
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
                if (element.value !== undefined) {
                    element.value = buffer;
                } else {
                    element.textContent = buffer;
                }
                element.scrollTop = element.scrollHeight;
            }
        }
    } catch (error) {
        console.error('Error streaming response:', error);
        if (element.value !== undefined) {
            element.value = originalText;
        } else {
            element.textContent = originalText;
        }
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
            const deltaContent = jsonData.choices?.[0]?.delta?.content;
            if (deltaContent) {
                content += deltaContent;
            }
        } catch (error) {
            console.error('Error parsing JSON from chunk:', error);
            continue;
        }
    }

    return content;
}

async function createOverlays() {
    document.querySelectorAll('button[data-chad-button]').forEach(button => {
        const textareaId = button.getAttribute('data-textarea-id');
        if (textareaId && !document.querySelector(`[data-chad-id="${textareaId}"]`)) {
            button.remove();
        }
    });
}

function enableSelectorMode() {
    selectorMode = true;
    document.body.style.cursor = 'crosshair';

    if (highlightedElement) {
        highlightedElement.style.outline = '';
    }

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleSelectorClick);
    document.addEventListener('click', handleClickOff, true);
}

function disableSelectorMode() {
    selectorMode = false;
    document.body.style.cursor = '';

    if (highlightedElement) {
        highlightedElement.style.outline = '';
        highlightedElement = null;
    }

    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseout', handleMouseOut);
    document.removeEventListener('click', handleSelectorClick);
    document.removeEventListener('click', handleClickOff, true);
}

function handleMouseOver(e) {
    if (!selectorMode) return;
    e.preventDefault();
    e.stopPropagation();

    if (highlightedElement) {
        highlightedElement.style.outline = '';
    }

    highlightedElement = e.target;
    highlightedElement.style.outline = '2px solid #4285f4';
}

function handleMouseOut(e) {
    if (!selectorMode || !highlightedElement) return;
    highlightedElement.style.outline = '';
}

async function handleSelectorClick(e) {
    if (!selectorMode) return;
    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    await saveDomainSelector(element);
    createButton(element);

    // Send message to popup to refresh the display
    chrome.runtime.sendMessage({ action: 'refreshPopup' });

    // Disable selector mode
    disableSelectorMode();

    // Send message to update the toggle button in popup
    chrome.runtime.sendMessage({ action: 'updateToggleButton' });

    // Save settings immediately
    const settings = await getSettings();
    await chrome.storage.sync.set(settings);
}

function handleClickOff(e) {
    if (!selectorMode) return;

    if (e.target === document.body || e.target === document) {
        e.preventDefault();
        e.stopPropagation();
        disableSelectorMode();

        chrome.runtime.sendMessage({ action: 'updateToggleButton' });
    }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'enableSelector') {
        enableSelectorMode();
    } else if (request.action === 'disableSelector') {
        disableSelectorMode();
    } else if (request.action === 'refreshSelectors') {
        removeAllBubbles();
        await restoreSavedSelectors();
    }
});

function removeAllBubbles() {
    document.querySelectorAll('button[data-chad-button]').forEach(button => button.remove());

    document.querySelectorAll('[data-chad-id]').forEach(element => {
        element.removeAttribute('data-chad-id');
        element.removeAttribute('data-chad-manual');
    });
}

function generateUniqueSelector(element) {
    // Try ID first (if it's a valid ID)
    if (element.id && /^[a-zA-Z0-9_-]+$/.test(element.id)) {
        return `#${element.id}`;
    }

    // Try for unique attributes in order of preference
    const uniqueAttrs = [
        'name',
        'data-testid',
        'aria-label',
        'placeholder',
        'role'
    ];

    for (const attr of uniqueAttrs) {
        const value = element.getAttribute(attr);
        if (value && value.trim()) {
            // Clean the value to ensure it's a valid selector
            const cleanValue = value.replace(/"/g, '\\"');
            return `${element.tagName.toLowerCase()}[${attr}="${cleanValue}"]`;
        }
    }

    // For textareas and inputs, create a more specific selector
    if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
        let selector = element.tagName.toLowerCase();

        // Add type for inputs
        if (element.type) {
            selector += `[type="${element.type}"]`;
        }

        // Add class names that look stable (avoid dynamic classes)
        const stableClasses = Array.from(element.classList)
            .filter(className =>
                !className.includes('--') && // Avoid BEM modifiers
                !/[0-9]/.test(className) && // Avoid classes with numbers
                !className.includes('rgh-') && // Avoid dynamic classes
                className.length > 2 // Avoid very short class names
            )
            .slice(0, 2); // Take only first two stable classes

        if (stableClasses.length > 0) {
            selector += '.' + stableClasses.join('.');
        }

        return selector;
    }

    // Fallback to position-based selector
    let selector = element.tagName.toLowerCase();
    let parent = element.parentElement;
    let index = 0;

    while (parent && index < 3) {
        const siblings = Array.from(parent.children);
        const elementIndex = siblings.indexOf(element) + 1;
        selector = `${parent.tagName.toLowerCase()} > ${selector}:nth-child(${elementIndex})`;
        element = parent;
        parent = element.parentElement;
        index++;
    }

    return selector;
}

async function saveDomainSelector(element) {
    const settings = await getSettings();
    const domain = window.location.hostname;
    const fullUrl = window.location.href;

    const selector = generateUniqueSelector(element);

    if (!settings.domainSelectors[domain]) {
        settings.domainSelectors[domain] = [];
    }

    // Store both selector and full URL
    const selectorData = {
        selector: selector,
        url: fullUrl
    };

    // Check if this selector already exists
    const exists = settings.domainSelectors[domain].some(
        item => item.selector === selector && item.url === fullUrl
    );

    if (!exists) {
        settings.domainSelectors[domain].push(selectorData);
        await chrome.storage.sync.set({ domainSelectors: settings.domainSelectors });
        cachedSettings = null;
    }
}

async function restoreSavedSelectors() {
    try {
        const settings = await getSettings();
        const domain = window.location.hostname;
        const currentUrl = window.location.href;

        if (settings.domainSelectors?.[domain]) {
            const validSelectors = [];

            for (const selectorData of settings.domainSelectors[domain]) {
                try {
                    // Handle both old format (string) and new format (object)
                    const selector = typeof selectorData === 'string' ? selectorData : selectorData.selector;
                    const element = document.querySelector(selector);
                    if (element) {
                        createButton(element);
                        validSelectors.push({
                            selector: selector,
                            url: typeof selectorData === 'string' ? currentUrl : selectorData.url
                        });
                    }
                } catch (error) {
                    console.debug('Invalid selector, will be removed:', selectorData);
                    continue;
                }
            }

            // Update storage with valid selectors
            if (validSelectors.length !== settings.domainSelectors[domain].length) {
                settings.domainSelectors[domain] = validSelectors;
                if (validSelectors.length === 0) {
                    delete settings.domainSelectors[domain];
                }
                await chrome.storage.sync.set({ domainSelectors: settings.domainSelectors });
                cachedSettings = null;
            }
        }
    } catch (error) {
        console.error('Error in restoreSavedSelectors:', error);
    }
}

async function deleteSelector(domain, index) {
    const { domainSelectors = {} } = await chrome.storage.sync.get('domainSelectors');

    if (domainSelectors[domain]) {
        domainSelectors[domain].splice(index, 1);

        if (domainSelectors[domain].length === 0) {
            delete domainSelectors[domain];
        }

        await chrome.storage.sync.set({ domainSelectors });

        // Send message to content script to remove the button
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'refreshSelectors',
                domainSelectors
            });
        }
    }
}

function waitForElement(selector, callback, timeout = 2000) {
    const startTime = Date.now();

    const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

        if (Date.now() - startTime >= timeout) {
            console.log('Element not found:', selector);
            return;
        }

        requestAnimationFrame(checkElement);
    };

    checkElement();
}

async function main() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await initializePage();
        });
    } else {
        await initializePage();
    }
}

async function initializePage() {
    // Only restore manual selectors
    await restoreSavedSelectors();
    setupStorageListener();
}

main();
