import { redis } from '../../redis/init';

// Example: Set and get a value from Redis
export async function testRedis() {
	await redis.set('key', 'value');
	// const value = await redis.get('key');
	// console.log(`Got value from Redis: ${value}`);
}
