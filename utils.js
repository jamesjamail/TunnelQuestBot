function parsePrice(text, start) {
    const parseText = text.slice(start);
    const numRegex = /^[^A-Z]*?([1-9]+\.?[0-9]*K?)P?/i;
    const digits = parseText.match(numRegex);
    if (digits && digits[1] !== undefined) {
        const priceText = digits[1].toUpperCase().split('K');
        let price;
        if (priceText.length > 1) {
            price = priceText[0] * 1000 + priceText[1];
        } else {
            price = priceText[0];
        }
        // console.log(`Parsed price: "${price}" from "${parseText}"`);
        return Number(price);
    }
}

// Thanks rici from StackOverflow for saving me time!
// Based on https://stackoverflow.com/a/30472781
function composeRanges(ranges) {
    let starts = ranges.map(function(r){return r.start}).sort(function(a, b){return a - b});
    let ends = ranges.map(function(r){return r.end}).sort(function(a, b){return a - b});
    let i = 0, j = 0, active = 0;
    const n = ranges.length, combined = [];
    while (true) {
        if (i < n && starts[i] < ends[j]) {
            if (active++ === 0) combined.push({start: starts[i]});
            ++i;
        } else if (j < n) {
            if (--active === 0) combined[combined.length - 1].end = ends[j];
            ++j;
        } else break;
    }
    return combined;
}

function _in(needle, haystack) {
    for (let element of haystack) {
        if (JSON.stringify(Object.entries(element).sort()) === JSON.stringify(Object.entries(needle).sort())) {
            return true;
        }
    }
    return false;
}

module.exports = {parsePrice, composeRanges, _in};