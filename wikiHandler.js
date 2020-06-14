const {parsePrice} = require('./utils');
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const aho_corasick = require('ahocorasick');
const {createCanvas} = require('canvas')

const BASE_WIKI_URL = 'http://wiki.project1999.com';
const WTS_REGEX = /WTS(.*?)(?=WTB|$)/gi;
const WTB_REGEX = /WTB(.*?)(?=WTS|$)/gi;
const ITEMS = require('./data/items.json');
const SPELLS = require('./data/spells.json');
const ALIASES = require('./data/aliases.json');
const ALL_ITEM_KEYS = new Set([
    ...Object.keys(ITEMS),
    ...Object.keys(SPELLS),
    ...Object.keys(ALIASES),
]);
// Set up a fake context to measure text size with Discord's font
const CANVAS = createCanvas(200, 200);
const CONTEXT = CANVAS.getContext("2d"); CONTEXT.font = "10pt whitney";

async function fetchAndFormatAuctionData(auction_user, auction_contents, server) {
    const auction_wts = [...auction_contents.matchAll(WTS_REGEX)];
    const auction_wtb = [...auction_contents.matchAll(WTB_REGEX)];
    const auction_modes = [];
    if (auction_wtb.length > 0) { auction_modes.push("WTB") }
    if (auction_wts.length > 0) { auction_modes.push("WTS") }
    const auction_mode = auction_modes.join(" / ") || "???";

    // strip out backticks
    auction_contents = auction_contents.replace(/`/g, '');
    let formatted_auction = `[**${auction_user}**] **${auction_mode}**:\n\`${auction_contents}\``;
    const item_data = await findWikiData(auction_contents, server);
    const formatted_items = formatPriceMessage(item_data);
    return formatted_auction + formatted_items;
}

function formatPriceMessage(item_data) {
    if (Object.keys(item_data).length === 0) { return ""; }
    const formatted_items = new Map();
    // Start by getting the length of the longest item
    const longest_item = Object.keys(item_data).reduce(
        function (a, b) {
            let a_size = CONTEXT.measureText(a.replace("<", "").replace(">", "") + " ").width;
            let b_size = CONTEXT.measureText(b.replace("<", "").replace(">", "") + " ").width;
            return a_size > b_size ? a : b; });
    const longest_item_size = CONTEXT.measureText(longest_item).width;
    // Pad all of the item links
    for (let item in item_data) {
        const pixel_diff = longest_item_size - CONTEXT.measureText(item).width + 6;
        formatted_items[item] = `<${item}>` + "".padEnd(pixel_diff, "\u200A");
    }
    // Next get the longest price string
    let longest_price = Object.values(item_data).reduce(
        function (a, b) {
            const a_str = (a[0] || "") + "";
            const b_str = (b[0] || "") + "";
            return CONTEXT.measureText(a_str).width > CONTEXT.measureText(b_str).width ? [a_str] : [b_str];
        })[0];
    if (longest_price !== "") { longest_price = `${longest_price}pp`; }
    const longest_price_size = CONTEXT.measureText(longest_price).width + 3;
    // Pad out a string for the price
    for (let item in item_data) {
        let price = (item_data[item][0] || "") + "";
        if (price !== "") { price = `${price}pp`; }
        const pixel_diff = longest_price_size - CONTEXT.measureText(price).width + 6;
        if (price !== "") { price = `**${price}**`; }
        formatted_items[item] += price + "".padEnd(pixel_diff, "\u200A");
    }
    // Finally append the historical pricing data, no padding strictly necessary
    // (though it might be nice to pad the 30/90 as columns also, in the future)
    for (let item in item_data) {
        const history = item_data[item][1];
        const price_points = [];
        for (const interval in history) {
            price_points.push(`[*${interval}d*] ${history[interval]}`);
        }
        formatted_items[item] += price_points.join(" / ");
    }
    // Prepare all the formatted item strings for the auction text
    let combined_strings = "";
    for (let item in formatted_items) {
        combined_strings += '\n' + formatted_items[item];
    }
    return combined_strings
}

async function getWikiPricing(item_url, server) {
    // Translate server name to "capitalized" form, eg: GREEN -> Green
    server = server[0] + server.slice(1).toLowerCase();

    return fetch(item_url)
        .then(response => response.text())
        .then(text => {
            const $ = cheerio.load(text);
            const auc_data = $(`#auc_${server} .eoTable3 td`).contents();
            let price_data = {};
            if (auc_data !== undefined && auc_data[0] !== undefined) {
                price_data[30] = auc_data[0].data.trim();
            }
            if (auc_data !== undefined && auc_data[1] !== undefined) {
                price_data[90] = auc_data[1].data.trim();
            }
            return price_data;
        }).catch(console.error)
}

async function findWikiData(auction_contents, server) {
    let ac = new aho_corasick(ALL_ITEM_KEYS);
    const results = ac.search(auction_contents);

    let wiki_data = {};
    for (let i in results) {
        const item = results[i];
        const item_name = item[1][0];

        let link;
        if (ITEMS.hasOwnProperty(item_name)) {
            link = BASE_WIKI_URL + ITEMS[item_name]; }
        else if (SPELLS.hasOwnProperty(item_name)) {
            link = BASE_WIKI_URL + SPELLS[item_name]; }
        else if (ALIASES.hasOwnProperty(item_name)) {
            link = BASE_WIKI_URL + ALIASES[item_name]; }

        let historical_pricing = getWikiPricing(link, server);
        let sale_price = parsePrice(auction_contents, item[0]+1);
        if (link) {
            wiki_data[link] = [sale_price, historical_pricing]; }
    }
    let resolved_wiki_data = {};
    for (let name in wiki_data) {
        resolved_wiki_data[name] = [wiki_data[name][0], await wiki_data[name][1]];
    }
    return resolved_wiki_data;
}

module.exports = {fetchAndFormatAuctionData};