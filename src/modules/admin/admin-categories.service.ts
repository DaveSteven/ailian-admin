import { randomUUID } from 'node:crypto';
import { pool } from '../../db/client.js';
import { AppError } from '../../plugins/error-handler.js';

type CategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: Date;
  merchant_count: string;
};

export async function listAdminCategories() {
  const result = await pool.query<CategoryRow>(
    `SELECT sc.id, sc.code, sc.name, sc.description, sc.created_at,
      count(m.id)::text AS merchant_count
     FROM service_categories sc
     LEFT JOIN merchants m ON m.primary_category_id = sc.id
     GROUP BY sc.id
     ORDER BY sc.created_at ASC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    merchantCount: Number(row.merchant_count),
  }));
}

export async function createAdminCategory(input: { name?: unknown; description?: unknown }) {
  const { name, description } = validateCategoryInput(input);

  const duplicate = await pool.query('SELECT 1 FROM service_categories WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (duplicate.rows[0]) throw new AppError(409, 'CATEGORY_DUPLICATE', '该分类已经存在。');

  const code = `custom-${randomUUID()}`;
  const result = await pool.query<CategoryRow>(
    `INSERT INTO service_categories (code, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, code, name, description, created_at, '0'::text AS merchant_count`,
    [code, name, description || null],
  );
  const row = result.rows[0];
  return {
    id: row.id, code: row.code, name: row.name, description: row.description,
    createdAt: row.created_at, merchantCount: 0,
  };
}

export async function updateAdminCategory(id: string, input: { name?: unknown; description?: unknown }) {
  const { name, description } = validateCategoryInput(input);
  const duplicate = await pool.query(
    'SELECT 1 FROM service_categories WHERE lower(name) = lower($1) AND id <> $2 LIMIT 1',
    [name, id],
  );
  if (duplicate.rows[0]) throw new AppError(409, 'CATEGORY_DUPLICATE', '该分类已经存在。');

  const result = await pool.query<CategoryRow>(
    `UPDATE service_categories
     SET name = $2, description = $3, updated_at = now()
     WHERE id = $1
     RETURNING id, code, name, description, created_at,
       (SELECT count(*)::text FROM merchants WHERE primary_category_id = $1) AS merchant_count`,
    [id, name, description || null],
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, 'CATEGORY_NOT_FOUND', '没有找到这个分类。');
  return {
    id: row.id, code: row.code, name: row.name, description: row.description,
    createdAt: row.created_at, merchantCount: Number(row.merchant_count),
  };
}

function validateCategoryInput(input: { name?: unknown; description?: unknown }) {
  const name = String(input.name ?? '').trim();
  const description = String(input.description ?? '').trim();
  if (!name) throw new AppError(400, 'CATEGORY_NAME_REQUIRED', '请填写分类名称。');
  if (name.length > 80) throw new AppError(400, 'CATEGORY_NAME_TOO_LONG', '分类名称不能超过 80 个字。');
  if (description.length > 500) throw new AppError(400, 'CATEGORY_DESCRIPTION_TOO_LONG', '分类说明不能超过 500 个字。');
  return { name, description };
}
