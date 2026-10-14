import type { FastifyInstance } from 'fastify';
import { requireStaff } from '../modules/auth/staff-auth.service.js';
import {
  createMerchant,
  findDuplicateMerchants,
  type CreateMerchantInput,
} from '../modules/merchants/merchant-create.service.js';
import { getMerchantDetail } from '../modules/merchants/merchant-detail.service.js';

type MerchantParams = {
  id: string;
};

export async function registerMerchantsRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateMerchantInput }>('/', async (request, reply) => {
    const staff = await requireStaff(request);
    const merchant = await createMerchant(request.body ?? {}, staff.id);
    return reply.code(201).send({ merchant });
  });

  app.post<{ Body: CreateMerchantInput }>('/check-duplicate', async (request) => {
    await requireStaff(request);
    const merchants = await findDuplicateMerchants(request.body ?? {});
    return { merchants };
  });

  app.get<{ Params: MerchantParams }>('/:id', async (request) => {
    return getMerchantDetail(request.params.id);
  });
}
