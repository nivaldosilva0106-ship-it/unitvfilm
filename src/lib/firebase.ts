import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, update, push, onValue, off, enableLogging } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously as firebaseSignInAnonymously, User } from 'firebase/auth';

import type { Content } from '@/types/content';
import type { UserProfile, MyListItem, SubscriptionTier, Plan, VerificationCode, UserContentProgress } from '@/types/user';
import type { Ad } from '@/types/ad';
import type { Payment } from '@/types/payment';

// Firebase configuration for UniTvFilm
export const firebaseConfig = {
  apiKey: "AIzaSyAWr4do1UXOBd5Hd08OxNv-yztUOlH6wQM",
  databaseURL: "https://unitvfilm-678d5-default-rtdb.firebaseio.com/",
  projectId: "unitvfilm-678d5",
  appId: "1:989230761933:android:4ac80dd1790f962c996684"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Helper to remove undefined values deeply (Firebase RTDB doesn't accept undefined)
function removeUndefinedDeep<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return (obj as unknown[]).map((item) => removeUndefinedDeep(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleaned = removeUndefinedDeep(value as unknown);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result as T;
  }
  return obj;
}

export const addContent = async (content: Omit<Content, 'id'>) => {
  const contentRef = ref(database, 'contents');
  const newContentRef = push(contentRef);
  const base = removeUndefinedDeep(content);
  const contentWithId = removeUndefinedDeep({ ...base, id: newContentRef.key }) as Content;
  await set(newContentRef, contentWithId);

  return contentWithId;
};

export const getAllContents = async (): Promise<Content[]> => {
  try {
    const contentRef = ref(database, 'contents');
    const snapshot = await get(contentRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const contents = Object.values(data) as Content[];
      // Cache to localStorage
      try {
        localStorage.setItem('cached_contents', JSON.stringify(contents));
      } catch (e) {
        console.warn('Failed to cache contents:', e);
      }
      return contents;
    }
    return [];
  } catch (error) {
    // If offline, try to load from cache
    console.warn("Network error fetching contents, trying cache...", error);
    try {
      const cached = localStorage.getItem('cached_contents');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) { }
    return [];
  }
};

export const getContentsByCategory = async (category: string): Promise<Content[]> => {
  const contents = await getAllContents();
  return contents.filter(content => content.category === category);
};

export const updateContent = async (id: string, updates: Partial<Content>) => {
  const contentRef = ref(database, `contents/${id}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(contentRef, cleaned);
};

export const deleteContent = async (id: string) => {
  const contentRef = ref(database, `contents/${id}`);
  await remove(contentRef);
};

// Authentication functions
export const signUp = async (email: string, password: string, subscriptionTier: SubscriptionTier = 'free', planId = 'free', status: 'active' | 'pending_payment' = 'active') => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Create user profile
  const profile: UserProfile = {
    id: user.uid,
    email: user.email || '',
    isPremium: subscriptionTier !== 'free',
    subscriptionTier,
    planId,
    status,
    subscriptionExpiresAt: null,
    createdAt: new Date().toISOString(),
  };

  await set(ref(database, `profiles/${user.uid}`), profile);
  return userCredential;
};

export const signIn = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logOut = async () => {
  return signOut(auth);
};

export const resetPassword = async (email: string) => {
  const { sendPasswordResetEmail } = await import('firebase/auth');
  return sendPasswordResetEmail(auth, email);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// User Profile functions
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const profileRef = ref(database, `profiles/${userId}`);
  const snapshot = await get(profileRef);
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
};

export const subscribeToUserProfile = (userId: string, callback: (profile: UserProfile | null) => void) => {
  const profileRef = ref(database, `profiles/${userId}`);
  return onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  const profileRef = ref(database, `profiles/${userId}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(profileRef, cleaned);
};

// My List functions
export const addToMyList = async (userId: string, content: Content) => {
  const myListRef = ref(database, `myList/${userId}`);
  const newItemRef = push(myListRef);
  const item: MyListItem = {
    id: newItemRef.key!,
    contentId: content.id,
    content: removeUndefinedDeep(content),
    addedAt: new Date().toISOString(),
  };
  await set(newItemRef, item);
  return item;
};

// ...
export const removeFromMyList = async (userId: string, itemId: string) => {
  const itemRef = ref(database, `myList/${userId}/${itemId}`);
  await remove(itemRef);
};

export const deleteUserProfile = async (userId: string) => {
  await remove(ref(database, `profiles/${userId}`));
  await remove(ref(database, `accountProfiles/${userId}`));
  await remove(ref(database, `myList/${userId}`));
};

export const getMyList = async (userId: string): Promise<MyListItem[]> => {
  const myListRef = ref(database, `myList/${userId}`);
  const snapshot = await get(myListRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
  }
  return [];
};

export const isInMyList = async (userId: string, contentId: string): Promise<boolean> => {
  const myListRef = ref(database, `myList/${userId}`);
  const snapshot = await get(myListRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    const items: MyListItem[] = Object.values(data);
    return items.some(item => item.contentId === contentId);
  }
  return false;
};

export const subscribeToMyList = (userId: string, callback: (items: MyListItem[]) => void) => {
  const myListRef = ref(database, `myList/${userId}`);
  return onValue(myListRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data));
    } else {
      callback([]);
    }
  });
};

// Ad Management functions
export const addAd = async (ad: Omit<Ad, 'id'>) => {
  const adRef = ref(database, 'ads');
  const newAdRef = push(adRef);
  const adWithId = removeUndefinedDeep({ ...ad, id: newAdRef.key }) as Ad;
  await set(newAdRef, adWithId);
  return adWithId;
};

export const getAllAds = async (): Promise<Ad[]> => {
  try {
    const adRef = ref(database, 'ads');
    const snapshot = await get(adRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const ads = Object.values(data) as Ad[];
      try {
        localStorage.setItem('cached_ads', JSON.stringify(ads));
      } catch (e) { }
      return ads;
    }
  } catch (error) {
    // Offline fallback
    try {
      const cached = localStorage.getItem('cached_ads');
      if (cached) return JSON.parse(cached);
    } catch (e) { }
  }
  return [];
};

export const getActiveAdsByPlacement = async (placement: Ad['placement']): Promise<Ad[]> => {
  const ads = await getAllAds();
  return ads.filter(ad => ad.active && ad.placement === placement);
};

export const updateAd = async (id: string, updates: Partial<Ad>) => {
  const adRef = ref(database, `ads/${id}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(adRef, cleaned);
};

export const deleteAd = async (id: string) => {
  const adRef = ref(database, `ads/${id}`);
  await remove(adRef);
};

// Payment Management functions
export const createPayment = async (payment: Omit<Payment, 'id' | 'createdAt'>) => {
  const paymentRef = ref(database, 'payments');
  const newPaymentRef = push(paymentRef);
  const paymentWithId: Payment = {
    ...removeUndefinedDeep(payment),
    id: newPaymentRef.key!,
    createdAt: new Date().toISOString(),
  };
  await set(newPaymentRef, paymentWithId);
  return paymentWithId;
};

export const getAllPayments = async (): Promise<Payment[]> => {
  const paymentRef = ref(database, 'payments');
  const snapshot = await get(paymentRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
  }
  return [];
};

export const getPendingPayments = async (): Promise<Payment[]> => {
  const payments = await getAllPayments();
  return payments.filter(payment => payment.status === 'pending');
};

export const getUserPayments = async (userId: string): Promise<Payment[]> => {
  const payments = await getAllPayments();
  return payments.filter(payment => payment.userId === userId);
};

export const updatePayment = async (id: string, updates: Partial<Payment>) => {
  const paymentRef = ref(database, `payments/${id}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(paymentRef, cleaned);
};

export const approvePayment = async (paymentId: string, adminId: string) => {
  const payments = await getAllPayments();
  const payment = payments.find(p => p.id === paymentId);

  if (!payment) throw new Error('Pagamento não encontrado');

  // Atualizar pagamento
  await updatePayment(paymentId, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: adminId,
  });

  // Atribuir plano ao usuário (que já lida com datas, limites e expiração)
  await assignPlanToUser(payment.userId, payment.subscriptionTier);
};

export const rejectPayment = async (paymentId: string, reason: string) => {
  await updatePayment(paymentId, {
    status: 'rejected',
    rejectedReason: reason,
  });
};

export const checkSubscriptionExpired = async (userId: string): Promise<boolean> => {
  const profile = await getUserProfile(userId);
  if (!profile || !profile.subscriptionExpiresAt) return true;

  const expiresAt = new Date(profile.subscriptionExpiresAt);
  const now = new Date();

  if (now > expiresAt) {
    // Assinatura expirada, atualizar para free
    await updateUserProfile(userId, {
      isPremium: false,
      subscriptionTier: 'free',
      subscriptionExpiresAt: null,
    });
    return true;
  }

  return false;
};

// Admin role functions
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    // Check in admins table
    const adminRef = ref(database, `admins/${userId}`);
    const snapshot = await get(adminRef);
    if (snapshot.exists()) {
      return true;
    }
    // Fallback: check if is the original admin email
    const profile = await getUserProfile(userId);
    return profile?.email === 'www.nivaldo.com.ao@gmail.com';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
};

export const getAllAdmins = async (): Promise<string[]> => {
  const adminsRef = ref(database, 'admins');
  const snapshot = await get(adminsRef);
  if (snapshot.exists()) {
    return Object.keys(snapshot.val());
  }
  return [];
};

export const setUserAsAdmin = async (userId: string, email: string) => {
  const adminRef = ref(database, `admins/${userId}`);
  await set(adminRef, {
    email,
    createdAt: new Date().toISOString()
  });
};

export const removeUserAdmin = async (userId: string) => {
  const adminRef = ref(database, `admins/${userId}`);
  await remove(adminRef);
};

// Initialize the original admin (www.nivaldo.com.ao@gmail.com)
export const initializeOriginalAdmin = async () => {
  const users = await getAllUsers();
  const originalAdmin = users.find(u => u.email === 'www.nivaldo.com.ao@gmail.com');
  if (originalAdmin) {
    const adminRef = ref(database, `admins/${originalAdmin.id}`);
    const snapshot = await get(adminRef);
    if (!snapshot.exists()) {
      await setUserAsAdmin(originalAdmin.id, originalAdmin.email);
    }
  }
};

// Site Settings functions
export interface SiteSettings {
  loginBackgroundUrl?: string;
  holidayDecorationsEnabled?: boolean;
  holidayDecorationsType?: 'christmas' | 'newyear' | 'both';
  youtubeApiKey?: string;
  freeTrialMode?: boolean;
  whatsappNumber?: string;
  officialSiteUrl?: string;
  providerLogos?: Record<string, string>;
  pwaIconUrl?: string;
  apkDownloadUrl?: string;
  apkLiteDownloadUrl?: string;
  enableApkDownload?: boolean;
  enablePwaInstall?: boolean;
  requiredAppVersion?: number;
  requiredLiteAppVersion?: number;
}

export const getSiteSettings = async (): Promise<SiteSettings> => {
  try {
    const settingsRef = ref(database, 'settings');
    const snapshot = await get(settingsRef);
    if (snapshot.exists()) {
      const settings = snapshot.val();
      try { localStorage.setItem('cached_settings', JSON.stringify(settings)); } catch (e) { }
      return settings;
    }
  } catch (error) {
    try {
      const cached = localStorage.getItem('cached_settings');
      if (cached) return JSON.parse(cached);
    } catch (e) { }
  }
  return {};
};

export const updateSiteSettings = async (updates: Partial<SiteSettings>) => {
  const settingsRef = ref(database, 'settings');
  const cleaned = removeUndefinedDeep(updates);
  await update(settingsRef, cleaned);
};

// Slider Settings functions
export interface SliderSettings {
  mode: 'manual' | 'random';
  selectedContentIds: string[];
}

export const getSliderSettings = async (): Promise<SliderSettings> => {
  const sliderRef = ref(database, 'sliderSettings');
  const snapshot = await get(sliderRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return {
      mode: data.mode || 'random',
      selectedContentIds: data.selectedContentIds || []
    };
  }
  return { mode: 'random', selectedContentIds: [] };
};

export const updateSliderSettings = async (settings: SliderSettings) => {
  const sliderRef = ref(database, 'sliderSettings');
  const cleaned = removeUndefinedDeep(settings);
  await set(sliderRef, cleaned);
};


// ==========================================
// Netflix-style Profile Management (Sub-profiles)
// ==========================================
import type { Profile, Avatar } from '@/types/user';

export const getAccountProfiles = async (userId: string): Promise<Profile[]> => {
  const profilesRef = ref(database, `accountProfiles/${userId}`);
  const snapshot = await get(profilesRef);
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

export const createAccountProfile = async (userId: string, data: Omit<Profile, 'id' | 'userId' | 'createdAt'>) => {
  const profilesRef = ref(database, `accountProfiles/${userId}`);
  const newProfileRef = push(profilesRef);
  const profile: Profile = {
    ...data,
    id: newProfileRef.key!,
    userId,
    createdAt: new Date().toISOString(),
  };
  await set(newProfileRef, profile);
  return profile;
};

export const updateAccountProfile = async (userId: string, profileId: string, updates: Partial<Profile>) => {
  const profileRef = ref(database, `accountProfiles/${userId}/${profileId}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(profileRef, cleaned);
};

export const deleteAccountProfile = async (userId: string, profileId: string) => {
  const profileRef = ref(database, `accountProfiles/${userId}/${profileId}`);
  await remove(profileRef);
};

// ==========================================
// Avatar Management (Admin)
// ==========================================
export const getAvatars = async (): Promise<Avatar[]> => {
  const avatarsRef = ref(database, 'avatars');
  const snapshot = await get(avatarsRef);
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

export const addAvatar = async (url: string) => {
  const avatarsRef = ref(database, 'avatars');
  const newAvatarRef = push(avatarsRef);
  const avatar: Avatar = {
    id: newAvatarRef.key!,
    url,
    createdAt: new Date().toISOString(),
  };
  await set(newAvatarRef, avatar);
  return avatar;
};

export const deleteAvatar = async (avatarId: string) => {
  const avatarRef = ref(database, `avatars/${avatarId}`);
  await remove(avatarRef);
};

// ==========================================
// Admin User Management Helpers
// ==========================================
export const getAllUsers = async (): Promise<UserProfile[]> => {
  const usersRef = ref(database, 'profiles'); // 'profiles' stores User Account data
  const snapshot = await get(usersRef);
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

export const adminUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
  return updateUserProfile(userId, updates);
};

export const updateLastSeen = async (userId: string) => {
  const profileRef = ref(database, `profiles/${userId}`);
  await update(profileRef, { lastSeen: new Date().toISOString() });
};

export interface UserStats {
  total: number;
  active: number;
  online: number;
  offline: number;
}

export const subscribeToUserStats = (callback: (stats: UserStats) => void) => {
  const usersRef = ref(database, 'profiles');
  return onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      const users = Object.values(snapshot.val()) as UserProfile[];
      const now = new Date();
      const onlineThreshold = 5 * 60 * 1000; // 5 minutes

      const total = users.length;
      const active = users.filter(u => u.status === 'active').length;
      const online = users.filter(u => {
        if (!u.lastSeen) return false;
        const lastSeenDate = new Date(u.lastSeen);
        return now.getTime() - lastSeenDate.getTime() < onlineThreshold;
      }).length;
      const offline = total - online;

      callback({ total, active, online, offline });
    } else {
      callback({ total: 0, active: 0, online: 0, offline: 0 });
    }
  });
};

// ==========================================
// Progress Tracking (Continue Watching)
// ==========================================

export const saveUserProgress = async (progress: Omit<UserContentProgress, 'updatedAt'>) => {
  const { profileId, contentId, season, episode } = progress;
  // Unique path for progress: progress/{profileId}/{contentId}_{season || 0}_{episode || 0}
  const key = `${contentId}_${season || 0}_${episode || 0}`;
  const progressRef = ref(database, `userProgress/${profileId}/${key}`);

  const fullProgress: UserContentProgress = {
    ...progress,
    updatedAt: new Date().toISOString()
  };

  const cleaned = removeUndefinedDeep(fullProgress);
  await set(progressRef, cleaned);
};

export const getUserProgress = async (profileId: string, contentId: string, season?: number, episode?: number): Promise<UserContentProgress | null> => {
  const key = `${contentId}_${season || 0}_${episode || 0}`;
  const progressRef = ref(database, `userProgress/${profileId}/${key}`);
  const snapshot = await get(progressRef);

  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
};

export const getUserAllProgress = async (profileId: string): Promise<UserContentProgress[]> => {
  const progressRef = ref(database, `userProgress/${profileId}`);
  const snapshot = await get(progressRef);

  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
  }
  return [];
};

export { database, auth };
export type { Content };

export const signInAnonymously = async () => {
  const result = await firebaseSignInAnonymously(auth);
  const user = result.user;

  // Create profile for guest if not exists
  const profileRef = ref(database, `profiles/${user.uid}`);
  const snapshot = await get(profileRef);

  if (!snapshot.exists()) {
    const profile: UserProfile = {
      id: user.uid,
      email: 'convidado@unitvfilm.com', // Dummy email
      isPremium: false,
      subscriptionTier: 'free',
      planId: 'free',
      subscriptionExpiresAt: null,
      createdAt: new Date().toISOString()
    };
    await set(profileRef, profile);
  }

  return result;
};

// ==========================================
// Transfer Management (My Transfers)
// ==========================================
import type { TransferItem } from '@/types/user';

export const addTransfer = async (userId: string, item: Omit<TransferItem, 'id' | 'userId' | 'addedAt'>) => {
  const transfersRef = ref(database, `transfers/${userId}`);
  const newTransferRef = push(transfersRef);
  
  const transfer: TransferItem = {
    ...item,
    id: newTransferRef.key!,
    userId,
    addedAt: new Date().toISOString(),
  };

  const cleaned = removeUndefinedDeep(transfer);
  await set(newTransferRef, cleaned);
  return transfer;
};

export const getUserTransfers = async (userId: string): Promise<TransferItem[]> => {
  const transfersRef = ref(database, `transfers/${userId}`);
  const snapshot = await get(transfersRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    // Sort by addedAt descending
    return (Object.values(data) as TransferItem[]).sort((a, b) => 
      new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
    );
  }
  return [];
};


// Plan Management
export const getPlans = async (): Promise<Plan[]> => {
  const plansRef = ref(database, 'plans');
  const snapshot = await get(plansRef);
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

export const createPlan = async (plan: Omit<Plan, 'id'>) => {
  const plansRef = ref(database, 'plans');
  const newRef = push(plansRef);
  const planWithId = { ...plan, id: newRef.key as string };
  await set(newRef, planWithId);
  return planWithId;
};

export const updatePlan = async (id: string, updates: Partial<Plan>) => {
  await update(ref(database, `plans/${id}`), updates);
};

// Verification Codes
export const createVerificationCode = async (codeData: Omit<VerificationCode, 'id'>) => {
  const codesRef = ref(database, 'verification_codes');
  const newRef = push(codesRef);
  const codeWithId = { ...codeData, id: newRef.key as string };
  await set(newRef, codeWithId);
  return codeWithId;
};

export const verifyCode = async (code: string): Promise<VerificationCode | null> => {
  const codesRef = ref(database, 'verification_codes');
  const snapshot = await get(codesRef);
  if (snapshot.exists()) {
    const codes = Object.values(snapshot.val()) as VerificationCode[];
    const found = codes.find(c => c.code === code && !c.isUsed && new Date(c.expiresAt) > new Date());
    return found || null;
  }
  return null;
};

export const redeemCode = async (userId: string, codeId: string) => {
  await update(ref(database, `verification_codes/${codeId}`), {
    isUsed: true,
    usedBy: userId
  });
};

// Usage Tracking
export const incrementDailyUsage = async (userId: string, type: 'movie' | 'episode') => {
  const profileRef = ref(database, `profiles/${userId}`);
  const snapshot = await get(profileRef);
  if (!snapshot.exists()) return;

  const profile = snapshot.val() as UserProfile;
  const today = new Date().toISOString().split('T')[0];

  let stats = profile.credits;
  if (!stats || stats.date !== today) {
    stats = { date: today, moviesWatched: 0, episodesWatched: 0 };
  }

  if (type === 'movie') stats.moviesWatched++;
  if (type === 'episode') stats.episodesWatched++;

  await update(profileRef, { credits: stats });
};

export const assignPlanToUser = async (userId: string, planId: string) => {
  let duration = 30; // Default
  let limits = { maxProfiles: 2 }; // Default

  if (planId !== 'free') {
    const planSnapshot = await get(ref(database, `plans/${planId}`));
    if (planSnapshot.exists()) {
      const pData = planSnapshot.val();
      if (pData.durationDays) duration = pData.durationDays;
      if (pData.limits) limits = pData.limits;
    }
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + duration);

  await update(ref(database, `profiles/${userId}`), {
    planId: planId,
    subscriptionTier: planId === 'free' ? 'free' : 'premium',
    isPremium: planId !== 'free',
    subscriptionExpiresAt: planId === 'free' ? null : expires.toISOString(),
    status: 'active',
    // We optionally save limits here if AuthContext needs them, 
    // but planId *should* be enough if AuthContext fetches the plan.
    // However, saving metadata is safe.
    currentLimits: limits
  });
};

export const validatePin = async (userId: string, profileId: string, inputPin: string): Promise<{ success: boolean; locked?: boolean; remainingTime?: number }> => {
  const profileRef = ref(database, `accountProfiles/${userId}/${profileId}`);
  const snapshot = await get(profileRef);

  if (!snapshot.exists()) return { success: false };
  const p = snapshot.val() as Profile; // Actually it's Profile type from user.ts

  // Check Lockout
  if (p.lockoutUntil && new Date(p.lockoutUntil) > new Date()) {
    const remaining = Math.ceil((new Date(p.lockoutUntil).getTime() - new Date().getTime()) / 60000);
    return { success: false, locked: true, remainingTime: remaining };
  }

  if (p.pin === inputPin) {
    // Reset attempts on success
    if (p.pinAttempts && p.pinAttempts > 0) {
      await update(profileRef, { pinAttempts: 0, lockoutUntil: null });
    }
    return { success: true };
  } else {
    // Increment attempts
    const attempts = (p.pinAttempts || 0) + 1;
    const updates: any = { pinAttempts: attempts };

    if (attempts >= 3) {
      const lockout = new Date();
      lockout.setMinutes(lockout.getMinutes() + 15);
      updates.lockoutUntil = lockout.toISOString();
      await update(profileRef, updates);
      return { success: false, locked: true, remainingTime: 15 };
    } else {
      await update(profileRef, updates);
      return { success: false };
    }
  }
};

export const checkPlanExpiration = async (userId: string) => {
  const profileRef = ref(database, `profiles/${userId}`);
  const snapshot = await get(profileRef);
  if (snapshot.exists()) {
    const profile = snapshot.val() as UserProfile;
    if (profile.subscriptionExpiresAt) {
      const expires = new Date(profile.subscriptionExpiresAt);
      if (expires < new Date()) {
        // Expired! Downgrade to free
        await assignPlanToUser(userId, 'free');
        return true;
      }
    }
  }
  return false;
};

export const verifyRecoveryCode = async (code: string, userId: string) => {
  const codesRef = ref(database, 'verification_codes');
  const snapshot = await get(codesRef);

  if (snapshot.exists()) {
    const codes = snapshot.val();
    const foundCodeId = Object.keys(codes).find(key => {
      const c = codes[key];
      // Check code string, type, expiry, and ownership
      return c.code === code &&
        c.type === 'pin_reset' &&
        !c.isUsed &&
        new Date(c.expiresAt) > new Date() &&
        (c.usedBy === userId || !c.usedBy); // Optional binding
    });

    if (foundCodeId) {
      // Mark as used
      await update(ref(database, `verification_codes/${foundCodeId}`), {
        isUsed: true,
        usedAt: new Date().toISOString(),
        usedBy: userId
      });

      return { success: true };
    }
  }
  return { success: false };
};

export const createRecoveryCode = async (userId: string) => {
  // Admin function usually, but helper here for Admin Plans page
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newCodeRef = push(ref(database, 'verification_codes'));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await set(newCodeRef, {
    id: newCodeRef.key,
    code,
    type: 'pin_reset',
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    isUsed: false,
    usedBy: userId
  });
  return code;
};

// ==========================================
// Comment System Helpers
// ==========================================
import type { Comment } from '@/types/comment';

export const addComment = async (contentId: string, text: string, user: UserProfile, accountProfile?: Profile | null) => {
  if (!user) throw new Error("User profile (main) is missing");

  // Harden against partial UserProfile from incomplete legacy data
  const safeId = user.id || '';
  const safeEmail = user.email || '';
  const defaultName = safeEmail.split('@')[0] || 'Usuário';

  const commentsRef = ref(database, `comments/${contentId}`);
  const newCommentRef = push(commentsRef);

  // Determine display name and avatar
  const userName = accountProfile?.name || user.name || defaultName;
  const userAvatar = accountProfile?.avatar || accountProfile?.avatarUrl || user.photoURL || '';

  const comment: Comment = {
    id: newCommentRef.key!,
    contentId,
    userId: safeId,
    userName: userName,
    userAvatar: userAvatar,
    text: text.slice(0, 500),
    timestamp: Date.now()
  };

  const cleanComment = removeUndefinedDeep(comment);
  await set(newCommentRef, cleanComment);
  return cleanComment;
};

export const getComments = async (contentId: string): Promise<Comment[]> => {
  const commentsRef = ref(database, `comments/${contentId}`);
  const snapshot = await get(commentsRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    // Sort by newest first
    return Object.values(data).sort((a: any, b: any) => b.timestamp - a.timestamp) as Comment[];
  }
  return [];
};

export const deleteComment = async (contentId: string, commentId: string) => {
  const commentRef = ref(database, `comments/${contentId}/${commentId}`);
  await remove(commentRef);
};

// ==========================================
// Notification System
// ==========================================

export interface NotificationItem {
  id: string;
  type: 'new_content' | 'plan_expiry' | 'admin_message' | 'system';
  title: string;
  message: string;
  contentId?: string;
  isRead?: boolean; // For private
  createdAt: string;
  userId?: string; // For private
}

export interface GlobalNotification {
  id: string;
  type: 'new_content' | 'system';
  title: string;
  message: string;
  contentId?: string;
  imageUrl?: string; // Content poster image
  createdAt: string;
}

// 1. Create Private Notification
export const createNotification = async (userId: string, data: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>) => {
  const refNotif = ref(database, `notifications/${userId}`);
  const newRef = push(refNotif);
  const notification: NotificationItem = {
    ...data,
    id: newRef.key!,
    createdAt: new Date().toISOString(),
    isRead: false,
    userId
  };
  await set(newRef, notification);
  return notification;
};

// 2. Create Global Notification
export const createGlobalNotification = async (data: Omit<GlobalNotification, 'id' | 'createdAt'>) => {
  const refNotif = ref(database, 'globalNotifications');
  const newRef = push(refNotif);
  const notification: GlobalNotification = {
    ...data,
    id: newRef.key!,
    createdAt: new Date().toISOString()
  };
  await set(newRef, notification);
  // Auto-clean old globals? Maybe later.
  return notification;
};

// 3. Mark As Read
export const markNotificationRead = async (userId: string, notificationId: string, isGlobal = false) => {
  if (isGlobal) {
    await set(ref(database, `profiles/${userId}/readGlobalNotifications/${notificationId}`), true);
  } else {
    await update(ref(database, `notifications/${userId}/${notificationId}`), { isRead: true });
  }
};

// 4. Mark All Private Notifications as Read
export const markAllPrivateNotificationsRead = async (userId: string) => {
  const refNotif = ref(database, `notifications/${userId}`);
  const snapshot = await get(refNotif);
  if (snapshot.exists()) {
    const updates: any = {};
    Object.keys(snapshot.val()).forEach(key => {
      updates[`${key}/isRead`] = true;
    });
    await update(refNotif, updates);
  }
}

// 5. Check Plan Expiry (to be called on App init)
export const checkPlanExpiryNotification = async (userId: string) => {
  const profile = await getUserProfile(userId);
  if (!profile || !profile.subscriptionExpiresAt || profile.subscriptionTier === 'free') return;

  const expires = new Date(profile.subscriptionExpiresAt);
  const now = new Date();
  const diffTime = expires.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft <= 7 && daysLeft > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (profile.lastExpiryNotification === todayStr) return;

    if ([7, 3, 1].includes(daysLeft)) {
      await createNotification(userId, {
        type: 'plan_expiry',
        title: 'Plano Expirando',
        message: `Seu plano expira em ${daysLeft} dias. Renove para manter o acesso.`,
      });
      await update(ref(database, `profiles/${userId}`), { lastExpiryNotification: todayStr });
    }
  }
};

// 6. Send Content Notification (Manual)
export const sendContentNotification = async (contentId: string, contentTitle: string, category: string, imageUrl?: string) => {
  const typeLabel = category === 'movie' ? 'Novo Filme' : category === 'series' ? 'Nova Série' : 'Novo Canal';
  await createGlobalNotification({
    type: 'new_content',
    title: `${typeLabel} Adicionado`,
    message: `${contentTitle} já está disponível!`,
    contentId,
    imageUrl
  });
};

// 7. Clear All Notifications for User
export const clearAllNotifications = async (userId: string) => {
  const db = getDatabase();

  // First, get all global notifications to mark them as read
  const globalRef = ref(db, 'globalNotifications');
  const globalSnapshot = await get(globalRef);

  if (globalSnapshot.exists()) {
    const globals = globalSnapshot.val();
    const globalIds = Object.keys(globals);

    // Mark all global notifications as read for this user
    const updates: any = {};
    globalIds.forEach(id => {
      updates[`profiles/${userId}/readGlobalNotifications/${id}`] = true;
    });

    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
  }

  // Clear private notifications
  const privateRef = ref(db, `notifications/${userId}`);
  await remove(privateRef);
};

// ==========================================
// Voting System (Likes/Dislikes)
// ==========================================

export const voteContent = async (userId: string, contentId: string, vote: 'like' | 'dislike' | null) => {
  const { runTransaction } = await import('firebase/database');
  const voteRef = ref(database, `votes/${contentId}/${userId}`);
  const contentRef = ref(database, `contents/${contentId}`);

  // Get current vote
  const currentVoteSnapshot = await get(voteRef);
  const currentVote = currentVoteSnapshot.val();

  if (currentVote === vote) return; // No change

  // Update User Vote
  if (vote === null) {
    await remove(voteRef);
  } else {
    await set(voteRef, vote);
  }

  // Update Content Counters Transactionally
  await runTransaction(contentRef, (content) => {
    if (content) {
      if (!content.likes) content.likes = 0;
      if (!content.dislikes) content.dislikes = 0;

      // Remove old vote effect
      if (currentVote === 'like') content.likes--;
      if (currentVote === 'dislike') content.dislikes--;

      // Add new vote effect
      if (vote === 'like') content.likes++;
      if (vote === 'dislike') content.dislikes++;
    }
    return content;
  });
};

export const getUserVote = async (userId: string, contentId: string): Promise<'like' | 'dislike' | null> => {
  const voteRef = ref(database, `votes/${contentId}/${userId}`);
  const snapshot = await get(voteRef);
  return snapshot.exists() ? snapshot.val() : null;
};
