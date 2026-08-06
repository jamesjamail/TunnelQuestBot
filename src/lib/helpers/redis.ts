import { redis } from '../../redis/init';
import { client } from '../..';

export function generatePlayerLinkKey(playerId: string) {
	return `playerLinkName:${playerId}`;
}

export async function getCachedPlayerDiscordName(playerId: string) {
	const key = generatePlayerLinkKey(playerId);

	let userName = await redis.get(key);
	if (!userName) {
		const user = await client.users.fetch(playerId);
		const set = await redis.set(key, user.username, 'EX', 7 * 24 * 60 * 60);
		if (set === 'OK') {
			userName = user.username;
		}
	}
	return userName;
}
