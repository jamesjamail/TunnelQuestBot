import { consolidatedItems } from '@gameData/consolidatedItems';

export function getImageUrlForItem(item: string) {
	const slug = consolidatedItems[item?.toUpperCase()];

	if (!slug) {
		return null;
	}

	return process.env.IMAGE_BUCKET_URL + slug + '.png';
}
