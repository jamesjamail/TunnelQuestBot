import { config } from '../../config';
import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';

export function getWikiUrlFromItem(item: string) {
	const slug = consolidatedItemsAndAliases[item?.toUpperCase()];

	if (!slug) {
		return null;
	}

	return config().WIKI_BASE_URL + slug;
}
