import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { pool } from '../../db/client.js';
import { AppError } from '../../plugins/error-handler.js';

type WechatSessionResponse = {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatAccessTokenResponse = { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
type WechatPhoneResponse = { errcode?: number; errmsg?: string; phone_info?: { purePhoneNumber?: string } };

let accessTokenCache: { value: string; expiresAt: number } | null = null;

export type StaffIdentity = {
  id: string;
  name: string;
  role: 'field_agent' | 'reviewer' | 'admin';
};

export async function loginStaffWithWechat(code: string, phoneCode: string) {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw new AppError(503, 'WECHAT_NOT_CONFIGURED', '服务端尚未配置微信登录。');
  }

  if (!code || code.length > 200) {
    throw new AppError(400, 'INVALID_WECHAT_CODE', '微信登录凭证无效。');
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', env.WECHAT_APP_ID);
  url.searchParams.set('secret', env.WECHAT_APP_SECRET);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  let wechatResponse: WechatSessionResponse;

  try {
    const response = await fetch(url);
    wechatResponse = (await response.json()) as WechatSessionResponse;
  } catch {
    throw new AppError(502, 'WECHAT_UNAVAILABLE', '暂时无法连接微信登录服务。');
  }

  if (!wechatResponse.openid) {
    throw new AppError(401, 'WECHAT_LOGIN_FAILED', '微信登录失败，请重新进入页面。');
  }

  const staffResult = await pool.query<StaffIdentity & { active: boolean }>(
    `SELECT id, name, role, active FROM staff_users WHERE open_id = $1 LIMIT 1`,
    [wechatResponse.openid],
  );
  let staff = staffResult.rows[0];

  if (!staff) {
    if (!phoneCode || phoneCode.length > 200) {
      throw new AppError(401, 'PHONE_AUTH_REQUIRED', '请授权手机号以验证地推人员身份。');
    }
    const phone = await getWechatPhone(phoneCode);
    const whitelistResult = await pool.query<StaffIdentity & { active: boolean }>(
      `UPDATE staff_users
       SET open_id = $1, updated_at = now()
       WHERE phone = $2 AND active = true AND (open_id IS NULL OR open_id = $1)
       RETURNING id, name, role, active`,
      [wechatResponse.openid, phone],
    );
    staff = whitelistResult.rows[0];
  }

  if (!staff || !staff.active) {
    throw new AppError(403, 'STAFF_NOT_WHITELISTED', '该手机号不在地推白名单中，请联系管理员。');
  }

  return createStaffSession(staff);
}

export async function bindStaffWithPhone(openId: string, phoneCode: string) {
  if (!phoneCode || phoneCode.length > 200) return null;
  const phone = await getWechatPhone(phoneCode);
  return bindStaffWithPhoneNumber(openId, phone);
}

export async function bindStaffWithPhoneNumber(openId: string, phone: string) {
  const result = await pool.query<StaffIdentity & { active: boolean }>(
    `UPDATE staff_users
     SET open_id = $1, updated_at = now()
     WHERE phone = $2 AND active = true AND (open_id IS NULL OR open_id = $1)
     RETURNING id, name, role, active`,
    [openId, phone],
  );
  const staff = result.rows[0];
  return staff ? createStaffSession(staff) : null;
}

async function createStaffSession(staff: StaffIdentity) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + env.STAFF_SESSION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO staff_sessions (staff_user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [staff.id, tokenHash, expiresAt],
  );

  return {
    token,
    expiresAt,
    staff: { id: staff.id, name: staff.name, role: staff.role },
  };
}

export async function getWechatPhone(code: string) {
  const accessToken = await getWechatAccessToken();
  const response = await fetch(`https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = (await response.json()) as WechatPhoneResponse;
  const phone = body.phone_info?.purePhoneNumber;
  if (!response.ok || body.errcode || !phone) {
    throw new AppError(401, 'WECHAT_PHONE_FAILED', '手机号授权失败，请重新授权。');
  }
  return phone.replace(/^\+?86/, '');
}

async function getWechatAccessToken() {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) return accessTokenCache.value;
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', env.WECHAT_APP_ID);
  url.searchParams.set('secret', env.WECHAT_APP_SECRET);
  const response = await fetch(url);
  const body = (await response.json()) as WechatAccessTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new AppError(502, 'WECHAT_ACCESS_TOKEN_FAILED', '暂时无法连接微信授权服务。');
  }
  accessTokenCache = { value: body.access_token, expiresAt: Date.now() + Math.max(60, (body.expires_in ?? 7200) - 300) * 1000 };
  return accessTokenCache.value;
}

export async function requireStaff(request: FastifyRequest): Promise<StaffIdentity> {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) {
    throw new AppError(401, 'STAFF_LOGIN_REQUIRED', '请先使用已授权的微信账号登录。');
  }

  const result = await pool.query<StaffIdentity>(
    `
      SELECT u.id, u.name, u.role
      FROM staff_sessions s
      JOIN staff_users u ON u.id = s.staff_user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true
      LIMIT 1
    `,
    [hashToken(token)],
  );
  const staff = result.rows[0];

  if (!staff) {
    throw new AppError(401, 'STAFF_SESSION_EXPIRED', '登录已过期，请重新进入页面。');
  }

  return staff;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
