const Discord = require('discord.js');
const {parsePrice} = require('./utils');
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const aho_corasick = require('ahocorasick');

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
    // console.log(formatted_auction, item_data)
    let fields = [];
    Object.keys(formatted_items).forEach((item_name) => {
        const price = formatted_items[item_name].auction_price;
        const pricing_data = formatted_items[item_name].historical_pricing;
        // console.log(pricing_data)
        const url_with_hover = formatted_items[item_name].url.concat(" '" , pricing_data, "'");
        console.log(url_with_hover)
        const field = {
            name: `${price}`,
            value: `[${item_name}](${url_with_hover})`,
            inline: true
        }
        fields.push(field);
    })
    const embedded_auction = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setDescription(formatted_auction)
        .addFields(fields);
        
    return embedded_auction;
}




function formatPriceMessage(item_data) {
    // Append the historical pricing data, no padding strictly necessary
    // (though it might be nice to pad the 30/90 as columns also, in the future)
    let res = {};
    for (let item in item_data) {
        const history = item_data[item][1];
        const price_points = [];
        for (const interval in history) {
            price_points.push(`[*${interval}d*] ${history[interval]}`);
        }
        const formatted_price_points = price_points.join(" / ");
        const item_name = item.slice(28, item.length);
        // console.log(item);
        res[item_name] = {};
        res[item_name].auction_price = item_data[item][0] || 'No Price Listed'
        res[item_name].historical_pricing = formatted_price_points;
        res[item_name].url = item;
    }

    // console.log(res);
    return res;
    
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