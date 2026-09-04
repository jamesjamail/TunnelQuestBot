import Redis from 'ioredis';
import { color } from '../functions';
import { join } from 'path';

const REDIS_SOCKET = join(process.env.REDIS_SOCKET_DIR || '/tmp', 'redis.sock');

// 	Production connects over a unix socket from docker-compose. Integration
// 	tests point REDIS_URL at a TCP container instead.
const redis = process.env.REDIS_URL
	? new Redis(process.env.REDIS_URL)
	: new Redis(REDIS_SOCKET);

redis.on('connect', () => {
	console.log(
		color(
			'text',
			`🔥 Redis connection has been ${color('variable', 'established.')}`,
		),
	);
});

redis.on('error', (error) => {
	console.error(
		color(
			'text',
			`🔥 Redis connection ${color('error', 'failed.')} ${error.message}`,
		),
	);
});

export { redis };
