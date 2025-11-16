import type { Content } from './content';

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'vip';

export interface UserProfile {
  id: string;
  email: string;
  isPremium: boolean; // Mantido para compatibilidade
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

export interface MyListItem {
  id: string;
  contentId: string;
  content: Content;
  addedAt: string;
}
