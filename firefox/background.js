
// Map of URL to ADAM Code
const urlToCode = new Map();

// Global variables for generic fallback in Firefox
let latestAdamCode = null;
let latestAdamTime = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_ADAM_CODE' && message.code) {
        latestAdamCode = message.code;
        latestAdamTime = Date.now();

        if (sender.tab && sender.tab.url) {
            // Normalize URL (ignore query params if needed, or keep full)
            urlToCode.set(sender.tab.url, message.code);
            console.log(`Stored code ${message.code} for URL ${sender.tab.url}`);
        }
    }
});

// Chrome compatibility (ignored by Firefox)
if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
        // Check if we have a code for the referrer of this download
        if (item.referrer && urlToCode.has(item.referrer)) {
            const code = urlToCode.get(item.referrer);
            const ext = item.filename.split('.').pop();
            const newFilename = `${code}.${ext}`;

            console.log(`[Chrome] Renaming download from ${item.filename} to ${newFilename}`);

            suggest({
                filename: newFilename,
                conflictAction: 'uniquify'
            });
        } else {
            suggest(); // Default naming
        }
    });
}

// Firefox compatibility using webRequest to alter Content-Disposition
if (chrome.webRequest && chrome.webRequest.onHeadersReceived) {
    chrome.webRequest.onHeadersReceived.addListener(
        (details) => {
            // Only rename if we received a code in the last 15 seconds
            if (!latestAdamCode || (Date.now() - latestAdamTime > 15000)) {
                return {};
            }

            let headers = details.responseHeaders;
            let modified = false;

            if (headers) {
                for (let i = 0; i < headers.length; i++) {
                    if (headers[i].name.toLowerCase() === 'content-disposition') {
                        let value = headers[i].value;
                        if (value.includes('filename=')) {
                            // Extract the extension from the original filename
                            let match = value.match(/filename="?([^"]+)"?/);
                            if (match && match[1]) {
                                let originalFilename = match[1];
                                let parts = originalFilename.split('.');
                                let ext = parts.length > 1 ? parts.pop() : '';

                                let newFilename = `${latestAdamCode}${ext ? '.' + ext : ''}`;
                                // Replace the filename in the header
                                headers[i].value = value.replace(/filename="?[^"]+"?/, `filename="${newFilename}"`);
                                modified = true;

                                // Consume the code to prevent renaming unrelated concurrent downloads
                                console.log(`[Firefox] Rewrote Content-Disposition filename to ${newFilename}`);
                                latestAdamCode = null;
                            }
                        }
                        break;
                    }
                }
            }

            if (modified) {
                return { responseHeaders: headers };
            }
            return {};
        },
        { urls: ["*://cerpp.eprocurement.gov.gr/*"] },
        ["blocking", "responseHeaders"]
    );
}
