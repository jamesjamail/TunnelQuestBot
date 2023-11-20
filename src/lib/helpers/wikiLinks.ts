import { consolidatedItems } from '../gameData/consolidatedItems';

export function getWikiUrlFromItem(item: string) {
	const slug = consolidatedItems[item?.toUpperCase()];

	if (!slug) {
		return null;
	}

	return process.env.WIKI_BASE_URL + slug;
}
