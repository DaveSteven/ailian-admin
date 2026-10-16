type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

type Env = {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string;
  PORT: number;
  LOG_LEVEL: LogLevel;
  CORS_ORIGIN: boolean | string | RegExp | Array<string | RegExp>;
  DATABASE_URL: string;
  DB_POOL_MAX: number;
  WECHAT_APP_ID: string;
  WECHAT_APP_SECRET: string;
  STAFF_SESSION_DAYS: number;
  STAFF_AUTO_PROVISION: boolean;
  UPLOAD_DIR: string;
  OSS_BUCKET: string;
  OSS_REGION: string;
  OSS_ROLE_NAME: string;
  OSS_UPLOAD_PREFIX: string;
  OSS_SIGNED_URL_SECONDS: number;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  ADMIN_TOKEN_SECRET: string;
};

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

export const env: Env = {
  NODE_ENV: parseNodeEnv(process.env.NODE_ENV),
  HOST: process.env.HOST || DEFAULT_HOST,
  PORT: parsePort(process.env.PORT),
  LOG_LEVEL: parseLogLevel(process.env.LOG_LEVEL),
  CORS_ORIGIN: parseCorsOrigin(process.env.CORS_ORIGIN),
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://ailian:ailian@127.0.0.1:5433/ailian',
  DB_POOL_MAX: parsePositiveInteger(process.env.DB_POOL_MAX, 10),
  WECHAT_APP_ID: process.env.WECHAT_APP_ID || '',
  WECHAT_APP_SECRET: process.env.WECHAT_APP_SECRET || '',
  STAFF_SESSION_DAYS: parsePositiveInteger(process.env.STAFF_SESSION_DAYS, 7),
  STAFF_AUTO_PROVISION: parseBoolean(process.env.STAFF_AUTO_PROVISION, false),
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  OSS_BUCKET: process.env.OSS_BUCKET || '',
  OSS_REGION: process.env.OSS_REGION || 'oss-cn-guangzhou',
  OSS_ROLE_NAME: process.env.OSS_ROLE_NAME || 'AilianMerchantMediaEcsRole',
  OSS_UPLOAD_PREFIX: process.env.OSS_UPLOAD_PREFIX || 'merchant-media',
  OSS_SIGNED_URL_SECONDS: parsePositiveInteger(process.env.OSS_SIGNED_URL_SECONDS, 600),
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '000000',
  ADMIN_TOKEN_SECRET: process.env.ADMIN_TOKEN_SECRET || 'ailian-admin-change-this-secret',
};

function parseNodeEnv(value: string | undefined): Env['NODE_ENV'] {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }

  return port;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const allowed: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

  if (value && allowed.includes(value as LogLevel)) {
    return value as LogLevel;
  }

  return 'info';
}

function parseCorsOrigin(value: string | undefined): Env['CORS_ORIGIN'] {
  if (!value || value === '*') {
    return true;
  }

  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${value}`);
  }

  return parsed;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
