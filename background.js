chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("background.js: Message received", message);

  if (message.action === "openDashboard") {
    console.log("background.js: Opening dashboard.");
    chrome.tabs.create({ url: "chrome-extension://pmlijpebemehieekokeddlhlmilinpdh/tabs/dashboard.html" });
  }

  // The 'authenticate' message type is deprecated in favor of the new Supabase auth flow in the popup.
  // The old code has been removed to avoid conflicts.
});