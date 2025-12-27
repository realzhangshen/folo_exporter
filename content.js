/**
 * Extracts links from the Follow.is timeline.
 * @param {boolean} onlyUnread - If true, only returns links customized as unread.
 * @returns {string} - A newline-separated string of Markdown links.
 */
function extractLinks(onlyUnread) {
    // Select all links (including relative ones)
    const links = Array.from(document.querySelectorAll('a'));
    const uniqueLinks = new Set();
    const markdownList = [];

    links.forEach(a => {
        const url = a.href;

        // CLEANUP TITLE: Split by newline and take the first line to avoid capturing summary/time metadata
        const rawTitle = a.innerText.trim();
        const title = rawTitle.split('\n')[0].trim();

        // UNREAD DETECTION LOGIC
        // Read items in Follow.is usually have the class 'text-text-secondary' applied to the title or its parent.
        // Unread items typically use the default text color (black/dark).
        let isUnread = true;

        // Find the specific element that holds the title text to check its class
        const allElements = Array.from(a.querySelectorAll('*'));
        const titleEl = allElements.find(el => el.innerText && el.innerText.trim() === title && el.children.length === 0) || a;

        // Check for the "read" color class
        if (titleEl.classList.contains('text-text-secondary') || (titleEl.parentElement && titleEl.parentElement.classList.contains('text-text-secondary'))) {
            isUnread = false;
        }

        // Apply filters to exclude non-article links
        // - Title length > 5: Avoids icons or empty links
        // - url.startsWith('http'): Valid absolute URLs only
        // - !uniqueLinks.has(url): Deduplicate
        // - Exclude /feed/ and /profile/ links which are internal navigation
        if (title.length > 5 && url.startsWith('http') && !uniqueLinks.has(url) && !url.includes('/feed/') && !url.includes('/profile/')) {

            if (onlyUnread && !isUnread) return; // Skip read items if requested

            uniqueLinks.add(url);
            markdownList.push(`- [ ] [${title}](${url})`);
        }
    });

    if (markdownList.length === 0) return "";
    return markdownList.join('\n');
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract") {
        try {
            const data = extractLinks(request.onlyUnread);
            const count = data ? data.split('\n').length : 0;
            sendResponse({ data: data, count: count });
        } catch (error) {
            console.error("Extraction failed:", error);
            sendResponse({ data: "", count: 0, error: error.message });
        }
    }
});
