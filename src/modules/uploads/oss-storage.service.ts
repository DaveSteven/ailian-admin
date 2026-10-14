import { randomUUID } from 'node:crypto';
import OSS from 'ali-oss';
import { env } from '../../config/env.js';
import { AppError } from '../../plugins/error-handler.js';

const METADATA_BASE_URL = 'http://100.100.100.200/latest';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UPLOAD_AUTHORIZATION_SECONDS = 10 * 60;

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type UploadCategory = 'merchant' | 'qualification';

type InstanceRoleCredentials = {
  AccessKeyId: string;
  AccessKeySecret: string;
  SecurityToken: string;
  Expiration: string;
  Code?: string;
};

let cachedCredentials: InstanceRoleCredentials | null = null;
let cachedMetadataToken: { value: string; expiresAt: number } | null = null;

export function isOssEnabled() {
  return Boolean(env.OSS_BUCKET);
}

export async function createOssUploadAuthorization(
  contentType: string,
  category: UploadCategory,
) {
  const extension = IMAGE_TYPES[contentType];

  if (!extension) {
    throw new AppError(400, 'INVALID_IMAGE_TYPE', '仅支持 JPG、PNG 或 WebP 图片。');
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `${env.OSS_UPLOAD_PREFIX}/${category}/${year}/${month}/`;
  const key = `${prefix}${randomUUID()}.${extension}`;
  const credentials = await getInstanceRoleCredentials();
  const client = createOssClient(credentials);
  const expiration = new Date(Date.now() + UPLOAD_AUTHORIZATION_SECONDS * 1000).toISOString();
  const signature = client.calculatePostSignature({
    expiration,
    conditions: [
      { bucket: env.OSS_BUCKET },
      ['starts-with', '$key', prefix],
      ['content-length-range', 1, MAX_IMAGE_BYTES],
      ['eq', '$Content-Type', contentType],
      ['eq', '$x-oss-security-token', credentials.SecurityToken],
    ],
  });

  return {
    mode: 'oss' as const,
    url: `https://${env.OSS_BUCKET}.${env.OSS_REGION}.aliyuncs.com`,
    key,
    formData: {
      key,
      policy: signature.policy,
      OSSAccessKeyId: signature.OSSAccessKeyId,
      signature: signature.Signature,
      'x-oss-security-token': credentials.SecurityToken,
      'Content-Type': contentType,
      success_action_status: '200',
    },
    expiresAt: expiration,
  };
}

export async function createOssDownloadUrl(key: string) {
  const credentials = await getInstanceRoleCredentials();
  const client = createOssClient(credentials);
  return client.signatureUrl(key, { expires: env.OSS_SIGNED_URL_SECONDS });
}

function createOssClient(credentials: InstanceRoleCredentials) {
  return new OSS({
    region: env.OSS_REGION,
    bucket: env.OSS_BUCKET,
    accessKeyId: credentials.AccessKeyId,
    accessKeySecret: credentials.AccessKeySecret,
    stsToken: credentials.SecurityToken,
    refreshSTSToken: async () => {
      const refreshed = await getInstanceRoleCredentials();
      return {
        accessKeyId: refreshed.AccessKeyId,
        accessKeySecret: refreshed.AccessKeySecret,
        stsToken: refreshed.SecurityToken,
      };
    },
    secure: true,
  });
}

async function getInstanceRoleCredentials(): Promise<InstanceRoleCredentials> {
  if (cachedCredentials) {
    const expiresAt = Date.parse(cachedCredentials.Expiration);

    if (Number.isFinite(expiresAt) && expiresAt - Date.now() > 5 * 60 * 1000) {
      return cachedCredentials;
    }
  }

  try {
    const token = await getMetadataToken();
    const response = await fetch(
      `${METADATA_BASE_URL}/meta-data/ram/security-credentials/${encodeURIComponent(env.OSS_ROLE_NAME)}`,
      {
        headers: { 'X-aliyun-ecs-metadata-token': token },
        signal: AbortSignal.timeout(3_000),
      },
    );

    if (!response.ok) {
      throw new Error(`metadata credentials returned ${response.status}`);
    }

    const credentials = await response.json() as InstanceRoleCredentials;

    if (
      credentials.Code !== 'Success'
      || !credentials.AccessKeyId
      || !credentials.AccessKeySecret
      || !credentials.SecurityToken
      || !credentials.Expiration
    ) {
      throw new Error('metadata credentials response is incomplete');
    }

    cachedCredentials = credentials;
    return credentials;
  } catch (error) {
    throw new AppError(
      503,
      'OSS_CREDENTIALS_UNAVAILABLE',
      '图片存储服务暂时不可用，请稍后重试。',
    );
  }
}

async function getMetadataToken() {
  if (cachedMetadataToken && cachedMetadataToken.expiresAt - Date.now() > 60_000) {
    return cachedMetadataToken.value;
  }

  const ttlSeconds = 6 * 60 * 60;
  const response = await fetch(`${METADATA_BASE_URL}/api/token`, {
    method: 'PUT',
    headers: { 'X-aliyun-ecs-metadata-token-ttl-seconds': String(ttlSeconds) },
    signal: AbortSignal.timeout(3_000),
  });

  if (!response.ok) {
    throw new Error(`metadata token returned ${response.status}`);
  }

  const value = await response.text();
  cachedMetadataToken = {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  return value;
}
