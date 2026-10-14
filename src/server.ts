import { createApp } from './app.js';
import { env } from './config/env.js';

const app = await createApp();

try {
  await app.listen({
    port: env.PORT,
    host: env.HOST,
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
