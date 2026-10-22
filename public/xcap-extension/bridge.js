/**
 * Runs in the ISOLATED world, where chrome.* is available but the page's own
 * fetch is not. The capture scripts run in the MAIN world, where it is the
 * other way round. Nothing is shared between the two but the DOM, so settings
 * cross on an attribute and requests cross as events.
 */
const DEFAULTS = {
    deriveAvatar: true,
    nativeAsUcid: true
};

function publish(config) {
    const write = () => {
        try {
            document.documentElement.setAttribute('data-xcap-config', JSON.stringify(config));
            // The MAIN world cannot reach chrome.runtime, but the page it is
            // embedded in needs to know which build is answering.
            try {
                document.documentElement.setAttribute(
                    'data-xcap-version', chrome.runtime.getManifest().version);
            } catch (e) { /* manifest unavailable */ }
            document.dispatchEvent(new Event('xcap:config'));
        } catch (e) { /* page torn down mid-write */ }
    };
    // at document_start the root element is normally there already, but the
    // storage read is async and may land either side of it
    if (document.documentElement) write();
    else document.addEventListener('DOMContentLoaded', write, { once: true });
}

chrome.storage.local.get(DEFAULTS, publish);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') chrome.storage.local.get(DEFAULTS, publish);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only the top frame answers, or every chart iframe would race to reply.
    if (message && message.type === 'xcap:get' && window === window.top) {
        let snapshot = null;
        try {
            document.dispatchEvent(new Event('xcap:get'));   // handled synchronously
            snapshot = JSON.parse(document.documentElement.getAttribute('data-xcap-snapshot') || 'null');
        } catch (e) { /* no capture script, or torn down */ }
        sendResponse(snapshot);
        return;
    }
    if (message && message.type === 'xcap:show') {
        document.dispatchEvent(new Event('xcap:show'));
    }
    if (message && message.type === 'xcap:net' && message.url) {
        document.dispatchEvent(new CustomEvent('xcap:net', { detail: message.url }));
    }
});
