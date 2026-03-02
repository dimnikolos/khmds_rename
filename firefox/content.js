// Store the last sent code to avoid redundant messages
let lastAdamCode = null;

function findAndSendAdamCode() {
    // Only run this scan if we are NOT potentially on a search page list 
    // OR if we want to fallback. 
    // Issue: On scan page, this might find the FIRST code and set it.
    // However, the click listener will override it when user clicks.
    // So it's probably fine to let this run, but maybe restrict it?
    // If there are multiple .tableRefNo elements, ambiguous which one implies "page" code.
    // But usually single view page has one code.

    // Check if we are on a list view?
    const listRows = document.querySelectorAll('li.ui-dataview-row');
    if (listRows.length > 0) {
        // We are on a list page. Do NOT auto-set a global code based on the first item found via generic scan.
        // Unless we want to? No, better rely on click.
        return;
    }

    // Look for the label with the specific text
    // The structure observed:
    // <label ...>Μοναδικός Κωδικός - ΑΔΑΜ</label>

    // ... container boundary ...
    // <label ...>CODE</label>

    // Strategy: XPath text search
    const results = document.evaluate(
        "//label[contains(text(), 'Μοναδικός Κωδικός - ΑΔΑΜ')]",
        document,
        null,
        XPathResult.ALREADY_FIXED_ORDER_ITERATOR_TYPE,
        null
    );

    let label = results.iterateNext();

    if (label) {
        // Traverse up to the container cell
        let parentCell = label.closest('.ui-panelgrid-cell');
        if (parentCell) {
            // Find the next sibling cell
            let valueCell = parentCell.nextElementSibling;
            if (valueCell) {
                // Find the label inside
                // It might be a label or span
                let valueLabel = valueCell.querySelector('label, span, div.tableTxt');
                if (valueLabel) {
                    let code = valueLabel.textContent.trim();
                    if (code && code !== lastAdamCode) {
                        console.log('ADAM Code found:', code);
                        lastAdamCode = code;
                        chrome.runtime.sendMessage({
                            type: 'SET_ADAM_CODE',
                            code: code
                        });
                    }
                    return; // Found and handled
                }
            }
        }
    }

    // Fallback: Regex scan on body text if DOM structure changes
    // This is heavier but a good backup
    const text = document.body.innerText;
    const match = text.match(/Μοναδικός Κωδικός - ΑΔΑΜ\s+([A-Z0-9]+)/);
    if (match && match[1]) {
        const code = match[1];
        if (code !== lastAdamCode) {
            console.log('ADAM Code found (text match):', code);
            lastAdamCode = code;
            chrome.runtime.sendMessage({
                type: 'SET_ADAM_CODE',
                code: code
            });
        }
    }
}


console.log("Feature 2 initialized for cerpp");

// Existing logic for single page details
findAndSendAdamCode();

// Observe for AJAX updates (PrimeFaces) to handle pagination/filtering in search results
const observer = new MutationObserver((mutations) => {
    findAndSendAdamCode();
});
observer.observe(document.body, { childList: true, subtree: true });

// New logic for search page (list of results)
document.addEventListener('click', (event) => {
    // Check if clicked element looks like a download button/link
    // The button e.g. "Λήψη Αρχείου"
    const target = event.target;
    // button or link
    const button = target.closest('button, a');

    if (button && button.innerText.includes('Λήψη Αρχείου')) {
        // Traverse up to find the row container (li.ui-dataview-row)
        const row = button.closest('li.ui-dataview-row, tr.ui-widget-content');
        // Added tr.ui-widget-content just in case other table views use it

        if (row) {
            // Look for the ADAM code in this row
            // Based on analysis: .tableRefNo contains the code
            const codeEl = row.querySelector('.tableRefNo span, .tableRefNo, span[id*="REQ"], span[id*="SYMV"]');

            if (codeEl) {
                const code = codeEl.innerText.trim();
                if (code) {
                    console.log('Clicked download row. Found ADAM:', code);
                    // Send immediately to background to override any page-level code
                    chrome.runtime.sendMessage({
                        type: 'SET_ADAM_CODE',
                        code: code
                    });
                    // Update local lastAdamCode too so we don't accidentally overwrite it back 
                    // if the mutation observer runs right after
                    lastAdamCode = code;
                }
            }
        }
    }
}, true); // Use capture to run before page scripts if possible
