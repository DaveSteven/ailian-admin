import type { ServiceCategory } from '../ai/intent.service.js';

export type Merchant = {
  id: string;
  name: string;
  category: ServiceCategory;
  tags: string[];
  rating: number;
  reviewCount: number;
  distanceKm: number;
  serviceRadiusKm: number;
  priceHint: string;
  responseTime: string;
  phone: string;
  verified: boolean;
  availableNow: boolean;
};
