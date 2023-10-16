/* eslint-disable no-console */
import Redis from 'ioredis';
import { color } from '../functions';

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

const redis = new Redis({
	host: REDIS_HOST,
	port: REDIS_PORT,
});

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
