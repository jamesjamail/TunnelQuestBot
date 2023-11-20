import { InGameItemNamesType } from '../playerLink/playerLink';
import inGameItemNamesRaw from './items.json';
import inGameSpellNamesRaw from './spells.json';
import inGameAliasesRaw from './aliases.json';

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
