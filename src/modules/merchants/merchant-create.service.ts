import { pool } from '../../db/client.js';
import { env } from '../../config/env.js';
import { AppError } from '../../plugins/error-handler.js';

export type CreateMerchantInput = {
  name?: string;
  contactName?: string;
  phone?: string;
  contacts?: Array<{ name?: string; phone?: string }>;
  merchantImageKeys?: string[];
  qualificationImageKeys?: string[];
  serviceCategory?: string;
  tags?: string[];
  address?: string;
  longitude?: number;
  latitude?: number;
  coordinateSystem?: string;
  businessHours?: string;
  note?: string;
  source?: string;
  force?: boolean;
};

type DuplicateMerchant = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  distance_meters: number | null;
};

export async function findDuplicateMerchants(input: CreateMerchantInput) {
  const normalized = validateMerchantInput(input, false);
  const point = 'ST_SetSRID(ST_MakePoint($4, $5), 4326)';
  const result = await pool.query<DuplicateMerchant>(
    `
      SELECT
        id,
        name,
        phone,
        address,
        CASE WHEN geo_point IS NULL THEN NULL
          ELSE round(ST_DistanceSphere(geo_point, ${point}))
        END AS distance_meters
      FROM merchants
      WHERE phone = $1
        OR (
          lower(name) = lower($2)
          AND geo_point IS NOT NULL
          AND ST_DWithin(geo_point::geography, ${point}::geography, $3)
        )
      ORDER BY CASE WHEN phone = $1 THEN 0 ELSE 1 END, created_at DESC
      LIMIT 5
    `,
    [normalized.phone, normalized.name, 50, normalized.longitude, normalized.latitude],
  );

  return result.rows.map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    phone: merchant.phone,
    address: merchant.address,
    distanceMeters: merchant.distance_meters === null ? null : Number(merchant.distance_meters),
  }));
}

export async function createMerchant(input: CreateMerchantInput, staffUserId: string) {
  const normalized = validateMerchantInput(input, true);
  const duplicates = await findDuplicateMerchants(input);

  if (duplicates.length > 0 && !input.force) {
    throw new AppError(409, 'MERCHANT_DUPLICATE', '发现手机号相同或附近同名的商家，请确认后再提交。');
  }

  const categoryResult = await pool.query<{ id: string }>(
    'SELECT id FROM service_categories WHERE code = $1 OR name = $1 LIMIT 1',
    [normalized.serviceCategory],
  );
  const category = categoryResult.rows[0];

  if (!category) {
    throw new AppError(400, 'INVALID_SERVICE_CATEGORY', '请选择有效的服务大类。');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query<{ id: string; created_at: Date }>(
      `
        INSERT INTO merchants (
          name, contact_name, phone, primary_category_id, tags, address,
          longitude, latitude, coordinate_system, business_hours, note,
          source, review_status, verified, created_by_staff_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'gcj02', $9, $10, $11, 'pending', false, $12)
        RETURNING id, created_at
      `,
      [
        normalized.name,
        normalized.contactName,
        normalized.phone,
        category.id,
        normalized.tags,
        normalized.address,
        normalized.longitude,
        normalized.latitude,
        normalized.businessHours,
        normalized.note,
        normalized.source,
        staffUserId,
      ],
    );

    const merchantId = result.rows[0].id;

    for (const [position, contact] of normalized.contacts.entries()) {
      await client.query(
        `
          INSERT INTO merchant_contacts (merchant_id, name, phone, is_primary, position)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [merchantId, contact.name, contact.phone, position === 0, position],
      );
    }

    for (const [position, key] of normalized.merchantImageKeys.entries()) {
      await client.query(
        `INSERT INTO merchant_media (merchant_id, media_type, storage_key, position)
         VALUES ($1, 'merchant', $2, $3)`,
        [merchantId, key, position],
      );
    }

    for (const [position, key] of normalized.qualificationImageKeys.entries()) {
      await client.query(
        `INSERT INTO merchant_media (merchant_id, media_type, storage_key, position)
         VALUES ($1, 'qualification', $2, $3)`,
        [merchantId, key, position],
      );
    }

    await client.query('COMMIT');

    return {
      id: merchantId,
      reviewStatus: 'pending' as const,
      createdAt: result.rows[0].created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (isUniqueViolation(error)) {
      throw new AppError(409, 'MERCHANT_DUPLICATE', '相同商家已存在，或上传图片已经被使用。');
    }

    throw error;
  } finally {
    client.release();
  }
}

function validateMerchantInput(input: CreateMerchantInput, requireImages: boolean) {
  const name = normalizeRequired(input.name, '请填写商家名称。', 160);
  const contacts = normalizeContacts(input.contacts, input.contactName, input.phone);
  const contactName = contacts[0].name;
  const phone = contacts[0].phone;
  const serviceCategory = normalizeRequired(input.serviceCategory, '请选择服务大类。', 80);
  const address = normalizeRequired(input.address, '请填写商家地址。', 500);

  if (!/^1\d{10}$/.test(phone)) {
    throw new AppError(400, 'INVALID_PHONE', '请填写正确的手机号。');
  }

  if (!isCoordinate(input.longitude, -180, 180) || !isCoordinate(input.latitude, -90, 90)) {
    throw new AppError(400, 'INVALID_LOCATION', '商家经纬度不正确。');
  }

  if (input.coordinateSystem && input.coordinateSystem !== 'gcj02') {
    throw new AppError(400, 'INVALID_COORDINATE_SYSTEM', '当前只支持微信 GCJ-02 坐标。');
  }

  const merchantImageKeys = normalizeImageKeys(input.merchantImageKeys, 5, 'merchant');
  const qualificationImageKeys = normalizeImageKeys(
    input.qualificationImageKeys,
    20,
    'qualification',
  );

  if (requireImages && merchantImageKeys.length < 1) {
    throw new AppError(400, 'MERCHANT_IMAGE_REQUIRED', '请至少上传一张商家图片。');
  }

  return {
    ...input,
    name,
    contactName,
    phone,
    contacts,
    merchantImageKeys,
    qualificationImageKeys,
    serviceCategory,
    address,
    longitude: input.longitude as number,
    latitude: input.latitude as number,
    tags: normalizeTags(input.tags),
    businessHours: normalizeOptional(input.businessHours, 120),
    note: normalizeOptional(input.note, 2000),
    source: normalizeOptional(input.source, 80) || 'field_staff',
  };
}

function normalizeContacts(
  contacts: CreateMerchantInput['contacts'],
  fallbackName: unknown,
  fallbackPhone: unknown,
) {
  const values = Array.isArray(contacts) && contacts.length > 0
    ? contacts
    : [{ name: fallbackName, phone: fallbackPhone }];

  if (values.length > 10) {
    throw new AppError(400, 'TOO_MANY_CONTACTS', '负责人最多可添加 10 位。');
  }

  return values.map((contact) => {
    const name = normalizeRequired(contact?.name, '请填写负责人姓名。', 80);
    const phone = normalizeRequired(contact?.phone, '请填写负责人电话。', 32);

    if (!/^1\d{10}$/.test(phone)) {
      throw new AppError(400, 'INVALID_PHONE', '请填写正确的负责人手机号。');
    }

    return { name, phone };
  });
}

function normalizeImageKeys(
  keys: unknown,
  maxItems: number,
  expectedType: 'merchant' | 'qualification',
) {
  if (!Array.isArray(keys)) return [];

  if (keys.length > maxItems) {
    throw new AppError(400, 'TOO_MANY_IMAGES', `图片最多可上传 ${maxItems} 张。`);
  }

  return keys.map((key) => {
    const normalized = String(key).trim();

    const legacyKey = /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(normalized);
    const escapedPrefix = env.OSS_UPLOAD_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ossKey = new RegExp(
      `^${escapedPrefix}/${expectedType}/\\d{4}/\\d{2}/[0-9a-f-]{36}\\.(jpg|png|webp)$`,
    ).test(normalized);

    if (!legacyKey && !ossKey) {
      throw new AppError(400, 'INVALID_IMAGE_KEY', '上传图片标识无效，请重新选择图片。');
    }

    return normalized;
  });
}

function normalizeRequired(value: unknown, message: string, maxLength: number) {
  const normalized = String(value ?? '').trim();

  if (!normalized || normalized.length > maxLength) {
    throw new AppError(400, 'INVALID_MERCHANT_DATA', message);
  }

  return normalized;
}

function normalizeOptional(value: unknown, maxLength: number) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeTags(tags: unknown) {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((tag) => tag.slice(0, 40));
}

function isCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}
