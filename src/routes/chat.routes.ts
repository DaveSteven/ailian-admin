import type { FastifyInstance } from 'fastify';
import { handleChatMessage } from '../modules/chat/chat.service.js';
import { AppError } from '../plugins/error-handler.js';
import { requireUser } from '../modules/auth/user-auth.service.js';

type ChatMessageBody = {
  message?: string;
  location?: {
    latitude: number;
    longitude: number;
    communityName?: string;
  };
};

export async function registerChatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatMessageBody }>('/message', async (request) => {
    await requireUser(request);
    const message = request.body.message?.trim();

    if (!message) {
      throw new AppError(400, 'MESSAGE_REQUIRED', '请先告诉我你遇到了什么生活问题。');
    }

    return handleChatMessage({
      message,
      location: request.body.location,
    });
  });
}
