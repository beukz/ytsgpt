// IMPORTANT: For this login flow to work, you must add the extension's dashboard URL
// to your Supabase project's authentication settings.
// 1. Go to your Supabase Dashboard > Authentication > URL Configuration.
// 2. Add the following URL to the "Redirect URLs" list:
//    chrome-extension://<your-extension-id>/tabs/dashboard.html
//    You can get your extension's ID from the chrome://extensions page.

const SUPABASE_URL = "https://qrnnthitqgpiowixmlpd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybm50aGl0cWdwaW93aXhtbHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDIyMjksImV4cCI6MjA3MzAxODIyOX0.XOde44pjV-jh1ITX9KfWbnJBWg14tuMyqQSFQ4dBtXk";

document.addEventListener("DOMContentLoaded", function () {
    // Don't run if not in an extension context
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        console.error("popup.js: Not running in an extension context. Aborting.");
        return;
    }

    console.log("popup.js: DOMContentLoaded event fired.");
    const pageLoader = document.getElementById("pageLoader");
    const googleSignInBtn = document.getElementById("google-signin-btn");
    const logoutLink = document.getElementById("logout-link");

    if (pageLoader) pageLoader.classList.add("active");
    
    checkUserSession();

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener("click", signInWithGoogle);
    }

    if (logoutLink) {
        logoutLink.addEventListener("click", (e) => {
            e.preventDefault();
            chrome.storage.local.remove(['supabase.auth.token', 'supabase.auth.refreshToken', 'user'], () => {
                console.log('User session and data removed from storage.');
                showLoginView();
            });
        });
    }
});

function signInWithGoogle() {
    // This URL must be added to your Supabase project's "Redirect URLs"
    const redirectURL = chrome.runtime.getURL("tabs/dashboard.html");
    const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
    authUrl.searchParams.set('provider', 'google');
    authUrl.searchParams.set('redirect_to', redirectURL);

    // Open the Supabase auth screen in a new tab
    chrome.tabs.create({ url: authUrl.href });

    // Close the popup window
    window.close();
}

function refreshSession() {
    chrome.storage.local.get(['supabase.auth.refreshToken'], (result) => {
        const refreshToken = result['supabase.auth.refreshToken'];

        if (!refreshToken) {
            console.log("No refresh token found. Logging out.");
            chrome.storage.local.remove(['supabase.auth.token', 'supabase.auth.refreshToken', 'user'], showLoginView);
            return;
        }

        fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'refresh_token': refreshToken })
        })
        .then(response => response.json())
        .then(data => {
            if (data.access_token) {
                console.log("Session refreshed successfully.");
                chrome.storage.local.set({
                    'supabase.auth.token': data.access_token,
                    'supabase.auth.refreshToken': data.refresh_token,
                    user: data.user
                }, () => {
                    updateUserInfo(data.user);
                    showUserInfoView();
                });
            } else {
                console.log("Failed to refresh session. Logging out.", data.error_description);
                chrome.storage.local.remove(['supabase.auth.token', 'supabase.auth.refreshToken', 'user'], showLoginView);
            }
        })
        .catch(error => {
            console.error("Error refreshing session:", error);
            showLoginView();
        });
    });
}

async function checkUserSession() {
    chrome.storage.local.get(['supabase.auth.token'], async (result) => {
        const accessToken = result['supabase.auth.token'];

        if (!accessToken) {
            console.log("No access token found. Showing login view.");
            showLoginView();
            return;
        }

        try {
            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/get-user-session`, 
                {
                    method: "GET",
                    headers: {
                        "apikey": SUPABASE_ANON_KEY,
                        "Authorization": `Bearer ${accessToken}`,
                    },
                }
            );
            
            const data = await response.json();

            if (response.ok && data.success) {
                console.log("Session is valid. User data:", data.user);
                chrome.storage.local.set({ user: data.user }, () => {
                    updateUserInfo(data.user);
                    showUserInfoView();
                });
            } else {
                console.log("Session invalid or expired, attempting to refresh.", data.message);
                refreshSession();
            }
        } catch (error) {
            console.error("Error checking user session:", error);
            showLoginView();
        }
    });
}

// --- UI Functions ---

function updateUserInfo(user) {
    console.log("updateUserInfo: Updating UI with user info:", user);
    document.getElementById("user-email").textContent = user.email;
    document.getElementById("popupUserAccountType").textContent = user.account_type;
    document.getElementById("popupUserCredits").textContent = user.credits;
    
    const userPicture = document.getElementById("user-picture");
    userPicture.src = user.picture || "/images/icons/ph-user.png";
    userPicture.onerror = () => { userPicture.src = "/images/icons/ph-user.png"; };

    const upgradeLink = document.querySelector(".upgrade-acc-pro");
    if (user.account_type === "Basic" && upgradeLink) {
        upgradeLink.style.display = "inline";
    } else if (upgradeLink) {
        upgradeLink.style.display = "none";
    }
}

function showLoginView() {
    document.getElementById("pageLoader")?.classList.remove("active");
    document.getElementById("popupHome").style.display = "block";
    document.getElementById("user-info").style.display = "none";
}

function showUserInfoView() {
    document.getElementById("pageLoader")?.classList.remove("active");
    document.getElementById("popupHome").style.display = "none";
    document.getElementById("user-info").style.display = "block";
}