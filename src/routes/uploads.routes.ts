import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { requireStaff } from '../modules/auth/staff-auth.service.js';
import { AppError } from '../plugins/error-handler.js';
import {
  createOssDownloadUrl,
  createOssUploadAuthorization,
  isOssEnabled,
} from '../modules/uploads/oss-storage.service.js';

const IMAGE_TYPES: Record<string, { extension: string; contentType: string }> = {
  'image/jpeg': { extension: 'jpg', contentType: 'image/jpeg' },
  'image/png': { extension: 'png', contentType: 'image/png' },
  'image/webp': { extension: 'webp', contentType: 'image/webp' },
};

type ImageParams = { '*': string };
type PresignBody = {
  contentType?: string;
  category?: 'merchant' | 'qualification';
};

export async function registerUploadsRoutes(app: FastifyInstance) {
  app.post<{ Body: PresignBody }>('/images/presign', async (request) => {
    await requireStaff(request);

    if (!isOssEnabled()) {
      return { upload: { mode: 'server' as const } };
    }

    const contentType = String(request.body?.contentType || '').toLowerCase();
    const category = request.body?.category;

    if (category !== 'merchant' && category !== 'qualification') {
      throw new AppError(400, 'INVALID_IMAGE_CATEGORY', '图片用途不正确，请重新选择图片。');
    }

    return { upload: await createOssUploadAuthorization(contentType, category) };
  });

  app.post('/images', async (request, reply) => {
    await requireStaff(request);
    const upload = await request.file();

    if (!upload) {
      throw new AppError(400, 'IMAGE_REQUIRED', '请选择要上传的图片。');
    }

    const imageType = IMAGE_TYPES[upload.mimetype];

    if (!imageType) {
      upload.file.resume();
      throw new AppError(400, 'INVALID_IMAGE_TYPE', '仅支持 JPG、PNG 或 WebP 图片。');
    }

    await mkdir(env.UPLOAD_DIR, { recursive: true });
    const key = `${randomUUID()}.${imageType.extension}`;
    const targetPath = path.join(env.UPLOAD_DIR, key);

    try {
      await pipeline(upload.file, createWriteStream(targetPath, { flags: 'wx' }));

      if (upload.file.truncated) {
        throw new AppError(413, 'IMAGE_TOO_LARGE', '单张图片不能超过 8MB。');
      }
    } catch (error) {
      await unlink(targetPath).catch(() => undefined);
      if (error instanceof AppError) throw error;
      throw new AppError(400, 'IMAGE_UPLOAD_FAILED', '图片上传失败，请重试。');
    }

    return reply.code(201).send({ image: { key } });
  });

  app.get<{ Params: ImageParams }>('/*', async (request, reply) => {
    const key = request.params['*'];

    if (isOssEnabled() && isOssImageKey(key)) {
      const url = await createOssDownloadUrl(key);
      reply.header('Cache-Control', 'private, no-store');
      return reply.redirect(url);
    }

    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) {
      throw new AppError(404, 'IMAGE_NOT_FOUND', '图片不存在。');
    }

    const filePath = path.join(env.UPLOAD_DIR, key);
    await access(filePath).catch(() => {
      throw new AppError(404, 'IMAGE_NOT_FOUND', '图片不存在。');
    });

    const extension = path.extname(key).slice(1);
    const contentType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.type(contentType).send(createReadStream(filePath));
  });
}

function isOssImageKey(key: string) {
  const escapedPrefix = env.OSS_UPLOAD_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^${escapedPrefix}/(merchant|qualification)/\\d{4}/\\d{2}/[0-9a-f-]{36}\\.(jpg|png|webp)$`,
  ).test(key);
}
