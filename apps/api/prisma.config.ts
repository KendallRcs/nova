import { resolve } from 'node:path';

import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const apiDirectory = __dirname;
config({ path: resolve(apiDirectory, '../../.env') });
config({ path: resolve(apiDirectory, '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
