import { pool } from '../src/db/client.js';

const args = process.argv.slice(2);
const phone = readArg(args, '--phone')?.replace(/[\s-]/g, '').replace(/^\+?86/, '');
const name = readArg(args, '--name');
const role = readArg(args, '--role') || 'field_agent';

if (!phone || !/^1\d{10}$/.test(phone) || !name) {
  console.error('Usage: npm run staff:add -- --phone 13800138000 --name NAME [--role field_agent|reviewer|admin]');
  process.exitCode = 1;
} else if (!['field_agent', 'reviewer', 'admin'].includes(role)) {
  console.error('Invalid role. Use field_agent, reviewer, or admin.');
  process.exitCode = 1;
} else {
  await pool.query(
    `
      INSERT INTO staff_users (open_id, phone, name, role, active)
      VALUES (NULL, $1, $2, $3, true)
      ON CONFLICT (phone) WHERE phone IS NOT NULL DO UPDATE
      SET name = EXCLUDED.name, role = EXCLUDED.role, active = true, updated_at = now()
    `,
    [phone, name, role],
  );
  console.log(`Staff user saved: ${name} (${role})`);
}

await pool.end();

function readArg(args: string[], key: string) {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : undefined;
}
