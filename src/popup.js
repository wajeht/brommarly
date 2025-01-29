// Get count from current tab
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "getCount"}, function(response) {
        document.getElementById('count').textContent = response?.count || 0;
    });
});

// Load saved settings
document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['apiKey', 'model'], function(result) {
        if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
        if (result.model) document.getElementById('model').value = result.model;
    });
});

// Save settings
document.getElementById('saveSettings').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;

    chrome.storage.sync.set({
        apiKey: apiKey,
        model: model
    }, function() {
        alert('Settings saved!');
    });
});
