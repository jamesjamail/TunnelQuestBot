import { InGameItemNamesType } from '@src/lib/logParser/helpers';
import inGameItemNamesRaw from '@gameData/items.json';
import inGameSpellNamesRaw from '@gameData/spells.json';
import inGameAliasesRaw from '@gameData/aliases.json';

export const consolidatedItemsAndAliases: InGameItemNamesType = {
	...inGameItemNamesRaw,
	...inGameSpellNamesRaw,
	...inGameAliasesRaw,
};

export const consolidatedItems: InGameItemNamesType = {
	...inGameItemNamesRaw,
	...inGameSpellNamesRaw,
};

export const consolidatedItemsList = Object.keys(consolidatedItems);
