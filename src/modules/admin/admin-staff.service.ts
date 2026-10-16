import { pool } from '../../db/client.js';
import { AppError } from '../../plugins/error-handler.js';

type StaffRow = {
  id: string;
  name: string;
  phone: string | null;
  role: 'field_agent' | 'reviewer' | 'admin';
  active: boolean;
  open_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type StaffInput = {
  name?: string;
  phone?: string;
  active?: boolean;
};

export async function listAdminStaff() {
  const result = await pool.query<StaffRow>(
    `SELECT id, name, phone, role, active, open_id, created_at, updated_at
     FROM staff_users
     ORDER BY created_at DESC`,
  );
  return result.rows.map(mapStaff);
}

export async function createAdminStaff(input: StaffInput) {
  const name = normalizeName(input.name);
  const phone = normalizePhone(input.phone);

  try {
    const result = await pool.query<StaffRow>(
      `INSERT INTO staff_users (open_id, name, phone, role, active)
       VALUES (NULL, $1, $2, 'field_agent', true)
       RETURNING id, name, phone, role, active, open_id, created_at, updated_at`,
      [name, phone],
    );
    return mapStaff(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, 'STAFF_PHONE_EXISTS', '该手机号已在白名单中。');
    }
    throw error;
  }
}

export async function updateAdminStaff(id: string, input: StaffInput) {
  const name = input.name === undefined ? null : normalizeName(input.name);
  const phone = input.phone === undefined ? null : normalizePhone(input.phone);
  const active = typeof input.active === 'boolean' ? input.active : null;

  if (name === null && phone === null && active === null) {
    throw new AppError(400, 'STAFF_UPDATE_EMPTY', '没有需要更新的内容。');
  }

  try {
    const result = await pool.query<StaffRow>(
      `UPDATE staff_users
       SET name = COALESCE($2, name),
           phone = COALESCE($3, phone),
           active = COALESCE($4, active),
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, phone, role, active, open_id, created_at, updated_at`,
      [id, name, phone, active],
    );
    const staff = result.rows[0];
    if (!staff) throw new AppError(404, 'STAFF_NOT_FOUND', '未找到该地推人员。');

    if (active === false) {
      await pool.query(`DELETE FROM staff_sessions WHERE staff_user_id = $1`, [id]);
    }
    return mapStaff(staff);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, 'STAFF_PHONE_EXISTS', '该手机号已在白名单中。');
    }
    throw error;
  }
}

function normalizeName(value: unknown) {
  const name = String(value ?? '').trim();
  if (!name || name.length > 80) throw new AppError(400, 'INVALID_STAFF_NAME', '请输入正确的姓名。');
  return name;
}

function normalizePhone(value: unknown) {
  const phone = String(value ?? '').replace(/[\s-]/g, '').replace(/^\+?86/, '');
  if (!/^1\d{10}$/.test(phone)) throw new AppError(400, 'INVALID_STAFF_PHONE', '请输入正确的 11 位手机号。');
  return phone;
}

function mapStaff(row: StaffRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    role: row.role,
    active: row.active,
    bound: Boolean(row.open_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
