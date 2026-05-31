chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked. Tab ID:", tab.id, "Tab URL:", tab.url);

  // Prevent injection on restricted internal chrome/firefox urls
  if (
    !tab.id || 
    !tab.url || 
    tab.url.startsWith('chrome://') || 
    tab.url.startsWith('chrome-extension://') || 
    tab.url.startsWith('about:') || 
    tab.url.startsWith('moz-extension://')
  ) {
    console.log("Injection blocked due to restricted URL scheme.");
    return;
  }

  console.log("Checking if Snakey is already injected...");

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
    console.log("Injection check result. isAlreadyInjected:", isAlreadyInjected);

    if (!isAlreadyInjected) {
      console.log("Injecting CSS: assets/index.css");
      // Inject the compiled CSS bundle
      chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['assets/index.css']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Snakey CSS injection error:", chrome.runtime.lastError.message);
        } else {
          console.log("CSS injected successfully.");
        }
      });

      console.log("Injecting JS: assets/index.js");
      // Inject the compiled JS bundle
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['assets/index.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Snakey JS injection error:", chrome.runtime.lastError.message);
        } else {
          console.log("JS injected successfully.");
        }
      });
    } else {
      // If already injected, we can reload the page or do nothing.
      // Doing nothing is standard and prevents multiple overlays.
      console.log("Snakey is already running on this page.");
    }
  });
});
