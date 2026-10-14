import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../src/db/client.js';

const migrationFiles = (await readdir('migrations'))
  .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
  .sort();

for (const fileName of migrationFiles) {
  const sql = await readFile(path.join('migrations', fileName), 'utf8');

  await pool.query(sql);
  console.log(`Applied migration: ${fileName}`);
}

await pool.end();
