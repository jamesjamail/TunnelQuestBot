import { consolidatedItemsAndAliases } from '../gameData/consolidatedItems';

export function getImageUrlForItem(item: string) {
	const slug = consolidatedItemsAndAliases[item?.toUpperCase()];

	if (!slug) {
		return null;
	}

	return process.env.IMAGE_BUCKET_URL + slug + '.png';
}
