/**
 * CONTENT SCRIPT
 * Runs in Isolated World.
 * 1. Injects the injected.js script tag.
 * 2. Listens for completion.
 * 3. Harvests the data.
 */

function injectAndRun() {
    return new Promise((resolve) => {
        // Create script tag pointing to our web accessible resource
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injected.js');
        script.onload = function () {
            this.remove();
        };

        // Listen for the complete event FIRST before injecting
        const listener = () => {
            document.removeEventListener('FOLO_LINKS_READY', listener);
            resolve();
        };
        document.addEventListener('FOLO_LINKS_READY', listener);

        // Inject
        (document.head || document.documentElement).appendChild(script);
    });
}

function generateMarkdown(onlyUnread) {
    const links = Array.from(document.querySelectorAll('a'));
    const uniqueLinks = new Set();
    const markdownList = [];

    links.forEach(a => {
        // Prefer the data-original-url set by the injected script, fallback to href
        let url = a.dataset.originalUrl || a.href;

        const rawTitle = a.innerText.trim();
        const title = rawTitle.split('\n')[0].trim();

        // Unread check logic
        let isUnread = true;
        const allElements = Array.from(a.querySelectorAll('*'));
        const titleEl = allElements.find(el => el.innerText && el.innerText.trim() === title && el.children.length === 0) || a;
        if (titleEl.classList.contains('text-text-secondary') || (titleEl.parentElement && titleEl.parentElement.classList.contains('text-text-secondary'))) {
            isUnread = false;
        }

        if (title.length > 5 &&
            (url.startsWith('http') || url.startsWith('https')) &&
            !uniqueLinks.has(url) &&
            !url.includes('/feed/') &&
            !url.includes('/profile/') &&
            !url.includes('/timeline/') // Now we can strictly filter timeline links
        ) {

            if (onlyUnread && !isUnread) return;

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
        // 1. Inject script to populate data attributes
        injectAndRun().then(() => {
            // 2. Read DOM
            try {
                const data = generateMarkdown(request.onlyUnread);
                const count = data ? data.split('\n').length : 0;
                sendResponse({ data: data, count: count });
            } catch (error) {
                console.error("Extraction failed:", error);
                sendResponse({ data: "", count: 0, error: error.message });
            }
        });
        return true; // Keep channel open for async response
    }
});
