import { afterEach, vi } from 'vitest';
import { resetConfigCache } from '../config';
import { applyTestEnvironment } from './env';
import { redis } from './mocks/redis';

applyTestEnvironment();

afterEach(() => {
	vi.clearAllMocks();
	redis.clear();
	//	config() memoises; tests that override an env var would otherwise leak
	//	that value into every later test in the file
	resetConfigCache();
});
