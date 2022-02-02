const Discord = require('discord.js');
const utils = require('./utils.js');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const aho_corasick = require('ahocorasick');
const $ = require('jquery');
const jsdom = require('jsdom');
const https = require('https');
const redis = require('redis');
const cache = redis.createClient();

const cache_expiration = 1 * 24 * 60 * 60 * 1000;
const BASE_WIKI_URL = 'https://wiki.project1999.com';
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
const SERVER_COLOR = { BLUE: '#1C58B8', GREEN: '#249458' };


cache.on('error', function(error) {
	console.error(error);
});

//2/1/22 - p99 wiki appears to have invalid cert - causing errors. Below is a temporary solution until they fix it upstream.
const httpsAgent = new https.Agent({
	rejectUnauthorized: false,
  });

async function fetchAndFormatAuctionData(auction_user, auction_contents, server) {
	const auction_wts = [...auction_contents.matchAll(WTS_REGEX)];
	const auction_wtb = [...auction_contents.matchAll(WTB_REGEX)];
	const auction_modes = [];
	if (auction_wtb.length > 0) { auction_modes.push('WTB'); }
	if (auction_wts.length > 0) { auction_modes.push('WTS'); }
	const auction_mode = auction_modes.join(' / ') || '---';

	// strip out backticks
	auction_contents = auction_contents.replace(/`/g, '');
	const item_data = await findWikiData(auction_contents, server);
	const formatted_items = formatItemData(item_data);
	const fields = [];
	// const date = new Date;
	Object.keys(formatted_items).forEach((item_name) => {
		const price = formatted_items[item_name].auction_price;
		const pricing_data = formatted_items[item_name].historical_pricing;
		const url_with_hover = `${formatted_items[item_name].url} '${pricing_data}'`;
		const field = {
			name: `${price}`,
			value: `[${item_name}](${url_with_hover})`,
			inline: true,
		};
		fields.push(field);
	});

	return new Discord.MessageEmbed()
		.setColor(SERVER_COLOR[server])
		.setTitle(`**[ ${auction_mode} ]**   ${auction_user}`)
		.setDescription(`\`\`\`${auction_contents}\`\`\``)
		.addFields(fields)
		.setFooter(`Project 1999 ${utils.formatCapitalCase(server)}`)
		.setTimestamp();
}

function formatItemData(item_data) {
	const formatted_items = {};
	for (const item in item_data) {
		const history = item_data[item][1];
		const price_points = [];
		for (const interval in history) {
			price_points.push(`${interval} day average: ${history[interval]}`);
		}
		const formatted_price_points = price_points.join('\n');
		// Get only the item name from the URL
		let item_name = item.split('/').pop();
		// HTML Decode the item name, and replace underscores with spaces
		item_name = unescape(item_name).replace(/_/g, ' ');
		formatted_items[item_name] = {
			auction_price: formatPrice(item_data[item][0]),
			historical_pricing: formatted_price_points,
			url: item,
		};
	}

	return formatted_items;
}

async function fetchWikiPricing(auction_contents, server) {
	const item_data = await findWikiData(auction_contents, server);
	if (Object.entries(item_data).length === 0) return null;

	const formatted_items = formatItemData(item_data);
	return formatted_items[Object.keys(formatted_items)[0]].historical_pricing;
}

function formatPrice(price) {
	// if price is undefined, return 'no price lsited'
	if (price === undefined) {
		return 'No Price Listed';
	}
	// if price is 1k or above, divide by 1000 and addend with 'k'
	if (price >= 1000) {
		return (price / 1000).toString().concat('k');
	}
	// if price is less thatn 1000, simply addend with 'pp'
	if (price < 1000) {
		return price.toString().concat('pp');
	}
}

function parsePage(page, server) {
	const $ = cheerio.load(page);
	const auc_data = $(`#auc_${server} .eoTable3 td`).contents();
	const price_data = {};
	if (auc_data !== undefined && auc_data[0] !== undefined) {
		price_data[30] = auc_data[0].data.trim();
	}
	if (auc_data !== undefined && auc_data[1] !== undefined) {
		price_data[90] = auc_data[1].data.trim();
	}
	return price_data;
}

async function getWikiPricing(item_url, server) {
	// Translate server name to "capitalized" form, eg: GREEN -> Green
	server = server[0] + server.slice(1).toLowerCase();

	// key for caching system is item_url underscore server
	const key = `${item_url}_${server}`;
	// check cache before fetching
	return new Promise((resolve, reject) => {
		cache.get(key, (err, cached_data) => {
			if (err) {
				reject(err);
			}
			// use cached data if available
			if (cached_data !== null) {
				resolve(JSON.parse(cached_data));
			}
			else {
				// otherwise fetch new data
				return fetch(item_url, {agent: httpsAgent})
					.then(response => response.text())
					.then(text => {
						const priceData = parsePage(text, server);
						// arrays aren't valid redis keys
						const priceDataStr = JSON.stringify(priceData);
						// store parsed data in cache as a string
						cache.setex(key, cache_expiration, priceDataStr, (err) => {
							if (err) console.error(err);
						});
						// return parsed data as array
						resolve(priceData);
					})
					.catch((err) => reject(err));
			}
		});
	});


}

async function findWikiData(auction_contents, server) {
	const ac = new aho_corasick(ALL_ITEM_KEYS);
	const results = ac.search(auction_contents.toUpperCase());

	let match_ranges = [];
	for (const i in results) {
		const item = results[i];
		match_ranges.push({ start: item[0] - item[1][0].length + 1, end: item[0] + 1 });
	}
	match_ranges = utils.composeRanges(match_ranges);

	const wiki_data = {};
	for (const i in results) {
		const item = results[i];
		const item_range = { start: item[0] - item[1][0].length + 1, end: item[0] + 1 };
		if (!utils._in(item_range, match_ranges)) continue;
		const item_name = item[1][0];

		let link;
		if (ITEMS.hasOwnProperty(item_name)) {
			link = BASE_WIKI_URL + ITEMS[item_name];
		}
		else if (SPELLS.hasOwnProperty(item_name)) {
			link = BASE_WIKI_URL + SPELLS[item_name];
		}
		else if (ALIASES.hasOwnProperty(item_name)) {
			link = BASE_WIKI_URL + ALIASES[item_name];
		}

		const historical_pricing = await getWikiPricing(link, server);
		const sale_price = utils.parsePrice(auction_contents, item[0] + 1);
		if (link) {
			wiki_data[link] = [sale_price, historical_pricing];
		}
	}
	const resolved_wiki_data = {};
	for (const name in wiki_data) {
		resolved_wiki_data[name] = [wiki_data[name][0], wiki_data[name][1]];
	}
	return resolved_wiki_data;
}

async function fetchImageUrl(itemName) {
	let url = '';
	if (ITEMS[itemName]) {
		await fetch(`https://wiki.project1999.com${ITEMS[itemName]}`, {agent:httpsAgent})
			.then((response) => {
				if (response.ok) {
					return response.text()
						.then((body) => {
							url = parseResponse(body);
						});
				}
				else {
					url = 'https://i.imgur.com/wXJsk7Y.png';
				}
			})
			.catch(console.error);
	}
	console.log('url = ', url)
	return url;
}

function parseResponse(html) {
	const { JSDOM } = jsdom;
	const dom = new JSDOM(html);
	const $ = (require('jquery'))(dom.window);
	const items = $('.itemicon');
	return 'https://wiki.project1999.com' + $(items[0]).children().children().attr('src');
}

exports.fetchAndFormatAuctionData = fetchAndFormatAuctionData;
exports.getWikiPricing = getWikiPricing;
exports.SERVER_COLOR = SERVER_COLOR;
exports.fetchImageUrl = fetchImageUrl;
exports.fetchWikiPricing = fetchWikiPricing;