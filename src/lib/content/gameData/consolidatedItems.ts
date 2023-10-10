import { InGameItemNamesType } from '../../logParser/helpers';
import inGameItemNamesRaw from './items.json';
import inGameSpellNamesRaw from './spells.json';
import inGameAliasesRaw from './aliases.json';

export const consolidatedItems: InGameItemNamesType = {
	...inGameItemNamesRaw,
	...inGameSpellNamesRaw,
	...inGameAliasesRaw,
};
