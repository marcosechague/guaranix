import postgres from 'postgres';
import { readDatabaseUrl } from '../src/database-url.ts';

const sql = postgres(readDatabaseUrl(process.env), { max: 1 });

try {
  const [row] = await sql<{ version: string }[]>`select version()`;
  console.log(`Database reachable: ${row?.version ?? 'unknown version'}`);
} finally {
  await sql.end();
}
