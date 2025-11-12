const SUPABASE_URL = "https://qrnnthitqgpiowixmlpd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybm50aGl0cWdwaW93aXhtbHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDIyMjksImV4cCI6MjA3MzAxODIyOX0.XOde44pjV-jh1ITX9KfWbnJBWg14tuMyqQSFQ4dBtXk";

let savedChannelsCache = null;

// This function checks the URL for auth tokens when the page loads.
// If tokens are found, it saves them and the user profile to storage.
async function handleAuthRedirect() {
    const hash = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');

    if (accessToken && refreshToken) {
        console.log("tabs/script.js: Auth redirect detected. Storing tokens and fetching user.");
        
        // Store tokens first
        await new Promise(resolve => {
            chrome.storage.local.set({ 
                'supabase.auth.token': accessToken,
                'supabase.auth.refreshToken': refreshToken
            }, resolve);
        });

        // Now, fetch user data using the access token
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
                // Store the user object
                await new Promise(resolve => {
                    chrome.storage.local.set({ user: data.user }, resolve);
                });
                console.log("tabs/script.js: User data fetched and stored:", data.user);
            } else {
                throw new Error(data.message || 'Failed to fetch user session.');
            }
        } catch (error) {
            console.error("tabs/script.js: Error fetching user session after auth:", error);
            // Clear tokens if user fetch fails
            await new Promise(resolve => {
                chrome.storage.local.remove(['supabase.auth.token', 'supabase.auth.refreshToken', 'user'], resolve);
            });
        } finally {
            // Clean the URL to remove tokens from address bar and prevent re-triggering
            window.history.replaceState(null, null, window.location.pathname + window.location.search);
        }
    }
}

document.addEventListener("DOMContentLoaded", async function () {
  await handleAuthRedirect(); // Wait for auth to be handled first

  console.log("tabs/script.js: DOMContentLoaded event fired.");
  const pageLoader = document.getElementById("pageLoader");

  // Show the page loader while the page is loading
  if (pageLoader) {
    pageLoader.classList.add("active");
    console.log("tabs/script.js: Page loader activated.");
  }

  // Check if the user is logged in when the page loads
  await checkLoginStatus();

  // Check if we are on the settings page
  if (document.body.dataset.title === "Settings") {
    console.log("tabs/script.js: On Settings page. Initializing settings logic.");
    const toneSelect = document.getElementById("default-tone-select");
    const topicInput = document.getElementById("channel-topic-input");
    const saveButton = document.getElementById("save-settings-button");
    const saveStatus = document.getElementById("save-status");
    const customToneInput = document.getElementById("custom-tone-input");
    const addToneButton = document.getElementById("add-tone-btn");
    const customTonesList = document.getElementById("custom-tones-list");
    const appendMessageToggle = document.getElementById("append-message-toggle");
    const appendMessageInput = document.getElementById("append-message-input");
    const appendDisabledLabel = document.getElementById("append-disabled-label");
    const appendEnabledLabel = document.getElementById("append-enabled-label");

    // Load saved settings
    chrome.storage.local.get(["defaultTone", "channelTopic", "appendMessageEnabled", "appendMessageText"], function (result) {
      console.log("tabs/script.js: Loaded settings from storage:", result);
      if (result.defaultTone) {
        toneSelect.value = result.defaultTone;
      }
      if (result.channelTopic) {
        topicInput.value = result.channelTopic;
      }
      if (result.appendMessageEnabled) {
        appendMessageToggle.checked = true;
        appendDisabledLabel.classList.remove('active');
        appendEnabledLabel.classList.add('active');
      } else {
        appendMessageToggle.checked = false;
        appendEnabledLabel.classList.remove('active');
        appendDisabledLabel.classList.add('active');
      }
      if (result.appendMessageText) {
        appendMessageInput.value = result.appendMessageText;
      }
    });

    // Save settings on button click
    saveButton.addEventListener("click", function () {
      const selectedTone = toneSelect.value;
      const topic = topicInput.value;
      const appendEnabled = appendMessageToggle.checked;
      const appendText = appendMessageInput.value;

      console.log("tabs/script.js: Save button clicked. Saving settings:", { defaultTone: selectedTone, channelTopic: topic, appendMessageEnabled: appendEnabled, appendMessageText: appendText });
      
      chrome.storage.local.set({ 
        defaultTone: selectedTone, 
        channelTopic: topic,
        appendMessageEnabled: appendEnabled,
        appendMessageText: appendText
      }, function () {
        console.log("tabs/script.js: Settings saved successfully to chrome.storage.");
        saveStatus.textContent = "Settings saved successfully!";
        saveStatus.style.display = "block";
        setTimeout(() => {
          saveStatus.style.display = "none";
        }, 3000);
      });
    });

    if (appendMessageToggle) {
      appendMessageToggle.addEventListener('change', () => {
          if (appendMessageToggle.checked) {
              appendDisabledLabel.classList.remove('active');
              appendEnabledLabel.classList.add('active');
          } else {
              appendEnabledLabel.classList.remove('active');
              appendDisabledLabel.classList.add('active');
          }
      });
    }

    // --- Custom Tones Logic ---

    function updateDefaultToneDropdown(tones = []) {
      const toneSelectDropdown = document.getElementById("default-tone-select");
      if (!toneSelectDropdown) return;

      // Remove previously added custom tones to avoid duplicates
      toneSelectDropdown.querySelectorAll('.custom-tone-option').forEach(opt => opt.remove());

      // Add new custom tones
      tones.forEach(tone => {
          const option = document.createElement('option');
          const dataValue = tone.toLowerCase().replace(/\s+/g, '-');
          option.value = dataValue;
          option.textContent = tone;
          option.className = 'custom-tone-option'; // Class for easy removal
          toneSelectDropdown.appendChild(option);
      });

      // Re-apply the saved default tone value to handle async loading
      chrome.storage.local.get("defaultTone", function (result) {
          if (result.defaultTone) {
              if (toneSelectDropdown.querySelector(`option[value="${result.defaultTone}"]`)) {
                  toneSelectDropdown.value = result.defaultTone;
              }
          }
      });
    }

    function renderCustomTones(tones = []) {
      customTonesList.innerHTML = '';
      tones.forEach(tone => {
        const li = document.createElement('li');
        
        const toneText = document.createElement('span');
        toneText.textContent = tone;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'delete-tone-btn';
        deleteBtn.title = `Delete "${tone}" tone`;
        deleteBtn.dataset.tone = tone;

        deleteBtn.addEventListener('click', () => {
          deleteCustomTone(tone);
        });
        
        li.appendChild(toneText);
        li.appendChild(deleteBtn);
        customTonesList.appendChild(li);
      });
      updateDefaultToneDropdown(tones);
    }

    function addCustomTone() {
      const newTone = customToneInput.value.trim();
      if (newTone) {
        chrome.storage.local.get({ customTones: [] }, (result) => {
          const tones = result.customTones;
          if (!tones.includes(newTone)) {
            tones.push(newTone);
            chrome.storage.local.set({ customTones: tones }, () => {
              renderCustomTones(tones);
              customToneInput.value = '';
            });
          } else {
            customToneInput.value = '';
          }
        });
      }
    }

    function deleteCustomTone(toneToDelete) {
      chrome.storage.local.get({ customTones: [] }, (result) => {
        let tones = result.customTones;
        tones = tones.filter(t => t !== toneToDelete);
        chrome.storage.local.set({ customTones: tones }, () => {
          renderCustomTones(tones);
        });
      });
    }

    chrome.storage.local.get({ customTones: [] }, (result) => {
      renderCustomTones(result.customTones);
    });

    addToneButton.addEventListener('click', addCustomTone);

    customToneInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addCustomTone();
      }
    });

  }

  // Check if on pricing page and setup toggles
  if (document.body.dataset.title === "Pricing") {
    setupPricingToggles();
  }

  // Check if on dashboard page and setup YouTube auth button
  if (document.body.dataset.title === "Dashboard") {
    const connectChannelBtn = document.getElementById('connect-channel-btn');
    if (connectChannelBtn) {
        connectChannelBtn.addEventListener('click', authorizeWithYouTube);
    }
  }

  // Check if on Comment Center page
  if (document.body.dataset.title === "Comment Center") {
    chrome.storage.local.get('selectedChannel', ({ selectedChannel }) => {
        const titleHeader = document.getElementById('channel-title-header');
        if (selectedChannel) {
            if (titleHeader) {
                titleHeader.textContent = selectedChannel.title;
            }
            fetchCommentsForChannel();
        } else {
            if (titleHeader) {
                titleHeader.textContent = 'No Channel Selected';
            }
            const container = document.getElementById('comment-list-container');
            if(container) {
              container.innerHTML = '<p>No channel selected. Please select a channel from the dropdown in the header.</p>';
            }
        }
    });

    const commentListContainer = document.getElementById('comment-list-container');
    if (commentListContainer) {
        commentListContainer.addEventListener('click', (event) => {
            const replyBtn = event.target.closest('.reply-btn');
            if (replyBtn) {
                const commentId = replyBtn.dataset.commentId;
                toggleReplyBox(commentId);
                return;
            }

            const generateBtn = event.target.closest('.generate-reply-btn');
            if (generateBtn) {
                generateReplyInDashboard(generateBtn);
                return;
            }

            const sendBtn = event.target.closest('.send-reply-btn');
            if (sendBtn) {
                const commentId = sendBtn.dataset.commentId;
                postReply(commentId);
                return;
            }

            // Dropdown logic
            const dropdownTrigger = event.target.closest('.dropdown-trigger');
            if (dropdownTrigger) {
                const optionsContainer = dropdownTrigger.nextElementSibling;
                optionsContainer.style.display = optionsContainer.style.display === 'block' ? 'none' : 'block';
                return;
            }

            const dropdownOption = event.target.closest('.dropdown-options li');
            if (dropdownOption) {
                const dropdown = dropdownOption.closest('.custom-dropdown');
                const selectedOption = dropdown.querySelector('.selected-option');
                selectedOption.textContent = dropdownOption.textContent;
                dropdownOption.parentElement.style.display = 'none';
                return;
            }
        });

        // Add input event listener for auto-resizing textareas
        commentListContainer.addEventListener('input', (event) => {
            if (event.target.matches('.reply-textarea')) {
                autoResizeTextarea(event.target);
            }
        });

        // Close dropdown if clicked outside
        document.addEventListener('click', function (event) {
            if (!event.target.closest('.custom-dropdown')) {
                document.querySelectorAll('.dropdown-options').forEach(options => {
                    options.style.display = 'none';
                });
            }
        });
    }
  }
});

function authorizeWithYouTube() {
    const btn = document.getElementById('connect-channel-btn');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = 'Authorizing...';
    btn.disabled = true;

    console.log("tabs/script.js: Starting YouTube authorization flow.");
    // The 'interactive' flag will prompt the user for consent if needed.
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
            console.error("tabs/script.js: getAuthToken failed:", chrome.runtime.lastError.message);
            alert("Authorization failed. Please ensure you have set your OAuth Client ID in the manifest.json file. Error: " + chrome.runtime.lastError.message);
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
            return;
        }
        if (token) {
            console.log("tabs/script.js: Successfully received auth token.");
            fetchYouTubeChannels(token);
        } else {
            if (btn) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }
    });
}

async function getSavedChannels() {
    if (savedChannelsCache) {
        return savedChannelsCache;
    }
    console.log("tabs/script.js: Fetching saved channels from database.");
    try {
        const { 'supabase.auth.token': accessToken } = await new Promise(resolve => chrome.storage.local.get(['supabase.auth.token'], resolve));
        if (!accessToken) throw new Error("Not authenticated.");

        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-yt-channels`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': SUPABASE_ANON_KEY }
        });
        if (!response.ok) throw new Error(`Failed to fetch channels: ${response.statusText}`);
        
        const data = await response.json();
        if (data.success) {
            savedChannelsCache = data.channels;
            return data.channels;
        }
        return [];
    } catch (error) {
        console.error("tabs/script.js: Error fetching saved channels:", error);
        return [];
    }
}

function displayDashboardChannels(channels) {
    const channelsListContainer = document.getElementById('connected-channels-list');
    if (!channelsListContainer) return;

    if (channels && channels.length > 0) {
        channelsListContainer.innerHTML = '';
        channels.forEach(channel => {
            // Handle both API and DB data structures
            const isFromApi = !!channel.snippet;
            const channelDataForStorage = {
                channel_id: isFromApi ? channel.id : channel.channel_id,
                title: isFromApi ? channel.snippet.title : channel.title,
                thumbnail_url: isFromApi ? channel.snippet.thumbnails.default.url : channel.thumbnail_url,
                subscriber_count: isFromApi ? parseInt(channel.statistics.subscriberCount, 10) : channel.subscriber_count
            };

            const channelLink = document.createElement('a');
            channelLink.className = 'connected-channel-item-link';
            channelLink.href = `comment-center.html`; 
            channelLink.dataset.channel = JSON.stringify(channelDataForStorage);

            channelLink.innerHTML = `
                <div class="connected-channel-item">
                    <img src="${channelDataForStorage.thumbnail_url}" alt="${channelDataForStorage.title} thumbnail" class="channel-thumbnail">
                    <div class="channel-info">
                        <h4 class="channel-title">${channelDataForStorage.title}</h4>
                        <p class="channel-subs">${channelDataForStorage.subscriber_count.toLocaleString()} subscribers</p>
                    </div>
                </div>
            `;
            channelsListContainer.appendChild(channelLink);
        });
    } else {
        channelsListContainer.innerHTML = '<p>Authorize with YouTube to connect your channels.</p>';
    }
}

function setupDashboardChannelLinks() {
    const list = document.getElementById('connected-channels-list');
    if (list) {
        list.addEventListener('click', (e) => {
            const link = e.target.closest('.connected-channel-item-link');
            if (link) {
                e.preventDefault();
                const channelData = JSON.parse(link.dataset.channel);
                handleChannelSelection(channelData);
                window.location.href = 'comment-center.html';
            }
        });
    }
}

async function fetchAndDisplaySavedChannels() {
    const channelsListContainer = document.getElementById('connected-channels-list');
    if (!channelsListContainer) return;
    channelsListContainer.innerHTML = '<p>Loading your channels...</p>';
    const channels = await getSavedChannels();
    displayDashboardChannels(channels);
}

async function saveChannelsToDB(channels) {
    console.log("tabs/script.js: Saving channels to database.");
    try {
        const { 'supabase.auth.token': accessToken } = await new Promise(resolve => chrome.storage.local.get(['supabase.auth.token'], resolve));
        if (!accessToken) {
            throw new Error("Not authenticated for saving channels.");
        }

        // We need to format the data to match our database schema
        const formattedChannels = channels.map(channel => ({
            channel_id: channel.id,
            title: channel.snippet.title,
            thumbnail_url: channel.snippet.thumbnails.default.url,
            subscriber_count: parseInt(channel.statistics.subscriberCount, 10)
        }));

        const response = await fetch(`${SUPABASE_URL}/functions/v1/save-yt-channels`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ channels: formattedChannels })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || "Failed to save channels.");
        }
        console.log("tabs/script.js: Channels saved successfully.");

    } catch (error) {
        console.error("tabs/script.js: Error saving channels to DB:", error);
        // We don't need to alert the user here, as they already see the channels.
        // This is a background process.
    }
}

async function fetchYouTubeChannels(token) {
    const btn = document.getElementById('connect-channel-btn');
    const originalText = "Connect / Refresh Channels";
    if (btn) btn.textContent = 'Fetching Channels...';

    console.log("tabs/script.js: Fetching YouTube channels from API...");
    try {
        const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.log("tabs/script.js: Auth token is invalid or expired. Removing it.");
                chrome.identity.removeCachedAuthToken({ token: token }, () => {
                     alert("Your authorization has expired. Please click the button again.");
                });
            }
            throw new Error(`Google API responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log("tabs/script.js: Received channel data from API:", data);

        if (data.items && data.items.length > 0) {
            // Immediately display the channels for a good UX
            displayDashboardChannels(data.items);
            // Then, save them to the database in the background
            saveChannelsToDB(data.items);
        } else {
            const channelsList = document.getElementById('connected-channels-list');
            if (channelsList) {
                channelsList.innerHTML = '<p>No YouTube channels found for this Google account.</p>';
            }
        }
    } catch (error) {
        console.error("tabs/script.js: Error fetching YouTube channels:", error);
        alert("Failed to fetch your YouTube channels. Please try authorizing again.");
    } finally {
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

function autoResizeTextarea(textarea) {
    // Reset height to allow shrinking
    textarea.style.height = 'auto';
    // Set height to match content
    textarea.style.height = textarea.scrollHeight + 'px';
}

async function fetchCommentsForChannel() {
    const container = document.getElementById('comment-list-container');
    if (!container) return;

    const { selectedChannel } = await new Promise(resolve => chrome.storage.local.get('selectedChannel', resolve));

    if (!selectedChannel) {
        container.innerHTML = '<p>Please select a channel from the header to view comments.</p>';
        return;
    }
    const channelId = selectedChannel.channel_id;

    container.innerHTML = '<div class="loader-container"><span class="loader"></span><p>Fetching comments...</p></div>';

    chrome.identity.getAuthToken({ interactive: false }, async function(token) {
        if (chrome.runtime.lastError || !token) {
            console.error("Could not get auth token:", chrome.runtime.lastError?.message);
            container.innerHTML = '<p>Error: Could not authenticate. Please re-authorize on the dashboard.</p>';
            return;
        }

        try {
            // 1. Fetch comment threads
            const commentResponse = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=${channelId}&maxResults=25&order=time`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!commentResponse.ok) throw new Error(`API error fetching comments: ${commentResponse.status}`);
            const commentData = await commentResponse.json();
            const commentItems = commentData.items || [];

            if (commentItems.length === 0) {
                container.innerHTML = '<p>No recent comments found for this channel.</p>';
                return;
            }

            // 2. Collect unique video IDs
            const videoIds = [...new Set(commentItems.map(item => item.snippet.videoId))];

            // 3. Fetch video details in a batch
            const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds.join(',')}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!videoResponse.ok) console.error(`API error fetching videos: ${videoResponse.status}`); // Don't throw, just log error
            const videoData = await videoResponse.json();
            
            // 4. Create a video title map
            const videoTitleMap = new Map();
            if (videoData.items) {
                videoData.items.forEach(video => {
                    videoTitleMap.set(video.id, video.snippet.title);
                });
            }

            // 5. Display comments
            displayComments(commentItems, videoTitleMap);

        } catch (error) {
            console.error("Error fetching comments:", error);
            container.innerHTML = `<p>An error occurred while fetching comments: ${error.message}</p>`;
        }
    });
}

function displayComments(comments, videoTitleMap) {
    const container = document.getElementById('comment-list-container');
    container.innerHTML = ''; // Clear loader

    chrome.storage.local.get(["customTones"], (settings) => {
        const customTones = settings.customTones || [];
        let tonesListHtml = `
            <li data-value="neutral">Neutral</li>
            <li data-value="formal">Formal</li>
            <li data-value="casual">Casual</li>
            <li data-value="supportive">Supportive</li>
            <li data-value="disagree">Disagree</li>
            <li data-value="hahaha">Hahaha</li>
            <li data-value="posh">Posh</li>
            <li data-value="witty">Witty</li>
            <li data-value="sarcastic">Sarcastic</li>
            <li data-value="roast">Roast</li>
            <li data-value="GenZ-slang">GenZ Slang</li>
            <li data-value="playful">Playful</li>
            <li data-value="nerdy">Nerdy</li>
        `;
        customTones.forEach(tone => {
            const dataValue = tone.toLowerCase().replace(/\s+/g, '-');
            tonesListHtml += `<li data-value="${dataValue}">${tone}</li>`;
        });

        comments.forEach(item => {
            const topLevelComment = item.snippet.topLevelComment.snippet;
            const topLevelCommentId = item.snippet.topLevelComment.id;
            const videoId = item.snippet.videoId;
            const videoTitle = videoTitleMap.get(videoId) || 'Unknown Video';
            
            const publishedDate = new Date(topLevelComment.publishedAt);
            const timeAgoStr = timeAgo(publishedDate);

            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            commentElement.innerHTML = `
                <div class="commenter-avatar">
                    <img src="${topLevelComment.authorProfileImageUrl}" alt="${topLevelComment.authorDisplayName}">
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="commenter-name">${topLevelComment.authorDisplayName}</span>
                        <span class="comment-date">${timeAgoStr}</span>
                    </div>
                    <div class="comment-text">${topLevelComment.textDisplay}</div>
                    <div class="comment-video-context">
                        Comment on: <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">${videoTitle}</a>
                    </div>
                    <div class="comment-actions">
                        <button class="reply-btn" data-comment-id="${topLevelCommentId}">Reply</button>
                    </div>
                    <div class="reply-box" id="reply-box-${topLevelCommentId}" style="display: none;">
                        <textarea class="reply-textarea" placeholder="Add a reply..."></textarea>
                        <div class="reply-controls">
                            <div class="tone-selector custom-dropdown">
                                <div class="dropdown-trigger">
                                    <span class="selected-option">Neutral</span>
                                    <span class="dropdown-arrow">&#9662;</span>
                                </div>
                                <ul class="dropdown-options">
                                    ${tonesListHtml}
                                </ul>
                            </div>
                            <button class="generate-reply-btn" data-comment-id="${topLevelCommentId}">
                                <span class="btn-text">Generate</span>
                                <span class="loader"></span>
                            </button>
                            <button class="send-reply-btn" data-comment-id="${topLevelCommentId}">Send</button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(commentElement);
        });
    });
}

function toggleReplyBox(commentId) {
    const replyBox = document.getElementById(`reply-box-${commentId}`);
    if (replyBox) {
        const isHidden = replyBox.style.display === 'none';
        replyBox.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            replyBox.querySelector('textarea').focus();
        }
    }
}

async function generateReplyInDashboard(button) {
    const commentId = button.dataset.commentId;
    const commentItem = button.closest('.comment-item');
    const replyBox = document.getElementById(`reply-box-${commentId}`);
    const textarea = replyBox.querySelector('.reply-textarea');
    
    const originalCommentText = commentItem.querySelector('.comment-text').textContent.trim();
    const videoTitle = commentItem.querySelector('.comment-video-context a').textContent.trim();
    const selectedTone = replyBox.querySelector('.selected-option').textContent.trim();

    const btnText = button.querySelector('.btn-text');
    const loader = button.querySelector('.loader');

    chrome.storage.local.get(["user", "channelTopic", "appendMessageEnabled", "appendMessageText"], async (result) => {
        if (!result.user) {
            alert("User not found. Please log in again.");
            return;
        }

        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        button.disabled = true;

        try {
            const response = await fetch(
                "https://qrnnthitqgpiowixmlpd.supabase.co/functions/v1/generate-comment",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "apikey": SUPABASE_ANON_KEY,
                        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        comment: originalCommentText,
                        tone: selectedTone,
                        email: result.user.email,
                        videoTitle: videoTitle,
                        appendMessageEnabled: result.appendMessageEnabled,
                        appendMessageText: result.appendMessageText,
                    }),
                }
            );

            const data = await response.json();

            if (data.success && data.generated_comment) {
                textarea.value = data.generated_comment;
                autoResizeTextarea(textarea);
            } else {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error("Error generating reply:", error);
            textarea.value = `Error: ${error.message}`;
        } finally {
            btnText.style.display = 'inline';
            loader.style.display = 'none';
            button.disabled = false;
        }
    });
}

async function postReply(commentId) {
    const replyBox = document.getElementById(`reply-box-${commentId}`);
    const textarea = replyBox.querySelector('.reply-textarea');
    const sendBtn = replyBox.querySelector('.send-reply-btn');
    const replyText = textarea.value.trim();

    if (!replyText) {
        alert('Reply cannot be empty.');
        return;
    }

    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;

    chrome.identity.getAuthToken({ interactive: false }, async function(token) {
        if (chrome.runtime.lastError || !token) {
            alert('Could not authenticate. Please re-authorize on the dashboard.');
            sendBtn.textContent = 'Send';
            sendBtn.disabled = false;
            return;
        }

        try {
            const response = await fetch('https://www.googleapis.com/youtube/v3/comments?part=snippet', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    snippet: {
                        parentId: commentId,
                        textOriginal: replyText
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.error?.errors?.[0]?.message || data.error?.message || 'Failed to post reply.';
                throw new Error(errorMessage);
            }

            alert('Reply posted successfully!');
            textarea.value = '';
            toggleReplyBox(commentId);

        } catch (error) {
            console.error('Error posting reply:', error);
            alert(`Failed to post reply: ${error.message}`);
        } finally {
            sendBtn.textContent = 'Send';
            sendBtn.disabled = false;
        }
    });
}

function setupPricingToggles() {
    const toggles = document.querySelectorAll('.plan-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', (event) => {
            const plan = event.target.dataset.plan; // 'pro' or 'gold'
            const isYearly = event.target.checked;
            const card = document.getElementById(`${plan}-card`);

            const priceEl = card.querySelector('.price-price h3');
            const periodEl = card.querySelector('.price-price p');
            const creditsEl = card.querySelector('.price-text span');
            
            const monthlyLabel = card.querySelector('.toggle-label.monthly');
            const yearlyLabel = card.querySelector('.toggle-label.yearly');

            if (isYearly) {
                priceEl.textContent = priceEl.dataset.yearly;
                periodEl.textContent = periodEl.dataset.yearly;
                creditsEl.textContent = creditsEl.dataset.yearly;
                monthlyLabel.classList.remove('active');
                yearlyLabel.classList.add('active');
            } else {
                priceEl.textContent = priceEl.dataset.monthly;
                periodEl.textContent = periodEl.dataset.monthly;
                creditsEl.textContent = creditsEl.dataset.monthly;
                yearlyLabel.classList.remove('active');
                monthlyLabel.classList.add('active');
            }
        });
    });
}

async function refreshSession() {
    try {
        const result = await new Promise(resolve => chrome.storage.local.get(['supabase.auth.refreshToken'], resolve));
        const refreshToken = result['supabase.auth.refreshToken'];

        if (!refreshToken) {
            console.log("tabs/script.js: No refresh token, cannot refresh session.");
            await new Promise(resolve => chrome.storage.local.remove(['supabase.auth.token', 'supabase.auth.refreshToken', 'user'], resolve));
            return null;
        }

        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'refresh_token': refreshToken })
        });

        const data = await response.json();

        if (response.ok && data.access_token) {
            console.log("tabs/script.js: Session refreshed successfully.");
            await new Promise(resolve => chrome.storage.local.set({
                'supabase.auth.token': data.access_token,
                'supabase.auth.refreshToken': data.refresh_token,
                user: data.user
            }, resolve));
            return data.user;
        } else {
            console.log("tabs/script.js: Failed to refresh session.", data.error_description);
            await new Promise(resolve => chrome.storage.local.remove(['supabase.auth.token', 'supabase.auth.refreshToken', 'user'], resolve));
            return null;
        }
    } catch (error) {
        console.error("tabs/script.js: Error refreshing session:", error);
        return null;
    }
}

async function validateAndRefreshSession() {
    try {
        const result = await new Promise(resolve => chrome.storage.local.get(['supabase.auth.token'], resolve));
        const accessToken = result['supabase.auth.token'];
        if (!accessToken) {
            return null;
        }

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/get-user-session`, 
            {
                method: "GET",
                headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${accessToken}` },
            }
        );
        
        const data = await response.json();

        if (response.ok && data.success) {
            await new Promise(resolve => chrome.storage.local.set({ user: data.user }, resolve));
            return data.user;
        } else {
            console.log("tabs/script.js: Session invalid, trying to refresh.");
            return await refreshSession();
        }
    } catch (error) {
        console.error("tabs/script.js: Error validating session:", error);
        return null;
    }
}

// Function to check login status
async function checkLoginStatus() {
  console.log("tabs/script.js: checkLoginStatus called.");
  const pageLoader = document.getElementById("pageLoader");
  
  const user = await validateAndRefreshSession();

  if (user && user.email) {
    console.log("tabs/script.js: User is logged in:", user);
    
    if (pageLoader) {
      pageLoader.classList.remove("active");
      console.log("tabs/script.js: Page loader deactivated.");
    }

    updateUserInfo(user);
    initializeChannelSelector();

    // If on dashboard, fetch saved channels and setup links
    if (document.body.dataset.title === "Dashboard") {
        fetchAndDisplaySavedChannels();
        setupDashboardChannelLinks();
    }

  } else {
    console.log("tabs/script.js: User is not logged in. Please log in via the popup.");
    if (pageLoader) {
      pageLoader.classList.remove("active");
    }
    const mainBox = document.querySelector('.main-box-layer');
    if (mainBox) {
      // Clear existing content and show prompt
      mainBox.innerHTML = `
        <div class="login-prompt">
          <h1>Please Log In</h1>
          <p>You need to log in through the extension popup to access this page.</p>
        </div>
      `;
    }
  }
}

// Channel Selector Logic
function updateSelectedChannelDisplay(channel) {
    const thumb = document.getElementById('selected-channel-thumb');
    const name = document.getElementById('selected-channel-name');
    if (thumb && name) {
        if (channel) {
            thumb.src = channel.thumbnail_url;
            name.textContent = channel.title;
        } else {
            thumb.src = '/images/icons/ph-user.png';
            name.textContent = 'Select Channel';
        }
    }
}

function handleChannelSelection(channel) {
    console.log("Selected channel:", channel);
    chrome.storage.local.set({ selectedChannel: channel }, () => {
        updateSelectedChannelDisplay(channel);
        // If on a channel-dependent page, refresh its content
        if (document.body.dataset.title === "Comment Center") {
            // Update header and fetch new comments
            const titleHeader = document.getElementById('channel-title-header');
            if (titleHeader) titleHeader.textContent = channel.title;
            fetchCommentsForChannel();
        }
    });
}

function populateChannelSelector(channels) {
    const optionsList = document.getElementById('channel-options-list');
    if (!optionsList) return;

    optionsList.innerHTML = ''; // Clear existing options

    if (!channels || channels.length === 0) {
        optionsList.innerHTML = '<li>No channels connected.</li>';
        return;
    }

    channels.forEach(channel => {
        const li = document.createElement('li');
        li.innerHTML = `
            <img src="${channel.thumbnail_url}" alt="${channel.title}">
            <span>${channel.title}</span>
        `;
        li.addEventListener('click', () => {
            handleChannelSelection(channel);
            optionsList.style.display = 'none'; // Hide dropdown after selection
        });
        optionsList.appendChild(li);
    });
}

async function initializeChannelSelector() {
    const selector = document.getElementById('channel-selector-dropdown');
    if (!selector) return;

    const channels = await getSavedChannels();
    populateChannelSelector(channels);

    chrome.storage.local.get('selectedChannel', ({ selectedChannel }) => {
        if (selectedChannel) {
            // Ensure the selected channel is still in the user's list
            const stillExists = channels.some(c => c.channel_id === selectedChannel.channel_id);
            if (stillExists) {
                updateSelectedChannelDisplay(selectedChannel);
            } else {
                // The previously selected channel was removed, clear it
                chrome.storage.local.remove('selectedChannel');
                updateSelectedChannelDisplay(null);
            }
        } else {
            updateSelectedChannelDisplay(null);
        }
    });

    // Dropdown toggle logic
    const trigger = selector.querySelector('.dropdown-trigger');
    const options = selector.querySelector('.dropdown-options');
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        options.style.display = options.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => {
        options.style.display = 'none';
    });
}

// Function to update user info
function updateUserInfo(user) {
  console.log("tabs/script.js: updateUserInfo called with user:", user);

  // Update common header elements available on all pages
  const userPicture = document.getElementById("user-picture");
  if (userPicture) {
    userPicture.src = user.picture || "/images/icons/ph-user.png";
    userPicture.onerror = () => { userPicture.src = "/images/icons/ph-user.png"; };
    console.log(`tabs/script.js: Set user-picture src to: ${userPicture.src}`);
  }
  
  // Dashboard specific elements
  if (document.body.dataset.title === "Dashboard") {
    const creditsElement = document.getElementById("user-credits");
    const planElement = document.getElementById("current-plan");
    const resetDateElement = document.getElementById("reset-date");
    const planButton = document.getElementById("plan-action-btn");

    if (creditsElement) {
      creditsElement.textContent = user.credits;
      console.log(`tabs/script.js: Set user-credits to: ${user.credits}`);
    }

    if (planElement) {
      planElement.textContent = user.account_type;
      console.log(`tabs/script.js: Set current-plan to: ${user.account_type}`);
    }

    if (resetDateElement) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const formattedDate = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      resetDateElement.textContent = formattedDate;
      console.log(`tabs/script.js: Set reset-date to: ${formattedDate}`);
    }

    if (planButton) {
      const userEmail = user.email;
      const encodedEmail = userEmail ? encodeURIComponent(userEmail) : null;

      if (user.account_type === "Basic") {
        planButton.textContent = "Upgrade Plan";
        let upgradeUrl = "https://pay.mlkv.xyz/buy/7c0ba400-32cb-4c57-a33f-2ebe7249f396";
        if (encodedEmail) {
          upgradeUrl += `?checkout[custom][user_email]=${encodedEmail}`;
        }
        planButton.href = upgradeUrl;
        console.log("tabs/script.js: User is on Basic plan, setting button to Upgrade. URL:", upgradeUrl);
      } else {
        planButton.textContent = "Manage Plan";
        let manageUrl = "https://app.lemonsqueezy.com/my-orders";
        if (encodedEmail) {
            manageUrl += `?email=${encodedEmail}`;
        }
        planButton.href = manageUrl;
        console.log("tabs/script.js: User is on a paid plan, setting button to Manage. URL:", manageUrl);
      }
    }
  } else if (document.body.dataset.title === "Pricing") {
    console.log("tabs/script.js: On Pricing page. Updating plan buttons based on user plan.");
    const userEmail = user.email;
    const encodedEmail = userEmail ? encodeURIComponent(userEmail) : '';
    const currentPlan = user.account_type;

    // Handle Free Plan button state
    const freeBtn = document.getElementById('free-plan-btn');
    if (freeBtn) {
        if (currentPlan === 'Basic') {
            freeBtn.textContent = "Current Plan";
            freeBtn.classList.add('disabled');
            freeBtn.removeAttribute('href');
        } else if (freeBtn.parentElement) {
            // Hide the 'Get Plan' button for Free if user is on any paid plan
            freeBtn.parentElement.style.display = 'none';
        }
    }

    // Handle combined Pro plan
    const proCard = document.getElementById('pro-card');
    if (proCard) {
        const proBtn = document.getElementById('pro-plan-btn');
        const proToggle = proCard.querySelector('.plan-toggle');

        if (currentPlan.includes('Pro')) {
            proBtn.textContent = "Current Plan";
            proBtn.classList.add('disabled');
            proBtn.removeAttribute('href');
            if (currentPlan.includes('Yearly')) {
                proToggle.checked = true;
                proToggle.dispatchEvent(new Event('change'));
            }
        } else {
            // Set default URL (monthly) with email if it's not the current plan
            const baseUrl = proBtn.href.split('?')[0];
            proBtn.href = `${baseUrl}?checkout[custom][user_email]=${encodedEmail}`;
        }
    }
    
    // Handle combined Gold plan
    const goldCard = document.getElementById('gold-card');
    if (goldCard) {
        const goldBtn = document.getElementById('gold-plan-btn');
        const goldToggle = goldCard.querySelector('.plan-toggle');
        
        if (currentPlan.includes('Gold')) {
            goldBtn.textContent = "Current Plan";
            goldBtn.classList.add('disabled');
            goldBtn.removeAttribute('href');
            if (currentPlan.includes('Yearly')) {
                goldToggle.checked = true;
                goldToggle.dispatchEvent(new Event('change'));
            }
        } else {
            // Set default URL (monthly) with email if it's not the current plan
            const baseUrl = goldBtn.href.split('?')[0];
            goldBtn.href = `${baseUrl}?checkout[custom][user_email]=${encodedEmail}`;
        }
    }
  }
}
