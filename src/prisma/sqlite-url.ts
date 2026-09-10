import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/** Resolve file paths identically for the Prisma CLI and the runtime adapter. */
export function resolveSqliteUrl(value: string): string {
	if (!value.startsWith('file:') || /[?#\0]/.test(value)) {
		throw new Error('DATABASE_URL must be a local SQLite file URL');
	}
	const path = value.startsWith('file://')
		? fileURLToPath(value)
		: value.slice(5);
	if (!path.trim() || path === ':memory:') {
		throw new Error('DATABASE_URL must name a persistent SQLite file');
	}
	return `file:${resolve(path)}`;
}

/** Create the parent directory before migrations or the first connection. */
export function prepareSqliteUrl(value: string): string {
	const url = resolveSqliteUrl(value);
	mkdirSync(dirname(url.slice(5)), { recursive: true });
	return url;
}
