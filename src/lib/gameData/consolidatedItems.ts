import { InGameItemNamesType } from '../playerLink/playerLink';
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
