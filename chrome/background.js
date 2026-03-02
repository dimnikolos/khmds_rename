
// Map of URL to ADAM Code
const urlToCode = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_ADAM_CODE' && message.code) {
        if (sender.tab && sender.tab.url) {
            // Normalize URL (ignore query params if needed, or keep full)
            // PrimeFaces might change query params? Best to keep relatively strict or just origin+path
            // The snippet showed .../home.xhtml;jsessionid=...
            // So referrer will likely contain jsessionid.
            // We'll store the exact URL, and maybe a simplified version.
            urlToCode.set(sender.tab.url, message.code);
            console.log(`Stored code ${message.code} for URL ${sender.tab.url}`);
        }
    }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    // Check if we have a code for the referrer of this download
    // The referrer is usually the page that initiated the download
    if (item.referrer && urlToCode.has(item.referrer)) {
        const code = urlToCode.get(item.referrer);
        // Get the original extension
        const ext = item.filename.split('.').pop();
        const newFilename = `${code}.${ext}`;

        console.log(`Renaming download from ${item.filename} to ${newFilename}`);

        suggest({
            filename: newFilename,
            conflictAction: 'uniquify'
        });
    } else {
        // If exact match fails, try fuzzy match (ignore jsessionid?)
        // This is optional but helpful
        suggest(); // Default naming
    }
});
