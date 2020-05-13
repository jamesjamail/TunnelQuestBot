const fetch = require("node-fetch");
const cheerio = require("cheerio");
const aho_corasick = require('ahocorasick');

const BASE_WIKI_URL = 'http://wiki.project1999.com';
const AUC_REGEX = /^\[.*?\] (\w+) auctions, '(wtb|wts) ?(.*)'$/i;
const ITEMS = require('./data/items.json');
const SPELLS = require('./data/spells.json');
const ALIASES = require('./data/aliases.json');
const ALL_ITEM_KEYS = new Set([
    ...Object.keys(ITEMS),
    ...Object.keys(SPELLS),
    ...Object.keys(ALIASES),
]);

async function fetchAndFormatAuctionData(auction_text, server) {
    const found = auction_text.match(AUC_REGEX);
    let auction_user = found[1];
    let auction_mode = found[2].toUpperCase();
    let auction_contents = found[3];
    // TODO: also figure out price -- use a placeholder for now
    let price = 20;

    let item_data = await findWikiData(auction_contents, server);

    let formatted_auction = `[**${auction_user}**] is auctioning:\n**${auction_mode}**: ${auction_contents}`;
    for (let item in item_data) {
        formatted_auction += '\n' + formatPriceMessage(item, price, item_data[item]);
    }
    return formatted_auction;
}

function formatPriceMessage(item, price, data) {
    let price_points = [];
    for (let interval in data) {
        price_points.push(`[*${interval}d*] ${data[interval]}`);
    }
    // TODO: price data isn't implemented correctly yet, so don't show it
    // return `${item} **${price}**pp ${price_points.join(" / ")}`;
    return `${item} ${price_points.join(" / ")}`;
}

async function getWikiPricing(item_url, server) {
    // Translate server name to "capitalized" form, eg: GREEN -> Green
    server = server[0] + server.slice(1).toLowerCase();

    return fetch(item_url)
        .then(response => response.text())
        .then(text => {
                const $ = cheerio.load(text);
                const auc_data = $("#auc_" + server).find(".eoTable3").find("td");
                const avg30d = auc_data[0].children[0].data.trim();
                const avg90d = auc_data[1].children[0].data.trim();
                return {30: avg30d, 90: avg90d}
            });
}

async function findWikiData(auction_contents, server) {
    let ac = new aho_corasick(ALL_ITEM_KEYS);
    let results = ac.search(auction_contents);

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

        let pricing = getWikiPricing(link, server);
        if (link) {
            wiki_data[link] = pricing; }
    }
    let resolved_wiki_data = {};
    for (let name in wiki_data) {
        resolved_wiki_data[name] = await wiki_data[name];
    }
    return resolved_wiki_data;
}

module.exports = {fetchAndFormatAuctionData};