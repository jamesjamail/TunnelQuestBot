import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Host runs have no baked version. The release image always sets
// TUNNELQUESTBOT_VERSION, including the explicit "dev" used for CI builds.
export function localDevVersion(): string {
	const script = join(process.cwd(), 'scripts', 'dev-version.mjs');
	if (!existsSync(script)) return 'dev';
	try {
		const output = execFileSync(process.execPath, [script], {
			encoding: 'utf8',
			timeout: 5000,
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
		return output || 'dev';
	} catch {
		return 'dev';
	}
}

export function tunnelQuestVersion(baked: string | undefined): string {
	if (baked) return baked;
	return localDevVersion();
}
