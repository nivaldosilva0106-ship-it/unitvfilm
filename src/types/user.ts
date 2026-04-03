import type { Content } from './content';

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'vip';

export interface UserProfile {
  id: string;
  email: string;
  isPremium: boolean; // Mantido para compatibilidade
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  credits?: {
    date: string; // YYYY-MM-DD
    moviesWatched: number;
    episodesWatched: number;
  };
  planId?: string;
  status?: 'active' | 'pending_payment';
  name?: string;
  photoURL?: string;
  lastExpiryNotification?: string;
  profilesLimitOverride?: number | null;
  trialSignup?: boolean;
}

export interface Plan {
  id: string; // 'free' | 'basic' | 'premium' etc
  name: string;
  description: string;
  price: number;
  limits: {
    moviesPerDay: number; // -1 for unlimited
    episodesPerDay: number; // -1 for unlimited
    canDownload: boolean;
    maxProfiles: number;
    deviceLimit?: number;
  };
  durationDays?: number; // 7, 30, 90, 365
  isActive: boolean;
  requiresVerification: boolean;
  whatsappNumber?: string; // For redirect
}

export interface VerificationCode {
  id: string; // Key
  code: string;
  type?: 'plan_activation' | 'pin_reset';
  planId?: string; // Optional now, as 'pin_reset' doesn't need it
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  usedBy?: string; // UserId
}

export interface MyListItem {
  id: string;
  contentId: string;
  content: Content;
  addedAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  avatarUrl?: string; // Legacy support or alias? Let's stick to what code uses: avatar
  isKids: boolean;
  pin?: string;
  pinAttempts?: number;
  lockoutUntil?: string; // ISO timestamp
  createdAt: string;
}

export interface Avatar {
  id: string;
  url: string;
  createdAt: string;
}

export interface UserContentProgress {
  userId: string;
  profileId: string;
  contentId: string;
  season?: number;
  episode?: number;
  lastPositionSeconds: number;
  durationSeconds?: number;
  updatedAt: string; // ISO String
}
