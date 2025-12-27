/**
 * popup.js
 * Handles the logic for the extension popup.
 * Sends a message to the active tab's content script to extract links.
 */

document.getElementById('exportBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    const onlyUnread = document.getElementById('onlyUnread').checked;

    // Reset status
    statusDiv.textContent = "Processing...";
    statusDiv.className = "";

    try {
        // Query the active tab in the current window
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            throw new Error("No active tab found.");
        }

        // Send message to the content script
        chrome.tabs.sendMessage(tab.id, { action: "extract", onlyUnread: onlyUnread }, (response) => {
            // Check for runtime errors (e.g., content script not loaded)
            if (chrome.runtime.lastError) {
                statusDiv.textContent = "⚠️ Error: Please refresh the page.";
                statusDiv.className = "error";
                console.error(chrome.runtime.lastError);
                return;
            }

            if (response && response.data) {
                // Copy to clipboard
                navigator.clipboard.writeText(response.data).then(() => {
                    statusDiv.textContent = `✅ Copied ${response.count} items!`;
                    statusDiv.className = "success";

                    // Clear success message after 3 seconds
                    setTimeout(() => {
                        statusDiv.textContent = "";
                    }, 3000);
                }).catch(err => {
                    statusDiv.textContent = "❌ Clipboard Error";
                    statusDiv.className = "error";
                    console.error("Clipboard write failed", err);
                });
            } else {
                statusDiv.textContent = response && response.error ? `❌ ${response.error}` : "⚠️ No links found.";
                statusDiv.className = "error";
            }
        });
    } catch (err) {
        statusDiv.textContent = "❌ Unexpected Error";
        statusDiv.className = "error";
        console.error("Popup Error:", err);
    }
});
