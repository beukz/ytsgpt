document.addEventListener("DOMContentLoaded", function () {
    // Don't run if not in an extension context
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        console.error("links.js: Not running in an extension context. Aborting.");
        return;
    }

    console.log("links.js: DOMContentLoaded event fired.");
    // List of link IDs and corresponding paths
    const links = {
        "dashboard-link": "tabs/dashboard.html",
        // "about-link": "tabs/about.html",
        // "settings-link": "tabs/settings.html",
        // "docs-link": "tabs/docs.html",
        // "terms-link": "tabs/terms.html",
        // "refund-link": "tabs/refund.html",
        // "privacy-link": "tabs/privacy.html"
    };

    // Iterate over each link and add click event listeners
    for (let id in links) {
        const linkElement = document.getElementById(id);
        
        // Check if the link element exists before adding the event listener
        if (linkElement) {
            console.log(`links.js: Found element with ID '${id}', adding click listener.`);
            linkElement.addEventListener("click", function (e) {
                e.preventDefault(); // Prevent default link behavior
                const url = chrome.runtime.getURL(links[id]); // Get the full URL
                console.log(`links.js: Link '${id}' clicked. Opening URL: ${url}`);
                chrome.tabs.create({ url: url }); // Open the URL in a new tab
            });
        } else {
            console.error(`links.js: Element with ID ${id} not found in the popup.html.`);
        }
    }
});