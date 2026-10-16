import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { pool } from '../../db/client.js';
import { AppError } from '../../plugins/error-handler.js';
import { bindStaffWithPhoneNumber, getWechatPhone } from './staff-auth.service.js';

type WechatSessionResponse = { openid?: string; unionid?: string; errcode?: number; errmsg?: string };
type AppUserRow = { id: string; nickname: string; avatar_url: string | null; phone: string | null; is_staff: boolean };

export type AppUserIdentity = { id: string; nickname: string; avatarUrl: string | null; phone: string | null; isStaff: boolean };

export async function loginUserWithWechat(
  code: string,
  _profile: { nickname?: string; avatarUrl?: string },
  phoneCode?: string,
) {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw new AppError(503, 'WECHAT_NOT_CONFIGURED', '服务端尚未配置微信登录。');
  }
  if (!code || code.length > 200) {
    throw new AppError(400, 'INVALID_WECHAT_CODE', '微信登录凭证无效。');
  }
  if (!phoneCode || phoneCode.length > 200) {
    throw new AppError(400, 'PHONE_AUTH_REQUIRED', '请授权手机号后登录。');
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', env.WECHAT_APP_ID);
  url.searchParams.set('secret', env.WECHAT_APP_SECRET);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  let wechat: WechatSessionResponse;
  try {
    const response = await fetch(url);
    wechat = (await response.json()) as WechatSessionResponse;
  } catch {
    throw new AppError(502, 'WECHAT_UNAVAILABLE', '暂时无法连接微信登录服务。');
  }
  if (!wechat.openid) {
    throw new AppError(401, 'WECHAT_LOGIN_FAILED', '微信登录失败，请重新授权。');
  }

  const phone = await getWechatPhone(phoneCode);
  const nickname = `用户${phone.slice(-4)}`;
  const avatarUrl = null;
  const result = await pool.query<AppUserRow>(
    `INSERT INTO app_users (open_id, union_id, nickname, avatar_url, phone, active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (open_id) DO UPDATE
     SET union_id = COALESCE(EXCLUDED.union_id, app_users.union_id),
         nickname = EXCLUDED.nickname,
         avatar_url = EXCLUDED.avatar_url,
         phone = EXCLUDED.phone,
         updated_at = now(),
         last_login_at = now()
     WHERE app_users.active = true
     RETURNING id, nickname, avatar_url, phone, false AS is_staff`,
    [wechat.openid, wechat.unionid ?? null, nickname, avatarUrl, phone],
  );
  const user = result.rows[0];
  if (!user) throw new AppError(403, 'USER_DISABLED', '该账号已停用，请联系管理员。');

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO app_user_sessions (app_user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, hashToken(token), expiresAt],
  );
  const staffSession = await bindStaffWithPhoneNumber(wechat.openid, phone);
  return { token, expiresAt, user: mapUser({ ...user, is_staff: Boolean(staffSession) }), staffSession };
}

export async function requireUser(request: FastifyRequest): Promise<AppUserIdentity> {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new AppError(401, 'USER_LOGIN_REQUIRED', '请先登录后使用。');

  const result = await pool.query<AppUserRow>(
    `SELECT u.id, u.nickname, u.avatar_url, u.phone,
            EXISTS (SELECT 1 FROM staff_users st WHERE st.open_id = u.open_id AND st.active = true) AS is_staff
     FROM app_user_sessions s
     JOIN app_users u ON u.id = s.app_user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true
     LIMIT 1`,
    [hashToken(token)],
  );
  const user = result.rows[0];
  if (!user) throw new AppError(401, 'USER_SESSION_EXPIRED', '登录已过期，请重新登录。');
  return mapUser(user);
}

function mapUser(row: AppUserRow): AppUserIdentity {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    phone: maskPhone(row.phone),
    isStaff: row.is_staff,
  };
}

function maskPhone(phone: string | null) {
  if (!phone) return null;
  return /^1\d{10}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
