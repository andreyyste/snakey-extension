chrome.action.onClicked.addListener((tab) => {
  // Prevent injection on restricted internal chrome urls
  if (!tab.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }

  // Check if snakey has already been injected in this tab
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('snakey-extension-root')
  }, (results) => {
    if (chrome.runtime.lastError) {
      console.warn("Snakey injection check error:", chrome.runtime.lastError.message);
      return;
    }

    const isAlreadyInjected = results && results[0] && results[0].result;
    if (!isAlreadyInjected) {
      // Inject the compiled CSS bundle
      chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['assets/index.css']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Snakey CSS injection error:", chrome.runtime.lastError.message);
        }
      });

      // Inject the compiled JS bundle
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['assets/index.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Snakey JS injection error:", chrome.runtime.lastError.message);
        }
      });
    } else {
      // If already injected, we can reload the page or do nothing.
      // Doing nothing is standard and prevents multiple overlays.
      console.log("Snakey is already running on this page.");
    }
  });
});
