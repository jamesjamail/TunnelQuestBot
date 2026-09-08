import { describe, expect, it } from 'vitest';
import {
	describeImportFailure,
	ImportFailure,
	ImportValidationError,
} from './import-diagnostics';

const secret =
	'postgresql://synthetic-account:synthetic-password@private-host/db';

describe('migration diagnostics', () => {
	it.each([
		['28P01', 'authentication failed'],
		['42501', 'insufficient permissions'],
		['42P01', 'source table is missing'],
		['42703', 'source column is missing'],
		['ECONNREFUSED', 'connection was refused'],
		['ENOTFOUND', 'hostname could not be resolved'],
		['ETIMEDOUT', 'connection timed out'],
		['57014', 'query was canceled or exceeded'],
		['SQLITE_CANTOPEN', 'file could not be opened'],
		['SQLITE_BUSY', 'database is busy'],
		['SQLITE_FULL', 'storage is full'],
		['SQLITE_CONSTRAINT_TRIGGER', 'constraint rejected an imported row'],
		['ERR_INVALID_URL', 'invalid database connection URL'],
	])('classifies %s without exposing driver details', (code, expected) => {
		const error = Object.assign(new Error(secret), {
			code,
			detail: 'private row data',
			query: 'private SQL',
			cause: new Error(secret),
		});
		const text = describeImportFailure(
			new ImportFailure(
				{ stage: 'copying table', table: 'Watch' },
				error,
			),
		);
		expect(text).toContain('copying table (Watch):');
		expect(text).toContain(expected);
		expect(text).not.toContain(secret);
		expect(text).not.toContain('private');
	});

	it.each([
		['Query read timeout', 'source query timed out'],
		['timeout expired', 'source connection timed out'],
		[
			'Connection terminated unexpectedly',
			'source connection terminated unexpectedly',
		],
		[
			'DATABASE_URL must be a local SQLite file URL',
			'DATABASE_URL must be a local SQLite file URL',
		],
	])('recognizes the uncoded error %s', (message, expected) => {
		expect(describeImportFailure(new Error(message))).toBe(expected);
	});

	it.each([
		'Refusing to import into a nonempty SQLite database',
		'Row-count verification failed for Watch',
		'Imported foreign keys are inconsistent',
		'Imported SQLite database failed its integrity check',
	])('preserves application validation: %s', (message) => {
		expect(
			describeImportFailure(
				new ImportFailure(
					{ stage: 'verifying database' },
					new ImportValidationError(message),
				),
			),
		).toBe(`verifying database: ${message}`);
	});

	it.each([
		new Error(secret),
		{ code: secret, message: secret },
		{ code: 'toString', message: 'constructor' },
		secret,
		null,
	])('does not print unknown errors: %#', (error) => {
		expect(describeImportFailure(error)).toBe(
			'unclassified database failure',
		);
	});
});
