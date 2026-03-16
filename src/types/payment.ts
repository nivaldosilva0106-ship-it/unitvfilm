export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface Payment {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  proofUrl: string;
  status: PaymentStatus;
  subscriptionTier: 'basic' | 'premium' | 'vip';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
}

export const SUBSCRIPTION_PRICES = {
  basic: 6000,
  premium: 10000,
  vip: 15000,
} as const;

export const SUBSCRIPTION_BENEFITS = {
  free: {
    name: 'Gratuito',
    videoQuality: '480p',
    downloads: 0,
    earlyAccess: false,
    adsRemoval: false,
  },
  basic: {
    name: 'Básico',
    price: 6000,
    videoQuality: '720p',
    downloads: 3,
    earlyAccess: false,
    adsRemoval: true,
  },
  premium: {
    name: 'Premium',
    price: 10000,
    videoQuality: '1080p',
    downloads: 10,
    earlyAccess: true,
    adsRemoval: true,
  },
  vip: {
    name: 'VIP',
    price: 15000,
    videoQuality: '4K',
    downloads: -1, // ilimitado
    earlyAccess: true,
    adsRemoval: true,
  },
} as const;
