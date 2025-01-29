// Get count from current tab
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "getCount"}, function(response) {
        document.getElementById('count').textContent = response?.count || 0;
    });
});
