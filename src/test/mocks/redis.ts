import { vi } from 'vitest';

type Entry = { value: string; expiresAt?: number };
const store = new Map<string, Entry>();

function isLive(e: Entry | undefined): e is Entry {
	if (!e) return false;
	if (e.expiresAt !== undefined && Date.now() >= e.expiresAt) return false;
	return true;
}

export const redis = {
	clear: () => store.clear(),
	get: vi.fn(async (key: string) =>
		isLive(store.get(key)) ? store.get(key)!.value : null,
	),
	set: vi.fn(
		async (key: string, value: string, ...args: (string | number)[]) => {
			const upper = args.map((a) => String(a).toUpperCase());
			const nx = upper.includes('NX');
			const exIdx = upper.indexOf('EX');
			const ttl = exIdx >= 0 ? Number(args[exIdx + 1]) : undefined;
			if (nx && isLive(store.get(key))) return null;
			store.set(key, {
				value,
				expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
			});
			return 'OK';
		},
	),
	setnx: vi.fn(async (key: string, value: string) => {
		if (isLive(store.get(key))) return 0;
		store.set(key, { value });
		return 1;
	}),
	exists: vi.fn(async (key: string) => (isLive(store.get(key)) ? 1 : 0)),
	expire: vi.fn(async (key: string, seconds: number) => {
		const e = store.get(key);
		if (!isLive(e)) return 0;
		e.expiresAt = Date.now() + seconds * 1000;
		return 1;
	}),
	del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
};
