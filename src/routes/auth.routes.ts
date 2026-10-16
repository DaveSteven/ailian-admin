import type { FastifyInstance } from 'fastify';
import { loginStaffWithWechat, requireStaff } from '../modules/auth/staff-auth.service.js';
import { loginUserWithWechat, requireUser } from '../modules/auth/user-auth.service.js';

type WechatLoginBody = {
  code?: string;
  phoneCode?: string;
};

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: { code?: string; phoneCode?: string; profile?: { nickname?: string; avatarUrl?: string } } }>('/user/wechat', async (request) => {
    return loginUserWithWechat(request.body?.code ?? '', request.body?.profile ?? {}, request.body?.phoneCode);
  });

  app.get('/user/me', async (request) => ({ user: await requireUser(request) }));

  app.post<{ Body: WechatLoginBody }>('/wechat', async (request) => {
    return loginStaffWithWechat(request.body?.code ?? '', request.body?.phoneCode ?? '');
  });

  app.get('/me', async (request) => {
    const staff = await requireStaff(request);
    return { staff };
  });
}
