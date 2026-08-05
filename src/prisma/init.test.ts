import { vi } from 'vitest';
vi.mock('../index', () => import('../test/mocks/discordClient'));
vi.mock('../lib/helpers/errors', () => ({
	gracefullyHandleError: vi.fn(async () => undefined),
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gracefullyHandleError } from '../lib/helpers/errors';

const mockConnect = vi.fn();

vi.mock('@prisma/client', () => ({
	PrismaClient: vi.fn().mockImplementation(function PrismaClientMock() {
		return { $connect: mockConnect };
	}),
}));

describe('initializePrisma', () => {
	beforeEach(() => {
		vi.resetModules();
		mockConnect.mockReset();
		vi.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		delete process.env.DATABASE_URL;
		vi.restoreAllMocks();
	});

	it('logs and skips when DATABASE_URL is missing', async () => {
		delete process.env.DATABASE_URL;
		const { initializePrisma } = await import('./init');
		await initializePrisma();
		expect(mockConnect).not.toHaveBeenCalled();
		expect(console.log).toHaveBeenCalled();
	});

	it('routes a rejected $connect through gracefullyHandleError', async () => {
		process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
		const error = new Error('connection refused');
		mockConnect.mockRejectedValue(error);

		const { initializePrisma } = await import('./init');
		await initializePrisma();

		expect(gracefullyHandleError).toHaveBeenCalledWith(error);
		expect(console.log).toHaveBeenCalled();
	});

	it('logs success when $connect resolves', async () => {
		process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
		mockConnect.mockResolvedValue(undefined);

		const { initializePrisma } = await import('./init');
		await initializePrisma();

		expect(mockConnect).toHaveBeenCalled();
		expect(console.log).toHaveBeenCalled();
		expect(gracefullyHandleError).not.toHaveBeenCalled();
	});

	it('exports prisma as a singleton across imports', async () => {
		const first = await import('./init');
		const second = await import('./init');
		expect(first.prisma).toBe(second.prisma);
	});
});
