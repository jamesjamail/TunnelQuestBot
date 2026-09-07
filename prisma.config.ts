import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { defineConfig } from 'prisma/config';
import { prepareSqliteUrl } from './src/prisma/sqlite-url';

// Prisma 7 does not load .env itself. Expand user-defined references here;
//	expand leaves already-set variables alone, so an explicit DATABASE_URL still wins.
expand(config({ quiet: true }));

export default defineConfig({
	schema: 'src/prisma/schema.prisma',
	migrations: {
		path: 'src/prisma/migrations',
	},
	datasource: {
		//	Read directly rather than via prisma/config's `env()`, which throws while
		//	loading this file when the variable is unset. `prisma generate` runs at
		//	image build time, where there is no database and no .env.
		url: prepareSqliteUrl(
			process.env.DATABASE_URL ?? 'file:./data/tunnelquestbot.db',
		),
	},
});
