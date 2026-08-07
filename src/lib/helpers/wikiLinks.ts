import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';

export function getWikiUrlFromItem(item: string) {
	const slug = consolidatedItemsAndAliases[item?.toUpperCase()];

	if (!slug) {
		return null;
	}

	return process.env.WIKI_BASE_URL + slug;
}
