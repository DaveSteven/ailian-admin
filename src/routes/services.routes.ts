import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client.js';
import { searchMerchantDatabase } from '../modules/search/search.service.js';

type ServiceSearchBody = {
  serviceCategory?: string;
  keyword?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
};

export async function registerServicesRoutes(app: FastifyInstance) {
  app.get('/categories', async () => {
    const result = await pool.query<{ id: string; code: string; name: string }>(
      'SELECT id, code, name FROM service_categories ORDER BY created_at ASC',
    );

    return { categories: result.rows };
  });

  app.post<{ Body: ServiceSearchBody }>('/search', async (request) => {
    const merchants = await searchMerchantDatabase({
      serviceCategory: request.body.serviceCategory,
      keyword: request.body.keyword,
      latitude: request.body.latitude,
      longitude: request.body.longitude,
      radiusKm: request.body.radiusKm,
      limit: request.body.limit,
    });

    return {
      merchants,
    };
  });
}
