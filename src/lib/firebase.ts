import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, update, push } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import type { Content } from '@/types/content';
import type { UserProfile, MyListItem, SubscriptionTier } from '@/types/user';
import type { Ad } from '@/types/ad';
import type { Payment } from '@/types/payment';

// Firebase configuration for UniTvFilm
const firebaseConfig = {
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
export const signUp = async (email: string, password: string, subscriptionTier: SubscriptionTier = 'free') => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Create user profile
  const profile: UserProfile = {
    id: user.uid,
    email: user.email || '',
    isPremium: subscriptionTier !== 'free',
    subscriptionTier,
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

export const removeFromMyList = async (userId: string, itemId: string) => {
  const itemRef = ref(database, `myList/${userId}/${itemId}`);
  await remove(itemRef);
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

export { database, auth };
export type { Content };