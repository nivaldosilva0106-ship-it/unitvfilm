import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, update, push, onValue, off } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously as firebaseSignInAnonymously, User } from 'firebase/auth';

import type { Content } from '@/types/content';
import type { UserProfile, MyListItem, SubscriptionTier, Plan, VerificationCode } from '@/types/user';
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

  // Trigger Global Notification
  try {
    const typeLabel = content.type === 'movie' ? 'Novo Filme' : content.type === 'series' ? 'Nova Série' : 'Novo Canal';
    await createGlobalNotification({
      type: 'new_content',
      title: `${typeLabel} Adicionado`,
      message: `${content.title} já está disponível!`,
      contentId: contentWithId.id
    });
  } catch (e) {
    console.error("Error sending notification", e);
  }

  return contentWithId;
};

export const getAllContents = async (): Promise<Content[]> => {
  const contentRef = ref(database, 'contents');
  const snapshot = await get(contentRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
  }
  return [];
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

// Ad Management functions
export const addAd = async (ad: Omit<Ad, 'id'>) => {
  const adRef = ref(database, 'ads');
  const newAdRef = push(adRef);
  const adWithId = removeUndefinedDeep({ ...ad, id: newAdRef.key }) as Ad;
  await set(newAdRef, adWithId);
  return adWithId;
};

export const getAllAds = async (): Promise<Ad[]> => {
  const adRef = ref(database, 'ads');
  const snapshot = await get(adRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
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

  // Atualizar perfil do usuário
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 mês

  await updateUserProfile(payment.userId, {
    isPremium: true,
    subscriptionTier: payment.subscriptionTier,
    subscriptionExpiresAt: expiresAt.toISOString(),
  });
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
    const profile = await getUserProfile(userId);
    return profile?.email === 'www.nivaldo.com.ao@gmail.com';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
};

// Site Settings functions
export interface SiteSettings {
  loginBackgroundUrl?: string;
}

export const getSiteSettings = async (): Promise<SiteSettings> => {
  const settingsRef = ref(database, 'settings');
  const snapshot = await get(settingsRef);
  if (snapshot.exists()) {
    return snapshot.val();
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
    return snapshot.val();
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

  if (planId !== 'free') {
    const planSnapshot = await get(ref(database, `plans/${planId}`));
    if (planSnapshot.exists()) {
      const pData = planSnapshot.val();
      if (pData.durationDays) duration = pData.durationDays;
    }
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + duration);

  await update(ref(database, `profiles/${userId}`), {
    planId: planId,
    subscriptionTier: planId === 'free' ? 'free' : 'premium',
    isPremium: planId !== 'free',
    subscriptionExpiresAt: planId === 'free' ? null : expires.toISOString(),
    status: 'active'
  });
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