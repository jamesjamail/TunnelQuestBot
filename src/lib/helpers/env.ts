import { config } from '../../config';

//	Dynamic lookup for the `SERVERS_<NAME>_*` keys, whose names are built from
//	the Prisma Server enum at runtime and so cannot be read as static properties.
//
//	Reads through config() rather than process.env: every value here was already
//	validated at startup, so a miss means a server was added to the schema
//	without the config schema picking it up - a programming error, not a
//	configuration one. Going through config() is also what keeps this from
//	becoming a second, unvalidated way to read the environment.
export function getEnvironmentVariable(name: string): string {
	const value = config()[name];
	if (typeof value !== 'string' || value === '') {
		throw new Error(`Environment variable ${name} is not defined.`);
	}
	return value;
}
