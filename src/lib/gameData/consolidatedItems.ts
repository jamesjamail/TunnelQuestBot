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

export const consolidatedItemsAndAliases: InGameItemNamesType = {
	...fixApostrophes(inGameItemNamesRaw),
	...fixApostrophes(inGameSpellNamesRaw),
	...inGameAliasesRaw,
};

export const consolidatedItems: InGameItemNamesType = {
	...fixApostrophes(inGameItemNamesRaw),
	...fixApostrophes(inGameSpellNamesRaw),
};

export const consolidatedItemsList = Object.keys(consolidatedItems);
