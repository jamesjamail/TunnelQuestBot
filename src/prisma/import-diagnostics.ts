/** Validation messages contain only application-owned text and table names. */
export class ImportValidationError extends Error {}

export type ImportContext = {
	stage:
		| 'validating configuration'
		| 'opening SQLite'
		| 'checking destination'
		| 'connecting to PostgreSQL'
		| 'starting source snapshot'
		| 'copying table'
		| 'verifying table'
		| 'verifying database'
		| 'committing import';
	table?: string;
};

const SAFE_CODES = new Map(
	Object.entries({
		'28P01': 'PostgreSQL authentication failed',
		'28000': 'PostgreSQL authorization failed',
		'3D000': 'source database does not exist',
		'42501': 'source role has insufficient permissions',
		'42P01': 'source table is missing; check the source schema version',
		'42703': 'source column is missing; check the source schema version',
		'57014': 'source query was canceled or exceeded its time limit',
		ECONNREFUSED: 'source connection was refused',
		ECONNRESET: 'source connection was reset',
		ENOTFOUND: 'source hostname could not be resolved',
		EAI_AGAIN: 'source hostname resolution temporarily failed',
		ETIMEDOUT: 'source connection timed out',
		ENOENT: 'database file, directory or socket was not found',
		EACCES: 'database file or directory permission denied',
		ERR_INVALID_URL: 'invalid database connection URL',
		ERR_INVALID_FILE_URL_HOST: 'SQLite URL must refer to a local file',
		ERR_INVALID_FILE_URL_PATH: 'invalid SQLite file URL path',
		SQLITE_CANTOPEN: 'SQLite file could not be opened',
		SQLITE_READONLY: 'SQLite database is read-only',
		SQLITE_BUSY: 'SQLite database is busy',
		SQLITE_LOCKED: 'SQLite database is locked',
		SQLITE_FULL: 'SQLite storage is full',
		SQLITE_IOERR: 'SQLite storage I/O failed',
		SQLITE_CORRUPT: 'SQLite database is corrupt',
		SQLITE_NOTADB: 'destination is not a SQLite database',
		SQLITE_CONSTRAINT: 'destination constraint rejected an imported row',
	}),
);

// pg emits these without a code. Match exact strings, never interpolate them.
const SAFE_MESSAGES = new Map(
	Object.entries({
		'Query read timeout': 'source query timed out',
		'timeout expired': 'source connection timed out',
		'Connection terminated': 'source connection terminated',
		'Connection terminated unexpectedly':
			'source connection terminated unexpectedly',
		'DATABASE_URL must be a local SQLite file URL':
			'DATABASE_URL must be a local SQLite file URL',
		'DATABASE_URL must name a persistent SQLite file':
			'DATABASE_URL must name a persistent SQLite file',
	}),
);

/** Classify driver failures without exposing URLs, SQL, row values or stacks. */
function safeCause(error: unknown): string {
	if (error instanceof ImportValidationError) return error.message;
	if (typeof error !== 'object' || error === null)
		return 'unclassified database failure';
	if ('code' in error && typeof error.code === 'string') {
		const code = error.code;
		if (SAFE_CODES.has(code)) return `${SAFE_CODES.get(code)} (${code})`;
		// SQLite extended result codes share their primary error category.
		const primary = code.split('_').slice(0, 2).join('_');
		if (SAFE_CODES.has(primary))
			return `${SAFE_CODES.get(primary)} (${primary})`;
	}
	if (
		'message' in error &&
		typeof error.message === 'string' &&
		SAFE_MESSAGES.has(error.message)
	) {
		return SAFE_MESSAGES.get(error.message)!;
	}
	return 'unclassified database failure';
}

/** Capture the failed operation using only controlled diagnostic text. */
export class ImportFailure extends Error {
	constructor(context: ImportContext, error: unknown) {
		super(
			`${context.stage}${context.table ? ` (${context.table})` : ''}: ${safeCause(error)}`,
		);
	}
}

/** Only our sanitized wrapper may supply a message to the CLI logger. */
export function describeImportFailure(error: unknown): string {
	return error instanceof ImportFailure ? error.message : safeCause(error);
}
