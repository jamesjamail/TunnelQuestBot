import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { defineConfig } from 'prisma/config';

//	Prisma 7 no longer loads .env itself. Expansion is required because
//	DATABASE_URL is composed from POSTGRES_* and DB_SOCKET_DIR (see .env.example);
//	expand leaves already-set variables alone, so an explicit DATABASE_URL still wins.
expand(config());

export default defineConfig({
	schema: 'src/prisma/schema.prisma',
	migrations: {
		path: 'src/prisma/migrations',
	},
	datasource: {
		//	Read directly rather than via prisma/config's `env()`, which throws while
		//	loading this file when the variable is unset. `prisma generate` runs at
		//	image build time, where there is no database and no .env.
		url: process.env.DATABASE_URL,
	},
});
