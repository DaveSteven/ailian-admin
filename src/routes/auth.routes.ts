import type { FastifyInstance } from 'fastify';
import { loginStaffWithWechat, requireStaff } from '../modules/auth/staff-auth.service.js';

type WechatLoginBody = {
  code?: string;
};

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: WechatLoginBody }>('/wechat', async (request) => {
    return loginStaffWithWechat(request.body?.code ?? '');
  });

  app.get('/me', async (request) => {
    const staff = await requireStaff(request);
    return { staff };
  });
}
