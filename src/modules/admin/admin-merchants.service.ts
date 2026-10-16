import { pool } from '../../db/client.js';
import { AppError } from '../../plugins/error-handler.js';

export type MerchantStatus = 'pending' | 'approved' | 'rejected';

export async function getAdminOverview() {
  const result = await pool.query<{ status: MerchantStatus; count: string }>(
    `SELECT review_status AS status, count(*)::text AS count FROM merchants GROUP BY review_status`,
  );
  const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const row of result.rows) {
    const count = Number(row.count);
    stats[row.status] = count;
    stats.total += count;
  }
  return stats;
}

export async function listAdminMerchants(input: {
  page?: string; pageSize?: string; status?: string; keyword?: string;
}) {
  const page = Math.max(1, Number.parseInt(input.page || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(input.pageSize || '10', 10) || 10));
  const status = isStatus(input.status) ? input.status : null;
  const keyword = String(input.keyword || '').trim();
  const values: unknown[] = [];
  const where: string[] = [];

  if (status) {
    values.push(status);
    where.push(`m.review_status = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    where.push(`(m.name ILIKE $${values.length} OR m.phone ILIKE $${values.length} OR m.address ILIKE $${values.length} OR su.name ILIKE $${values.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM merchants m LEFT JOIN staff_users su ON su.id = m.created_by_staff_id ${whereSql}`,
    values,
  );
  values.push(pageSize, (page - 1) * pageSize);
  const result = await pool.query(
    `SELECT m.id, m.name, m.contact_name, m.phone, m.address, m.review_status,
      m.verified, m.created_at, sc.name AS category_name, su.name AS staff_name,
      (SELECT mm.storage_key FROM merchant_media mm WHERE mm.merchant_id = m.id AND mm.media_type = 'merchant' ORDER BY mm.position LIMIT 1) AS cover_key
     FROM merchants m
     LEFT JOIN service_categories sc ON sc.id = m.primary_category_id
     LEFT JOIN staff_users su ON su.id = m.created_by_staff_id
     ${whereSql}
     ORDER BY m.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return {
    items: result.rows.map((row: any) => ({
      id: row.id, name: row.name, contactName: row.contact_name, phone: row.phone,
      address: row.address, reviewStatus: row.review_status, verified: row.verified,
      createdAt: row.created_at, categoryName: row.category_name, staffName: row.staff_name,
      coverUrl: row.cover_key ? `/api/v1/uploads/${row.cover_key}` : null,
    })),
    pagination: { page, pageSize, total: Number(countResult.rows[0]?.count || 0) },
  };
}

export async function reviewMerchant(id: string, status: unknown) {
  if (!isStatus(status) || status === 'pending') {
    throw new AppError(400, 'INVALID_REVIEW_STATUS', '请选择通过或驳回。');
  }
  const result = await pool.query(
    `UPDATE merchants SET review_status = $2, verified = $3, updated_at = now()
     WHERE id = $1 RETURNING id, review_status, verified, updated_at`,
    [id, status, status === 'approved'],
  );
  if (!result.rows[0]) throw new AppError(404, 'MERCHANT_NOT_FOUND', '没有找到这个商户。');
  return result.rows[0];
}

function isStatus(value: unknown): value is MerchantStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}
