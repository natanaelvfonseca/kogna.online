import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var kognaPgPool: Pool | undefined;
}

export const pool =
  globalThis.kognaPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.kognaPgPool = pool;
}
