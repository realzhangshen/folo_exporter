/**
 * This script runs in the MAIN WORLD (injected into the page via script src).
 * It has access to React internals to extract the original article URLs.
 */
(function () {
    const DEBUG = false;
    function log(...args) { if (DEBUG) console.log('[Follow-Exporter-Main]', ...args); }

    function getReactFiber(dom) {
        const key = Object.keys(dom).find(k => k.startsWith('__reactFiber'));
        return key ? dom[key] : null;
    }

    // Traverse logic
    function findUrlInReact(domElement) {
        try {
            const fiber = getReactFiber(domElement);
            if (!fiber) return null;

            let current = fiber;
            for (let i = 0; i < 20; i++) {
                if (!current) break;

                // 1. Check Memoized State (Hooks)
                let hook = current.memoizedState;
                while (hook) {
                    const val = hook.memoizedState;
                    if (val && typeof val === 'object') {
                        if (val.id && val.url && typeof val.url === 'string') {
                            if (!val.url.includes('/timeline/') && (val.url.startsWith('http') || val.url.startsWith('https'))) {
                                return val.url;
                            }
                        }
                    }
                    hook = hook.next;
                }

                // 2. Check Memoized Props
                const props = current.memoizedProps;
                if (props) {
                    const candidate = props.item || props.data || props.article;
                    if (candidate && candidate.url && !candidate.url.includes('/timeline/') && candidate.url.startsWith('http')) {
                        return candidate.url;
                    }
                }
                current = current.return;
            }
        } catch (e) {
            // ignore
        }
        return null;
    }

    log("Starting extraction...");
    let foundCount = 0;
    const links = document.querySelectorAll('a[href*="/timeline/"]');

    links.forEach(a => {
        // Optimization: don't re-process if we already found it
        if (a.dataset.originalUrl) return;

        const original = findUrlInReact(a);
        if (original) {
            a.setAttribute('data-original-url', original);
            foundCount++;
        }
    });

    log(`Processed ${links.length} links, found ${foundCount} original URLs.`);

    // Notify content script we are done
    document.dispatchEvent(new CustomEvent('FOLO_LINKS_READY'));
})();
