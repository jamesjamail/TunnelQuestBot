import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
		setupFiles: ['./src/test/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/test/**',
				'src/**/*.test.ts',
				'src/**/*.itest.ts',
				'src/exampleLogs/**',
			],
			thresholds: {
				statements: 79,
				branches: 75,
				functions: 70,
				lines: 79,
			},
		},
	},
});
