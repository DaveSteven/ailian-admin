import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { env } from './config/env.js';
import { registerErrorHandlers } from './plugins/error-handler.js';
import { registerApiV1Routes } from './routes/api-v1.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  registerErrorHandlers(app);

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 8 * 1024 * 1024,
    },
  });

  await app.register(registerHealthRoutes);
  await app.register(registerApiV1Routes, {
    prefix: '/api/v1',
  });

  return app;
}
