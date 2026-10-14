import type { ServiceCategory, ServiceIntent } from '../ai/intent.service.js';
import { pool } from '../../db/client.js';
import type { Merchant } from '../merchants/merchant.types.js';

export type RankedMerchant = Merchant & {
  matchScore: number;
  serviceId?: string;
  serviceName?: string;
};

export type SearchMerchantsInput = {
  serviceCategory?: ServiceCategory | string;
  keyword?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
};

type SearchRow = {
  id: string;
  service_id: string | null;
  service_name: string | null;
  name: string;
  category: ServiceCategory | null;
  tags: string[] | null;
  rating: string | null;
  distance_km: string | null;
  service_radius_km: string;
  price_description: string | null;
  min_price: number | null;
  max_price: number | null;
  average_response_time: string | null;
  phone: string;
  verified: boolean;
  available_now: boolean;
  match_score: number;
};

export async function searchMerchants(intent: ServiceIntent): Promise<RankedMerchant[]> {
  if (intent.serviceCategory === 'unknown') {
    return [];
  }

  return searchMerchantDatabase({
    serviceCategory: intent.serviceCategory,
    keyword: intent.keywords[0],
    limit: 5,
  });
}

export async function searchMerchantDatabase(input: SearchMerchantsInput): Promise<RankedMerchant[]> {
  const query = buildSearchQuery(input);
  const result = await pool.query<SearchRow>(query.text, query.values);

  return result.rows.map(mapSearchRow);
}

function buildSearchQuery(input: SearchMerchantsInput) {
  const values: Array<string | number> = [];
  const where: string[] = ["m.review_status = 'approved'"];
  const hasLocation = isFiniteNumber(input.latitude) && isFiniteNumber(input.longitude);

  let distanceExpression = 'NULL::double precision';

  if (hasLocation) {
    const longitudeIndex = pushValue(values, input.longitude as number);
    const latitudeIndex = pushValue(values, input.latitude as number);
    const pointExpression = `ST_SetSRID(ST_MakePoint($${longitudeIndex}, $${latitudeIndex}), 4326)`;

    distanceExpression = `CASE
      WHEN m.geo_point IS NULL THEN NULL
      ELSE ST_DistanceSphere(m.geo_point, ${pointExpression}) / 1000
    END`;

    where.push(`(
      m.geo_point IS NULL
      OR ST_DWithin(
        m.geo_point::geography,
        ${pointExpression}::geography,
        (m.service_radius_km * 1000)::double precision
      )
    )`);

    if (input.radiusKm && input.radiusKm > 0) {
      const radiusIndex = pushValue(values, input.radiusKm);
      where.push(`(
        m.geo_point IS NULL
        OR ST_DWithin(
          m.geo_point::geography,
          ${pointExpression}::geography,
          ($${radiusIndex} * 1000)::double precision
        )
      )`);
    }
  }

  const category = normalize(input.serviceCategory);

  if (category && category !== 'unknown') {
    const categoryIndex = pushValue(values, category);
    where.push(`(sc.code = $${categoryIndex} OR sc.name = $${categoryIndex})`);
  }

  const keyword = normalize(input.keyword);

  if (keyword) {
    const keywordIndex = pushValue(values, `%${keyword}%`);
    where.push(`(
      m.name ILIKE $${keywordIndex}
      OR ms.name ILIKE $${keywordIndex}
      OR EXISTS (SELECT 1 FROM unnest(m.tags) tag WHERE tag ILIKE $${keywordIndex})
      OR EXISTS (SELECT 1 FROM unnest(ms.common_phrases) phrase WHERE phrase ILIKE $${keywordIndex})
    )`);
  }

  const limitIndex = pushValue(values, clampLimit(input.limit));
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  return {
    text: `
      WITH scored AS (
        SELECT DISTINCT ON (m.id)
          m.id,
          ms.id AS service_id,
          ms.name AS service_name,
          m.name,
          sc.code AS category,
          m.tags,
          m.rating,
          ${distanceExpression} AS distance_km,
          m.service_radius_km,
          ms.price_description,
          ms.min_price,
          ms.max_price,
          ms.average_response_time,
          m.phone,
          m.verified,
          true AS available_now,
          (
            40
            + CASE WHEN m.verified THEN 8 ELSE 0 END
            + CASE WHEN ms.emergency_available THEN 8 ELSE 0 END
            + COALESCE(m.rating, 0) * 10
            + CASE
                WHEN ${distanceExpression} IS NULL THEN 8
                ELSE GREATEST(0, 20 - (${distanceExpression} * 3))
              END
          )::integer AS match_score
        FROM merchants m
        JOIN merchant_services ms ON ms.merchant_id = m.id
        LEFT JOIN service_categories sc ON sc.id = COALESCE(ms.category_id, m.primary_category_id)
        ${whereClause}
        ORDER BY m.id, match_score DESC
      )
      SELECT *
      FROM scored
      ORDER BY match_score DESC
      LIMIT $${limitIndex}
    `,
    values,
  };
}

function mapSearchRow(row: SearchRow): RankedMerchant {
  const category = row.category ?? 'unknown';

  return {
    id: row.id,
    serviceId: row.service_id ?? undefined,
    serviceName: row.service_name ?? undefined,
    name: row.name,
    category,
    tags: row.tags ?? [],
    rating: Number(row.rating ?? 0),
    reviewCount: 0,
    distanceKm: roundDistance(row.distance_km),
    serviceRadiusKm: Number(row.service_radius_km),
    priceHint: buildPriceHint(row),
    responseTime: row.average_response_time || '尽快联系',
    phone: row.phone,
    verified: row.verified,
    availableNow: row.available_now,
    matchScore: row.match_score,
  };
}

function buildPriceHint(row: SearchRow) {
  if (row.price_description) {
    return row.price_description;
  }

  if (row.min_price && row.max_price) {
    return `${row.min_price}-${row.max_price}元`;
  }

  if (row.min_price) {
    return `${row.min_price}元起`;
  }

  return '价格面议';
}

function roundDistance(value: string | null) {
  if (!value) {
    return 0;
  }

  return Math.round(Number(value) * 10) / 10;
}

function pushValue(values: Array<string | number>, value: string | number) {
  values.push(value);

  return values.length;
}

function clampLimit(value: number | undefined) {
  if (!value || value < 1) {
    return 5;
  }

  return Math.min(value, 20);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalize(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}
