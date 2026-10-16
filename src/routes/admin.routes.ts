import type { FastifyInstance } from 'fastify';
import { authenticateAdmin, requireAdmin } from '../modules/admin/admin-auth.service.js';
import { getAdminOverview, listAdminMerchants, reviewMerchant } from '../modules/admin/admin-merchants.service.js';
import { getMerchantDetail } from '../modules/merchants/merchant-detail.service.js';
import { createAdminCategory, listAdminCategories, updateAdminCategory } from '../modules/admin/admin-categories.service.js';

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post<{ Body: { username?: string; password?: string } }>('/login', async (request) => ({
    session: authenticateAdmin(request.body?.username, request.body?.password),
  }));
  app.get('/me', async (request) => ({ admin: requireAdmin(request) }));
  app.get('/overview', async (request) => { requireAdmin(request); return { stats: await getAdminOverview() }; });
  app.get<{ Querystring: { page?: string; pageSize?: string; status?: string; keyword?: string } }>('/merchants', async (request) => {
    requireAdmin(request); return listAdminMerchants(request.query);
  });
  app.get<{ Params: { id: string } }>('/merchants/:id', async (request) => {
    requireAdmin(request); return { merchant: await getMerchantDetail(request.params.id) };
  });
  app.patch<{ Params: { id: string }; Body: { status?: string } }>('/merchants/:id/review', async (request) => {
    requireAdmin(request); return { merchant: await reviewMerchant(request.params.id, request.body?.status) };
  });
  app.get('/categories', async (request) => {
    requireAdmin(request); return { categories: await listAdminCategories() };
  });
  app.post<{ Body: { name?: string; description?: string } }>('/categories', async (request, reply) => {
    requireAdmin(request);
    return reply.code(201).send({ category: await createAdminCategory(request.body ?? {}) });
  });
  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string } }>('/categories/:id', async (request) => {
    requireAdmin(request);
    return { category: await updateAdminCategory(request.params.id, request.body ?? {}) };
  });
}
