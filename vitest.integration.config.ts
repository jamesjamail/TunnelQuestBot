import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.itest.ts'],
		setupFiles: ['./src/test/integration/setup.ts'],
		// Containers are started once per process and tables are truncated
		// between tests, so files must not run concurrently.
		fileParallelism: false,
		hookTimeout: 180_000,
		testTimeout: 30_000,
	},
});
