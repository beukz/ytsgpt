document.addEventListener('DOMContentLoaded', function () {
  // Don't run if not in an extension context
  if (
    typeof chrome === 'undefined' ||
    !chrome.storage ||
    !chrome.storage.local
  ) {
    console.error(
      'checkout.js: Not running in an extension context. Aborting.'
    );
    return;
  }

  console.log('checkout.js: DOMContentLoaded event fired.');
  const checkoutLink = document.querySelector('.popup-acc-type-pro'); // Target your link

  if (!checkoutLink) {
    // The link might not be on the page (e.g., user not logged in), so exit gracefully.
    return;
  }

  // Retrieve the user email from chrome.storage using chrome.storage.local.get
  chrome.storage.local.get(['user'], function (result) {
    const userEmail = result.user?.email; // Access the user's email from the stored user object

    // Log the user email to the console for debugging
    console.log('checkout.js: User email from chrome.storage:', userEmail);

    // If userEmail is found, proceed to update the link
    if (userEmail) {
      const encodedEmail = encodeURIComponent(userEmail); // Encode the email for safe URL usage
      const baseUrl =
        'https://pay.mlkv.xyz/buy/7c0ba400-32cb-4c57-a33f-2ebe7249f396';
      const updatedUrl = `${baseUrl}?checkout[custom][user_email]=${encodedEmail}`;

      // Update the href attribute of the link
      checkoutLink.href = updatedUrl;
      console.log('checkout.js: Updated checkout link href to:', updatedUrl);
    } else {
      console.error('checkout.js: User email not found in chrome.storage.');
    }
  });
});
