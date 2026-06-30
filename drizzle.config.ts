import { defineConfig } from 'drizzle-kit';

// drizzle-kit (unlike Next.js) does not auto-load .env files, so load them here to make
// DATABASE_URL available to generate/migrate/push. An explicit shell value wins;
// otherwise prefer .env.local, then .env. (process.loadEnvFile is Node >= 20.12.)
const loadEnvFile = (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile;
if (loadEnvFile && !process.env.DATABASE_URL) {
  for (const envFile of ['.env.local', '.env']) {
    try {
      loadEnvFile(envFile);
      if (process.env.DATABASE_URL) break;
    } catch {
      // File not present — try the next candidate.
    }
  }
}

export default defineConfig({
  out: './drizzle',
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
