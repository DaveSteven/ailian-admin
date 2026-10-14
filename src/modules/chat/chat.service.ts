import { extractIntent } from '../ai/intent.service.js';
import { searchMerchants } from '../search/search.service.js';

type ChatMessageInput = {
  message: string;
  location?: {
    latitude: number;
    longitude: number;
    communityName?: string;
  };
};

const categoryNames = {
  pipe_unclogging: '管道疏通',
  locksmith: '开锁换锁',
  appliance_repair: '家电维修',
  housekeeping: '家政保洁',
  unknown: '生活服务',
};

export async function handleChatMessage(input: ChatMessageInput) {
  const intent = extractIntent(input.message);
  const merchants = await searchMerchants(intent);

  if (intent.serviceCategory === 'unknown') {
    return {
      intent,
      reply: '我还没完全听明白你要找哪类服务。你可以说得更具体一点，比如“厨房下水堵了”“钥匙丢了要开锁”或“空调不制冷”。',
      merchants: [],
    };
  }

  const categoryName = categoryNames[intent.serviceCategory];
  const community = input.location?.communityName ?? '你附近';

  return {
    intent,
    reply:
      merchants.length > 0
        ? `我按“${categoryName}”帮你在${community}筛了附近能服务的师傅，优先看距离、评分、是否现在可联系和价格透明度。`
        : `我识别到你需要“${categoryName}”，但当前商户库里还没有合适结果。`,
    merchants,
  };
}
