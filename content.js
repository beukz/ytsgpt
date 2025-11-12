// Global loader for initialization
function showGlobalLoader() {
  // Prevent adding multiple loaders if the script is injected again
  if (document.getElementById('ytsgpt-global-loader')) return;

  const globalLoader = document.createElement('div');
  globalLoader.id = 'ytsgpt-global-loader';
  globalLoader.innerHTML = `
    <div class="loader"></div>
    <span>YTS-GPT is initializing...</span>
  `;
  document.body.appendChild(globalLoader);
}

function hideGlobalLoader() {
  const loader = document.getElementById('ytsgpt-global-loader');
  if (loader) {
    // Add transition for fade-out effect
    loader.style.transition = 'opacity 0.5s ease-out';
    loader.style.opacity = '0';
    
    // Remove the element from the DOM after the transition ends
    setTimeout(() => {
      loader.remove();
    }, 500); // Corresponds to the transition duration
  }
}

// Function to get video context (title and description) from the current page
function getVideoContext() {
  const context = { videoTitle: null, videoDescription: null };
  const url = window.location.href;

  if (url.includes("youtube.com/watch")) {
      const titleElement = document.querySelector("h1.ytd-watch-metadata yt-formatted-string");
      const descriptionElement = document.querySelector("#description-inline-expander .yt-core-attributed-string");
      
      if (titleElement) {
          context.videoTitle = titleElement.textContent.trim();
      }
      if (descriptionElement) {
          context.videoDescription = descriptionElement.textContent.trim();
      }
  } else if (url.includes("studio.youtube.com/video")) {
      const titleElement = document.querySelector("h1.ytcp-video-header");
      if (titleElement) {
          context.videoTitle = titleElement.textContent.trim();
      }
      // Description is not readily available on the Studio comments page.
  }
  
  console.log("getVideoContext: Found context:", context);
  return context;
}

// Function to add the Generate Comment button and custom dropdown to each comment box
function addGenerateButtons() {
  console.log("addGenerateButtons: Function called.");
  chrome.storage.local.get(["defaultTone", "customTones"], (settings) => {
    const defaultToneValue = settings.defaultTone;
    const customTones = settings.customTones || [];
    console.log("addGenerateButtons: Retrieved default tone:", defaultToneValue);
    console.log("addGenerateButtons: Retrieved custom tones:", customTones);

    // Select all reply buttons on the page
    const replyButtons = document.querySelectorAll(
      "ytcp-comment-button#cancel-button.style-scope.ytcp-commentbox"
    ); // Adjust the selector based on actual button ID or class
    console.log(`addGenerateButtons: Found ${replyButtons.length} reply buttons in YouTube Studio.`);

    const replyButtonsHome = document.querySelectorAll(
      "ytd-button-renderer#cancel-button.style-scope.ytd-commentbox"
    ); // Adjust the selector based on actual button ID or class
    console.log(`addGenerateButtons: Found ${replyButtonsHome.length} reply buttons on YouTube main site.`);

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

    replyButtonsHome.forEach((replyButton, index) => {
      if (!replyButton.parentNode.querySelector(".generate-comment-button")) {
        console.log("addGenerateButtons: Adding button and dropdown to a YouTube main site comment box.");
        // Check if the button is already added
        // Create the Generate Comment button with the required span tags and classes
        const generateButton = document.createElement("button");
        generateButton.className =
          "generate-comment-button ytcp-button-shape-impl ytcp-button-shape-impl--tonal ytcp-button-shape-impl--mono ytcp-button-shape-impl--size-m"; // Use a class to distinguish multiple buttons

        // Add the inner spans for the button
        generateButton.innerHTML = `
                  <span class="btn-text">Generate Comment</span>
                  <span class="loader ytcp-button-shape-impl--mono"></span>
              `;

        // Create the custom dropdown for tone selection
        const toneSelector = document.createElement("div");
        toneSelector.className = "tone-selector custom-dropdown    ";
        toneSelector.innerHTML = `
                  <div class="dropdown-trigger
                  ytcp-button-shape-impl ytcp-button-shape-impl--size-m ytcp-button-shape-impl--tonal ytcp-button-shape-impl--mono">
  
                  <span class="selected-option">
                      Select Tone
                  </span>
  
                  <span class="dropdown- ytcp-button-shape-impl--mono">
                      &#9662;
                  </span> 
                  
                  </div>
                  <ul class="dropdown-options">
                      ${tonesListHtml}
                  </ul>
              `;

        const selectedOption = toneSelector.querySelector(".selected-option");
        if (defaultToneValue && defaultToneValue !== "Select Tone") {
          const li = toneSelector.querySelector(
            `li[data-value="${defaultToneValue}"]`
          );
          if (li) {
            selectedOption.textContent = li.textContent;
            console.log("addGenerateButtons: Set default tone on dropdown:", li.textContent);
          }
        }

        // Inject the tone selector and the button next to the Reply button
        replyButton.parentNode.insertBefore(
          toneSelector,
          replyButton.nextSibling
        );
        replyButton.parentNode.insertBefore(
          generateButton,
          toneSelector.nextSibling
        );

        // Add click event listener to the button
        generateButton.addEventListener("click", async () => {
          const selectedTone =
            toneSelector.querySelector(".selected-option").textContent;
          console.log("generate-comment-button (Home): Clicked. Selected tone:", selectedTone);
          generateCommentHome(replyButton, selectedTone);
        });

        // Add custom dropdown functionality
        setupDropdown(toneSelector);
      }
    });

    replyButtons.forEach((replyButton) => {
      if (!replyButton.parentNode.querySelector(".generate-comment-button")) {
        console.log("addGenerateButtons: Adding button and dropdown to a YouTube Studio comment box.");
        // Check if the button is already added
        // Create the Generate Comment button with the required span tags and classes
        const generateButton = document.createElement("button");
        generateButton.className =
          "generate-comment-button ytcp-button-shape-impl ytcp-button-shape-impl--tonal ytcp-button-shape-impl--mono ytcp-button-shape-impl--size-m"; // Use a class to distinguish multiple buttons

        // Add the inner spans for the button
        generateButton.innerHTML = `
                  <span class="btn-text">Generate Comment</span>
                  <span class="loader ytcp-button-shape-impl--mono"></span>
              `;

        // Create the custom dropdown for tone selection
        const toneSelector = document.createElement("div");
        toneSelector.className = "tone-selector custom-dropdown    ";
        toneSelector.innerHTML = `
                  <div class="dropdown-trigger
                  ytcp-button-shape-impl ytcp-button-shape-impl--size-m ytcp-button-shape-impl--tonal ytcp-button-shape-impl--mono">
  
                  <span class="selected-option">
                      Select Tone
                  </span>
  
                  <span class="dropdown- ytcp-button-shape-impl--mono">
                      &#9662;
                  </span> 
                  
                  </div>
                  <ul class="dropdown-options">
                      ${tonesListHtml}
                  </ul>
              `;
        
        const selectedOption = toneSelector.querySelector(".selected-option");
        if (defaultToneValue && defaultToneValue !== "Select Tone") {
          const li = toneSelector.querySelector(
            `li[data-value="${defaultToneValue}"]`
          );
          if (li) {
            selectedOption.textContent = li.textContent;
            console.log("addGenerateButtons: Set default tone on dropdown:", li.textContent);
          }
        }

        // Inject the tone selector and the button next to the Reply button
        replyButton.parentNode.insertBefore(
          toneSelector,
          replyButton.nextSibling
        );
        replyButton.parentNode.insertBefore(
          generateButton,
          toneSelector.nextSibling
        );

        // Add click event listener to the button
        generateButton.addEventListener("click", async () => {
          const selectedTone =
            toneSelector.querySelector(".selected-option").textContent;
          console.log("generate-comment-button (Studio): Clicked. Selected tone:", selectedTone);
          generateComment(replyButton, selectedTone);
        });

        // Add custom dropdown functionality
        setupDropdown(toneSelector);
      }
    });
  });
}

async function generateCommentHome(replyButton, tone) {
  console.log("generateCommentHome: Function called.");
  // Retrieve the user email from chrome.storage
  chrome.storage.local.get(["user", "channelTopic", "appendMessageEnabled", "appendMessageText"], async (result) => {
    const user = result.user;
    const channelTopic = result.channelTopic;
    const appendMessageEnabled = result.appendMessageEnabled;
    const appendMessageText = result.appendMessageText;
    console.log("generateCommentHome: Retrieved from storage:", { user, channelTopic, appendMessageEnabled, appendMessageText });

    if (!user) {
      console.error("generateCommentHome: User details not found in chrome.storage.");
      // Redirect to your login page
      // window.location.href = "https://mlkv.xyz/login/google";
      return;
    }

    const { email } = user; // Extract email from user details
    const { videoTitle, videoDescription } = getVideoContext(); // Get video context

    // Traverse up to the comment's root container (ytd-comment-view-model)
    const commentContainer = replyButton.closest("ytd-comment-view-model");

    // Find the comment text element within this specific container
    const commentElement = commentContainer
      ? commentContainer.querySelector(
          "ytd-expander div#content yt-attributed-string#content-text"
        )
      : null;

    const commentText = commentElement ? commentElement.textContent.trim() : "";

    console.log("generateCommentHome: Specific Comment Container:", commentContainer);
    console.log("generateCommentHome: Comment Element:", commentElement);
    console.log("generateCommentHome: Specific Comment text:", commentText);
    console.log("generateCommentHome: Tone:", tone);
    console.log("generateCommentHome: Email:", email);

    const generateButton = replyButton.parentNode.querySelector(
      ".generate-comment-button"
    );
    const btnText = generateButton.querySelector(".btn-text");
    const loader = generateButton.querySelector(".loader");

    if (commentText) {
      // Show the loader and hide the button text
      btnText.style.display = "none";
      loader.style.display = "inline-block";
      console.log("generateCommentHome: Calling API to generate comment.");

      try {
        const response = await fetch(
          "https://qrnnthitqgpiowixmlpd.supabase.co/functions/v1/generate-comment", // Replace with your actual endpoint
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybm50aGl0cWdwaW93aXhtbHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDIyMjksImV4cCI6MjA3MzAxODIyOX0.XOde44pjV-jh1ITX9KfWbnJBWg14tuMyqQSFQ4dBtXk", // Add your Supabase anon key here
              "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybm50aGl0cWdwaW93aXhtbHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDIyMjksImV4cCI6MjA3MzAxODIyOX0.XOde44pjV-jh1ITX9KfWbnJBWg14tuMyqQSFQ4dBtXk", // Add your Supabase anon key here
            },
            body: JSON.stringify({
              comment: commentText,
              tone: tone,
              email: email,
              language: document.documentElement.lang,
              channelContext: channelTopic,
              videoTitle: videoTitle,
              videoDescription: videoDescription,
              appendMessageEnabled: appendMessageEnabled,
              appendMessageText: appendMessageText,
            }),
          }
        );

        const data = await response.json();
        console.log("generateCommentHome: API response received:", data);

        if (data.success) {
          if (data.generated_comment) {
            console.log("generateCommentHome: Comment generated successfully.");
            const finalComment = data.generated_comment;

            // Find the reply box container
            const replyBox = commentContainer.querySelector(
              "ytd-commentbox#commentbox"
            );

            if (replyBox) {
              // Find the contenteditable textarea within the reply box
              const textarea = replyBox.querySelector(
                "#contenteditable-root"
              );

              if (textarea) {
                // Update the textarea element with the generated comment
                textarea.textContent = finalComment;
                console.log("generateCommentHome: Inserted generated comment into textarea.");
                // Manually trigger any necessary events if required (e.g., input events)
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
              } else {
                console.error(
                  "generateCommentHome: Could not find the #contenteditable-root container for inserting the generated comment."
                );
              }
            } else {
              console.error(
                "generateCommentHome: Could not find the reply box (ytd-commentbox#commentbox) for inserting the generated comment."
              );
            }
          } else {
            console.error("generateCommentHome: Failed to generate comment:", data.error);
            // Display error message in the reply box
            displayErrorInTextareaHome(commentContainer, data.error);
          }
        } else {
          // If response is not OK, throw an error with the backend error message
          throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error("generateCommentHome: Error generating comment:", error);

        // Display error message in the reply box
        if (error.message === "HTTP error! status: 402") {
          displayErrorInTextarea(
            commentContainer,
            "Insufficient credits, please top-up your account. New credits will be added to your account at the beginning of each month."
          );
        } else {
          displayErrorInTextarea(commentContainer, error.message);
        }
      } finally {
        // Revert visibility of the button text and loader
        loader.style.display = "none";
        btnText.style.display = "inline";
        console.log("generateCommentHome: API call finished, reverting button state.");
      }
    } else {
      console.error("generateCommentHome: Comment text is empty.");
      // Display error message in the reply box if comment text is empty
      displayErrorInTextarea(commentContainer, "Comment text is empty.");
    }
  });
}

// Helper function to display errors in the textarea
function displayErrorInTextarea(commentContainer, errorMessage) {
  console.log("displayErrorInTextarea (Studio): Displaying error:", errorMessage);
  const textarea = commentContainer.querySelector("#contenteditable-root");
  if (textarea) {
    textarea.textContent = errorMessage;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// Function to generate the comment
async function generateComment(replyButton, tone) {
  console.log("generateComment (Studio): Function called.");
  // Retrieve the user email from chrome.storage
  chrome.storage.local.get(["user", "channelTopic", "appendMessageEnabled", "appendMessageText"], async (result) => {
    const user = result.user;
    const channelTopic = result.channelTopic;
    const appendMessageEnabled = result.appendMessageEnabled;
    const appendMessageText = result.appendMessageText;
    console.log("generateComment (Studio): Retrieved from storage:", {
      user,
      channelTopic,
      appendMessageEnabled,
      appendMessageText,
    });

    if (!user) {
      console.error(
        "generateComment (Studio): User details not found in chrome.storage."
      );
      // Redirect to your login page
      // window.location.href = "https://mlkv.xyz/login/google";
      return;
    }

    const { email } = user; // Extract email from user details
    const commentContainer = replyButton.closest(".ytcp-comment-thread");

    // --- NEW LOGIC FOR VIDEO TITLE ---
    let videoTitle = null;
    let videoDescription = null; // Description is not available on this page.

    // Try to find title relative to the comment (works on main comments page)
    if (commentContainer) {
      const titleElement = commentContainer.querySelector(
        "div#video-title.style-scope.ytcp-comment-video-thumbnail"
      );
      if (titleElement) {
        videoTitle = titleElement.textContent.trim();
        console.log(
          "generateComment (Studio): Found video title from comment thread:",
          videoTitle
        );
      }
    }

    // Fallback for pages where the above selector doesn't work (e.g., specific video page in Studio)
    if (!videoTitle) {
      const context = getVideoContext();
      videoTitle = context.videoTitle;
      videoDescription = context.videoDescription; // Might still be null, which is fine
      console.log(
        "generateComment (Studio): Falling back to global context for video title:",
        videoTitle
      );
    }
    // --- END NEW LOGIC ---

    const commentElement = commentContainer
      ? commentContainer.querySelector("#content-text")
      : null;
    const commentText = commentElement ? commentElement.textContent.trim() : "";
    console.log("generateComment (Studio): Found comment text:", commentText);

    const generateButton = replyButton.parentNode.querySelector(
      ".generate-comment-button"
    );
    const btnText = generateButton.querySelector(".btn-text");
    const loader = generateButton.querySelector(".loader");

    if (commentText) {
      // Show the loader and hide the button text
      btnText.style.display = "none";
      loader.style.display = "inline-block";
      console.log("generateComment (Studio): Calling API to generate comment.");

      try {
        const response = await fetch(
          "https://qrnnthitqgpiowixmlpd.supabase.co/functions/v1/generate-comment", // Replace with your actual endpoint
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey:
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybm50aGl0cWdwaW93aXhtbHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDIyMjksImV4cCI6MjA3MzAxODIyOX0.XOde44pjV-jh1ITX9KfWbnJBWg14tuMyqQSFQ4dBtXk",
              Authorization:
                "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFybm50aGl0cWdwaW93aXhtbHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDIyMjksImV4cCI6MjA3MzAxODIyOX0.XOde44pjV-jh1ITX9KfWbnJBWg14tuMyqQSFQ4dBtXk", // Add your Supabase anon key here
            },
            body: JSON.stringify({
              comment: commentText,
              tone: tone,
              email: email,
              language: document.documentElement.lang,
              channelContext: channelTopic,
              videoTitle: videoTitle,
              videoDescription: videoDescription,
              appendMessageEnabled: appendMessageEnabled,
              appendMessageText: appendMessageText,
            }),
          }
        );

        const data = await response.json();
        console.log("generateComment (Studio): API response received:", data);

        if (data.success) {
          console.log(
            "generateComment (Studio): Comment generated successfully."
          );
          const finalComment = data.generated_comment;

          // Find the tp-yt-iron-autogrow-textarea container
          const textareaContainer = commentContainer.querySelector(
            "tp-yt-iron-autogrow-textarea"
          );

          if (textareaContainer) {
            const mirrorElement = textareaContainer.querySelector("#mirror");
            const textareaElement =
              textareaContainer.querySelector("textarea");

            if (mirrorElement && textareaElement) {
              // Update the mirror element with the generated comment
              mirrorElement.innerHTML = finalComment;
              textareaElement.value = finalComment;
              console.log(
                "generateComment (Studio): Inserted generated comment into textarea."
              );

              // Manually trigger any necessary events if required (e.g., input events)
              textareaElement.dispatchEvent(
                new Event("input", { bubbles: true })
              );
            } else {
              console.error(
                "generateComment (Studio): Mirror or textarea element not found in the tp-yt-iron-autogrow-textarea container."
              );
            }
          } else {
            console.error(
              "generateComment (Studio): Could not find the tp-yt-iron-autogrow-textarea container."
            );
          }
        } else {
          console.error(
            "generateComment (Studio): Failed to generate comment:",
            data.error
          );
          // Display error message in textarea if no comment is generated
          displayErrorInTextarea(commentContainer, data.error);
        }
      } catch (error) {
        console.error(
          "generateComment (Studio): Error generating comment:",
          error
        );
        // Display error message in textarea
        // console.log(error);
        // displayErrorInTextarea(commentContainer, error.message);

        // if error 403 , display Insufficient credits, please top-up your account.
        if (error.message === "HTTP error! status: 402") {
          displayErrorInTextarea(
            commentContainer,
            "Insufficient credits, please top-up your account. New credits will be added to your account at the beginning of each month."
          );
        }
      } finally {
        // Revert visibility of the button text and loader
        loader.style.display = "none";
        btnText.style.display = "inline";
        console.log(
          "generateComment (Studio): API call finished, reverting button state."
        );
      }
    } else {
      console.error("generateComment (Studio): Comment text is empty.");
      // Display error message in textarea if comment text is empty
      displayErrorInTextarea(commentContainer, "Comment text is empty.");
    }
  });
}

// Function to display error message in the textarea
function displayErrorInTextarea(container, errorMessage) {
  console.log("displayErrorInTextarea (Studio): Displaying error:", errorMessage);
  const textareaContainer = container.querySelector(
    "tp-yt-iron-autogrow-textarea"
  );

  if (textareaContainer) {
    const mirrorElement = textareaContainer.querySelector("#mirror");
    const textareaElement = textareaContainer.querySelector("textarea");

    if (mirrorElement && textareaElement) {
      // Update the mirror element with the error message
      mirrorElement.innerHTML = errorMessage;
      textareaElement.value = errorMessage;

      // Manually trigger any necessary events if required (e.g., input events)
      textareaElement.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      console.error(
        "displayErrorInTextarea (Studio): Mirror or textarea element not found in the tp-yt-iron-autogrow-textarea container for error message."
      );
    }
  } else {
    console.error(
      "displayErrorInTextarea (Studio): Could not find the tp-yt-iron-autogrow-textarea container for error message."
    );
  }
}

// Function to display error message in the textarea
function displayErrorInTextareaHome(commentContainer, errorMessage) {
  console.log("displayErrorInTextareaHome: Displaying error:", errorMessage);
  // Find the reply box container
  const replyBox = commentContainer.querySelector("ytd-commentbox#commentbox");

  if (replyBox) {
    // Find the contenteditable textarea within the reply box
    const textarea = replyBox.querySelector("#contenteditable-root");

    if (textarea) {
      // Update the textarea element with the error message
      textarea.textContent = errorMessage;

      // Manually trigger any necessary events if required (e.g., input events)
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      console.error(
        "displayErrorInTextareaHome: Could not find the #contenteditable-root container for error message."
      );
    }
  } else {
    console.error(
      "displayErrorInTextareaHome: Could not find the reply box (ytd-commentbox#commentbox) for error message."
    );
  }
}

// Function to observe and add Generate Comment buttons dynamically as content loads
function observeMutations() {
  console.log("observeMutations: Initializing MutationObserver.");
  const observer = new MutationObserver(() => {
    // console.log("observeMutations: DOM changed, running addGenerateButtons.");
    addGenerateButtons(); // Re-run the button addition logic whenever DOM changes
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Function to set up custom dropdown functionality
function setupDropdown(toneSelector) {
  console.log("setupDropdown: Setting up dropdown.");
  const trigger = toneSelector.querySelector(".dropdown-trigger");
  const optionsContainer = toneSelector.querySelector(".dropdown-options");
  const selectedOption = toneSelector.querySelector(".selected-option");

  // Toggle dropdown visibility
  trigger.addEventListener("click", function () {
    const isVisible = optionsContainer.style.display === "block";
    optionsContainer.style.display = isVisible ? "none" : "block";
    console.log("setupDropdown: Dropdown toggled to", isVisible ? "hidden" : "visible");
  });

  // Handle option selection
  optionsContainer.querySelectorAll("li").forEach((option) => {
    option.addEventListener("click", function () {
      selectedOption.textContent = this.textContent;
      optionsContainer.style.display = "none";
      console.log("setupDropdown: Option selected:", this.textContent);
    });
  });

  // Close dropdown if clicked outside
  document.addEventListener("click", function (event) {
    if (!toneSelector.contains(event.target)) {
      optionsContainer.style.display = "none";
    }
  });
}

// Initial setup
console.log("content.js: Script loaded. Initializing...");
showGlobalLoader();
addGenerateButtons(); // Add Generate Comment buttons
observeMutations(); // Start observing DOM changes

// Hide the loader after a delay to cover the initial injection time
setTimeout(hideGlobalLoader, 2000);