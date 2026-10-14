import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function registerErrorHandlers(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    sendErrorResponse(error, request, reply);
  });
}

function sendErrorResponse(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;

  request.log.error(error);
  reply.code(statusCode).send({
    error: {
      code: statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
      message: statusCode === 500 ? '服务暂时不可用，请稍后再试。' : error.message,
    },
  });
}
