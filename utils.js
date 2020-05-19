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
        console.log(`Parsed price: "${price}" from "${parseText}"`);
        return Number(price);
    }
}

module.exports = {parsePrice};