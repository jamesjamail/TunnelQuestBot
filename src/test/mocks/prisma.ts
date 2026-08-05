import { vi } from 'vitest';

const model = () => ({
	findMany: vi.fn(async () => []),
	findUnique: vi.fn(async () => null),
	findFirst: vi.fn(async () => null),
	findFirstOrThrow: vi.fn(async () => ({})),
	create: vi.fn(async (a: unknown) => a),
	update: vi.fn(async (a: unknown) => a),
	updateMany: vi.fn(async () => ({ count: 0 })),
	upsert: vi.fn(async (a: unknown) => a),
	delete: vi.fn(async () => ({})),
	deleteMany: vi.fn(async () => ({ count: 0 })),
});

export const prisma = {
	user: model(),
	watch: model(),
	blockedPlayer: model(),
	blockedPlayerByWatch: model(),
	playerLink: model(),
	$connect: vi.fn(async () => undefined),
};

export const initializePrisma = vi.fn(async () => undefined);
