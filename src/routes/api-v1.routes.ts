import type { FastifyInstance } from 'fastify';
import { registerChatRoutes } from './chat.routes.js';
import { registerAuthRoutes } from './auth.routes.js';
import { registerMerchantsRoutes } from './merchants.routes.js';
import { registerServicesRoutes } from './services.routes.js';
import { registerUploadsRoutes } from './uploads.routes.js';
import { registerAdminRoutes } from './admin.routes.js';

export async function registerApiV1Routes(app: FastifyInstance) {
  app.get('/', async () => ({
    name: 'ailian-api',
    version: 'v1',
  }));

  await app.register(registerChatRoutes, {
    prefix: '/chat',
  });

  await app.register(registerAuthRoutes, {
    prefix: '/auth',
  });

  await app.register(registerServicesRoutes, {
    prefix: '/services',
  });

  await app.register(registerMerchantsRoutes, {
    prefix: '/merchants',
  });

  await app.register(registerUploadsRoutes, {
    prefix: '/uploads',
  });

  await app.register(registerAdminRoutes, {
    prefix: '/admin',
  });
}
