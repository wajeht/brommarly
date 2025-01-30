document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['apiKey', 'model', 'ignoredUrls'], function(result) {
        if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
        if (result.model) document.getElementById('model').value = result.model;
        if (result.ignoredUrls) document.getElementById('ignoredUrls').value = result.ignoredUrls;
    });
});

document.getElementById('saveSettings').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;
    const ignoredUrls = document.getElementById('ignoredUrls').value;

    chrome.storage.sync.set({
        apiKey: apiKey,
        model: model,
        ignoredUrls: ignoredUrls,
    }, function() {
        alert('Settings saved!');
    });
});
