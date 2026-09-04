import type { InGameItemNamesType } from '../playerLink/playerLink';
import inGameItemNamesRaw from './items.json';
import inGameSpellNamesRaw from './spells.json';
import inGameAliasesRaw from './aliases.json';

function fixApostrophes(items: InGameItemNamesType) {
	const duped_items: InGameItemNamesType = {};
	for (const item of Object.entries(items)) {
		const item_name = item[0];
		const item_link = item[1];
		if (item_name.indexOf('`') > 0) {
			duped_items[item_name.replaceAll('`', '')] = item_link;
			duped_items[item_name.replaceAll('`', "'")] = item_link;
		} else if (item_name.indexOf("'") > 0) {
			duped_items[item_name.replaceAll("'", '')] = item_link;
			duped_items[item_name.replaceAll("'", '`')] = item_link;
		}
	}
	return { ...items, ...duped_items };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function addSpellPrefix(spells: InGameItemNamesType) {
	const spell_items: InGameItemNamesType = {};
	for (const spell of Object.entries(spells)) {
		spell_items[`SPELL: ${spell[0]}`] = spell[1];
	}
	return spell_items;
}

export const spells: InGameItemNamesType = {
	...fixApostrophes(inGameSpellNamesRaw),
};

export const items: InGameItemNamesType = {
	...fixApostrophes(inGameItemNamesRaw),
};

export const consolidatedItems: InGameItemNamesType = {
	...items,
	...spells,
};

export const consolidatedItemsAndAliases: InGameItemNamesType = {
	...consolidatedItems,
	...inGameAliasesRaw,
};

// Wiki path -> canonical item name (first canonical wins; apostrophe-variant
// duplicates created by fixApostrophes share the path and must not overwrite it)
const canonicalNameByWikiPath: Record<string, string> = {};
for (const [name, wikiPath] of Object.entries(consolidatedItems)) {
	if (!canonicalNameByWikiPath[wikiPath]) {
		canonicalNameByWikiPath[wikiPath] = name;
	}
}

// Resolves aliases (e.g. FBSS) to the canonical item name watches are usually
// keyed by. Identity for canonical names and for strings we know nothing about.
export function resolveCanonicalItemName(itemName: string): string {
	const upper = itemName.toUpperCase();
	if (consolidatedItems[upper]) {
		return upper;
	}
	const aliases: Record<string, string> = inGameAliasesRaw;
	const aliasWikiPath = aliases[upper];
	if (aliasWikiPath && canonicalNameByWikiPath[aliasWikiPath]) {
		return canonicalNameByWikiPath[aliasWikiPath];
	}
	return upper;
}
