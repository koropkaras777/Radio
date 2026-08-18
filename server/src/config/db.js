import { createClient } from '@libsql/client';
import { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, isLocalDbUrl } from './env.js';

// ── Connection type detection ─────────────────────────────────────────────────
let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  if (!TURSO_DATABASE_URL) return null;

  const local = isLocalDbUrl(TURSO_DATABASE_URL);

  dbInstance = createClient(
    local ? { url: TURSO_DATABASE_URL } : { url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN }
  );

  console.log(`[DB] Connected: ${local ? 'local SQLite' : 'Turso (remote)'} - ${TURSO_DATABASE_URL}`);

  return dbInstance;
}

export async function testDbConnection() {
  const client = getDb();
  if (!client) return false;

  try {
    const result = await client.execute('SELECT 1 as ok');
    return Boolean(result?.rows?.[0]?.ok);
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    return false;
  }
}