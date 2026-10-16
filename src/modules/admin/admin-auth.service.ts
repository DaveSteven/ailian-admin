import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { AppError } from '../../plugins/error-handler.js';

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function authenticateAdmin(username: unknown, password: unknown) {
  if (!safeEqual(String(username ?? ''), env.ADMIN_USERNAME) || !safeEqual(String(password ?? ''), env.ADMIN_PASSWORD)) {
    throw new AppError(401, 'INVALID_ADMIN_CREDENTIALS', '账号或密码不正确。');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${env.ADMIN_USERNAME}.${expiresAt}`;
  const signature = sign(payload);
  return { token: `${encodeURIComponent(env.ADMIN_USERNAME)}.${expiresAt}.${signature}`, expiresAt };
}

export function requireAdmin(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const [encodedUsername, expiresValue, signature] = token.split('.');
  const username = decodeURIComponent(encodedUsername || '');
  const expiresAt = Number(expiresValue);
  const payload = `${username}.${expiresValue}`;

  if (
    username !== env.ADMIN_USERNAME
    || !Number.isInteger(expiresAt)
    || expiresAt <= Math.floor(Date.now() / 1000)
    || !signature
    || !safeEqual(signature, sign(payload))
  ) {
    throw new AppError(401, 'ADMIN_UNAUTHORIZED', '登录已过期，请重新登录。');
  }

  return { username };
}

function sign(value: string) {
  return createHmac('sha256', env.ADMIN_TOKEN_SECRET).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
