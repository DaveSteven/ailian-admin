export type ServiceCategory =
  | 'pipe_unclogging'
  | 'locksmith'
  | 'appliance_repair'
  | 'housekeeping'
  | 'unknown';

export type ServiceIntent = {
  intent: 'find_service' | 'small_talk';
  serviceCategory: ServiceCategory;
  urgency: 'low' | 'normal' | 'high';
  keywords: string[];
  locationRequired: boolean;
};

const categoryRules: Array<{
  category: ServiceCategory;
  keywords: string[];
}> = [
  {
    category: 'pipe_unclogging',
    keywords: ['下水', '管道', '马桶', '堵', '疏通', '反水', '漏水', '地漏'],
  },
  {
    category: 'locksmith',
    keywords: ['开锁', '换锁', '钥匙', '门锁', '锁芯', '进不了门'],
  },
  {
    category: 'appliance_repair',
    keywords: ['空调', '冰箱', '洗衣机', '热水器', '家电', '不制冷', '维修'],
  },
  {
    category: 'housekeeping',
    keywords: ['保洁', '打扫', '钟点工', '阿姨', '清洁', '家政'],
  },
];

const urgentKeywords = ['急', '马上', '现在', '立刻', '漏', '漫出来', '进不了门', '半夜'];

export function extractIntent(message: string): ServiceIntent {
  const matchedRule = categoryRules.find((rule) =>
    rule.keywords.some((keyword) => message.includes(keyword)),
  );
  const urgency = urgentKeywords.some((keyword) => message.includes(keyword)) ? 'high' : 'normal';
  const keywords = matchedRule?.keywords.filter((keyword) => message.includes(keyword)) ?? [];

  return {
    intent: matchedRule ? 'find_service' : 'small_talk',
    serviceCategory: matchedRule?.category ?? 'unknown',
    urgency,
    keywords,
    locationRequired: true,
  };
}
