import { pool } from '../../db/client.js';
import { AppError } from '../../plugins/error-handler.js';

type MerchantDetailRow = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string;
  wechat_id: string | null;
  category_code: string | null;
  category_name: string | null;
  tags: string[] | null;
  province: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  longitude: string | null;
  latitude: string | null;
  service_radius_km: string;
  business_hours: string | null;
  night_service: boolean;
  verified: boolean;
  rating: string | null;
  note: string | null;
};

type MerchantServiceRow = {
  id: string;
  category_code: string | null;
  category_name: string | null;
  name: string;
  common_phrases: string[] | null;
  price_type: string;
  min_price: number | null;
  max_price: number | null;
  price_description: string | null;
  emergency_available: boolean;
  average_response_time: string | null;
  description: string | null;
};

type MerchantContactRow = {
  id: string;
  name: string;
  phone: string;
  is_primary: boolean;
};

type MerchantMediaRow = {
  id: string;
  media_type: 'merchant' | 'qualification';
  storage_key: string;
};

export async function getMerchantDetail(id: string) {
  const merchantResult = await pool.query<MerchantDetailRow>(
    `
      SELECT
        m.id,
        m.name,
        m.contact_name,
        m.phone,
        m.wechat_id,
        sc.code AS category_code,
        sc.name AS category_name,
        m.tags,
        m.province,
        m.city,
        m.district,
        m.address,
        m.longitude,
        m.latitude,
        m.service_radius_km,
        m.business_hours,
        m.night_service,
        m.verified,
        m.rating,
        m.note
      FROM merchants m
      LEFT JOIN service_categories sc ON sc.id = m.primary_category_id
      WHERE m.id = $1
      LIMIT 1
    `,
    [id],
  );

  const merchant = merchantResult.rows[0];

  if (!merchant) {
    throw new AppError(404, 'MERCHANT_NOT_FOUND', '没有找到这个商户。');
  }

  const servicesResult = await pool.query<MerchantServiceRow>(
    `
      SELECT
        ms.id,
        sc.code AS category_code,
        sc.name AS category_name,
        ms.name,
        ms.common_phrases,
        ms.price_type,
        ms.min_price,
        ms.max_price,
        ms.price_description,
        ms.emergency_available,
        ms.average_response_time,
        ms.description
      FROM merchant_services ms
      LEFT JOIN service_categories sc ON sc.id = ms.category_id
      WHERE ms.merchant_id = $1
      ORDER BY ms.created_at ASC
    `,
    [id],
  );

  const contactsResult = await pool.query<MerchantContactRow>(
    `SELECT id, name, phone, is_primary
     FROM merchant_contacts
     WHERE merchant_id = $1
     ORDER BY position ASC, created_at ASC`,
    [id],
  );

  const mediaResult = await pool.query<MerchantMediaRow>(
    `SELECT id, media_type, storage_key
     FROM merchant_media
     WHERE merchant_id = $1
     ORDER BY media_type ASC, position ASC, created_at ASC`,
    [id],
  );

  return {
    id: merchant.id,
    name: merchant.name,
    contactName: merchant.contact_name,
    phone: merchant.phone,
    wechatId: merchant.wechat_id,
    category: merchant.category_code,
    categoryName: merchant.category_name,
    tags: merchant.tags ?? [],
    address: {
      province: merchant.province,
      city: merchant.city,
      district: merchant.district,
      detail: merchant.address,
      longitude: merchant.longitude ? Number(merchant.longitude) : null,
      latitude: merchant.latitude ? Number(merchant.latitude) : null,
    },
    serviceRadiusKm: Number(merchant.service_radius_km),
    businessHours: merchant.business_hours,
    nightService: merchant.night_service,
    verified: merchant.verified,
    rating: merchant.rating ? Number(merchant.rating) : null,
    note: merchant.note,
    contacts: contactsResult.rows.map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      isPrimary: contact.is_primary,
    })),
    images: mediaResult.rows
      .filter((media) => media.media_type === 'merchant')
      .map((media) => ({ id: media.id, url: `/api/v1/uploads/${media.storage_key}` })),
    qualificationImages: mediaResult.rows
      .filter((media) => media.media_type === 'qualification')
      .map((media) => ({ id: media.id, url: `/api/v1/uploads/${media.storage_key}` })),
    services: servicesResult.rows.map((service) => ({
      id: service.id,
      category: service.category_code,
      categoryName: service.category_name,
      name: service.name,
      commonPhrases: service.common_phrases ?? [],
      priceType: service.price_type,
      minPrice: service.min_price,
      maxPrice: service.max_price,
      priceDescription: service.price_description,
      emergencyAvailable: service.emergency_available,
      averageResponseTime: service.average_response_time,
      description: service.description,
    })),
  };
}
