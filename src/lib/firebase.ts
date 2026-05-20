import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, update, push, onValue, off, enableLogging } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously as firebaseSignInAnonymously, User } from 'firebase/auth';
import { getSupabaseClient, isSupabaseEnabled } from './supabase';

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

// --- IN-MEMORY CACHE FOR HIGH-PERFORMANCE SUPABASE AND DATABASE OPERATIONS ---
let inMemoryContents: Content[] | null = null;
let inMemoryContentsPromise: Promise<Content[]> | null = null;
let lastContentsFetchTime = 0;

let inMemorySettings: any = null;
let inMemorySettingsPromise: Promise<any> | null = null;
let lastSettingsFetchTime = 0;

// Cache TTL (Time-To-Live) in milliseconds: 5 minutes for general content, 3 minutes for settings
const CONTENTS_CACHE_TTL = 5 * 60 * 1000;
const SETTINGS_CACHE_TTL = 3 * 60 * 1000;

// Global server time offset in milliseconds
let serverTimeOffset = 0;
let timeSynced = false;

// Sync clock with the server (using same-origin request)
export const syncServerTime = async () => {
  if (timeSynced) return serverTimeOffset;
  if (typeof window === 'undefined') return 0;
  try {
    const start = Date.now();
    // Fetch same-origin (HEAD request) to get the server's Date header (bypasses CORS restrictions)
    const res = await fetch(window.location.origin, { method: 'HEAD' });
    const serverDateStr = res.headers.get('date');
    if (serverDateStr) {
      const serverTime = new Date(serverDateStr).getTime();
      const rtt = Date.now() - start; // Round-trip time
      const clientTime = start + rtt / 2; // Estimate client time when server responded
      serverTimeOffset = serverTime - clientTime;
      timeSynced = true;
      console.log(`[TimeSync] Server offset synced: ${serverTimeOffset}ms (RTT: ${rtt}ms)`);
    }
  } catch (e) {
    console.warn('[TimeSync] Failed to sync server time:', e);
  }
  return serverTimeOffset;
};

// Start the sync in the background
if (typeof window !== 'undefined') {
  syncServerTime().catch(console.error);
}

// Get the synchronized current Date object
export const getSyncedDate = () => {
  return new Date(Date.now() + serverTimeOffset);
};

// Invalidates the in-memory cache to force a fresh fetch
export const invalidateContentsCache = () => {
  inMemoryContents = null;
  inMemoryContentsPromise = null;
  lastContentsFetchTime = 0;
};

export const invalidateSettingsCache = () => {
  inMemorySettings = null;
  inMemorySettingsPromise = null;
  lastSettingsFetchTime = 0;
};

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
  invalidateContentsCache();
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const id = `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const cleaned = removeUndefinedDeep({ ...content, id });
      const { error } = await supabase.from('contents').insert(cleaned);
      if (error) throw error;
      return cleaned as Content;
    }
  }

  const contentRef = ref(database, 'contents');
  const newContentRef = push(contentRef);
  const base = removeUndefinedDeep(content);
  const contentWithId = removeUndefinedDeep({ ...base, id: newContentRef.key }) as Content;
  await set(newContentRef, contentWithId);

  return contentWithId;
};

export const getAllContents = async (): Promise<Content[]> => {
  const now = Date.now();
  // If in-memory cache is valid, return immediately (ultra-fast RAM response)
  if (inMemoryContents && (now - lastContentsFetchTime < CONTENTS_CACHE_TTL)) {
    return inMemoryContents;
  }

  // If a fetch is currently in-flight, return the existing promise (deduplication)
  if (inMemoryContentsPromise) {
    return inMemoryContentsPromise;
  }

  // Load from local storage cache immediately so UI renders in < 5ms (SWR pattern)
  let cachedData: Content[] | null = null;
  try {
    const cached = localStorage.getItem('cached_contents');
    if (cached) {
      cachedData = JSON.parse(cached);
      if (!inMemoryContents) {
        inMemoryContents = cachedData;
      }
    }
  } catch (e) {}

  // Spawn the background fetch
  inMemoryContentsPromise = (async () => {
    try {
      if (isSupabaseEnabled()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase.from('contents').select('*');
          if (error) throw error;
          const contents = (data || []) as Content[];
          
          inMemoryContents = contents;
          lastContentsFetchTime = Date.now();
          try {
            localStorage.setItem('cached_contents', JSON.stringify(contents));
          } catch (e) {}
          return contents;
        }
      }

      const contentRef = ref(database, 'contents');
      const snapshot = await get(contentRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const contents = Object.values(data) as Content[];
        
        inMemoryContents = contents;
        lastContentsFetchTime = Date.now();
        try {
          localStorage.setItem('cached_contents', JSON.stringify(contents));
        } catch (e) {}
        return contents;
      }
      return cachedData || [];
    } catch (error) {
      console.warn("Error fetching contents, using cache fallback...", error);
      return cachedData || [];
    } finally {
      inMemoryContentsPromise = null;
    }
  })();

  // Return cached data immediately if available, allowing the promise to resolve in the background
  if (cachedData && cachedData.length > 0) {
    return cachedData;
  }

  // If no cached data, await the active request
  return inMemoryContentsPromise;
};

export const getContentsByCategory = async (category: string): Promise<Content[]> => {
  const contents = await getAllContents();
  return contents.filter(content => content.category === category);
};

export const updateContent = async (id: string, updates: Partial<Content>) => {
  invalidateContentsCache();
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const cleaned = removeUndefinedDeep(updates);
      const { error } = await supabase.from('contents').update(cleaned).eq('id', id);
      if (error) throw error;
      return;
    }
  }

  const contentRef = ref(database, `contents/${id}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(contentRef, cleaned);
};

export const deleteContent = async (id: string) => {
  invalidateContentsCache();
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('contents').delete().eq('id', id);
      if (error) throw error;
      return;
    }
  }

  const contentRef = ref(database, `contents/${id}`);
  await remove(contentRef);
};

// Helper to sanitize profile updates against allowed PostgreSQL columns
const sanitizeProfilePayload = (updates: any) => {
  const allowedKeys = [
    'email', 'isPremium', 'subscriptionTier', 'planId', 'status',
    'subscriptionExpiresAt', 'createdAt', 'credits', 'currentLimits',
    'lastSeen', 'currentProfileName', 'currentProfileAvatar',
    'lastExpiryNotification', 'lastIPTVGeneratedAt', 'phone',
    'displayName', 'trialSignup'
  ];
  const cleaned: any = {};
  for (const key of allowedKeys) {
    if (updates[key] !== undefined) {
      cleaned[key] = updates[key];
    }
  }
  return cleaned;
};

// Authentication functions
export const signUp = async (email: string, password: string, subscriptionTier: SubscriptionTier = 'free', planId = 'free', status: 'active' | 'pending_payment' = 'active') => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error("Falha ao criar conta no Supabase");

      const profile: UserProfile = {
        id: user.id,
        email: user.email || email,
        isPremium: subscriptionTier !== 'free',
        subscriptionTier,
        planId,
        status,
        subscriptionExpiresAt: null,
        createdAt: new Date().toISOString(),
      };
      
      const { error: profileError } = await supabase.from('profiles').upsert(removeUndefinedDeep(profile));
      if (profileError) throw profileError;

      return { user: { uid: user.id, email: user.email } };
    }
  }

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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      // 1. Try to log in via Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If credentials failed, check if this is an existing migrated profile from Firebase RTDB backup
        const { data: profile, error: dbError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (!dbError && profile) {
          // Yes! This email exists in profiles table but has no Supabase Auth account.
          // Let's dynamically register them on-the-fly using the credentials they typed!
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (!signUpError && signUpData?.user) {
            const newUser = signUpData.user;
            const oldId = profile.id;
            const newId = newUser.id;

            // Transition all old ID records to the new Supabase UUID
            if (oldId !== newId) {
              const updatedProfile = {
                ...profile,
                id: newId,
                email: newUser.email || email,
              };
              
              // Clean payload for profiles upsert
              const sanitizedProfile = sanitizeProfilePayload(updatedProfile);
              await supabase.from('profiles').upsert({ id: newId, ...sanitizedProfile });
              
              // Delete old profile
              await supabase.from('profiles').delete().eq('id', oldId);

              // Update sub-profiles (account_profiles)
              await supabase.from('account_profiles').update({ userId: newId }).eq('userId', oldId);

              // Update my_list
              await supabase.from('my_list').update({ userId: newId }).eq('userId', oldId);

              // Update user_progress
              await supabase.from('user_progress').update({ userId: newId }).eq('userId', oldId);
            }

            return { user: { uid: newId, email: newUser.email } };
          }
        }
        throw error;
      }

      const user = data.user;
      if (!user) throw new Error("Usuário não encontrado");
      return { user: { uid: user.id, email: user.email } };
    }
  }

  return signInWithEmailAndPassword(auth, email, password);
};

export const logOut = async () => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return;
    }
  }
  return signOut(auth);
};

export const resetPassword = async (email: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return;
    }
  }
  const { sendPasswordResetEmail } = await import('firebase/auth');
  return sendPasswordResetEmail(auth, email);
};

export const onAuthChange = (callback: (user: any) => void) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      // 1. Initial check
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          callback({
            uid: session.user.id,
            email: session.user.email,
            isAnonymous: false
          });
        } else {
          callback(null);
        }
      }).catch(() => {
        callback(null);
      });

      // 2. State listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (session?.user) {
          callback({
            uid: session.user.id,
            email: session.user.email,
            isAnonymous: false
          });
        } else {
          callback(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }

  return onAuthStateChanged(auth, callback);
};

// User Profile functions
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  // Load from local storage cache immediately
  let cachedProfile: UserProfile | null = null;
  try {
    const cached = localStorage.getItem(`cached_profile_${userId}`);
    if (cached) cachedProfile = JSON.parse(cached);
  } catch (e) {}

  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Enforce a 5-second timeout on the Supabase network request
        const fetchPromise = supabase.from('profiles').select('*').eq('id', userId).single();
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
        
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
        if (error && error.code !== 'PGRST116') throw error;
        
        const profile = data as UserProfile | null;
        if (profile) {
          try {
            localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profile));
          } catch (e) {}
          return profile;
        }
        return cachedProfile;
      }
    } catch (error) {
      console.warn("Supabase error fetching user profile, using cache fallback...", error);
      return cachedProfile;
    }
  }

  try {
    const profileRef = ref(database, `profiles/${userId}`);
    const snapshot = await get(profileRef);
    if (snapshot.exists()) {
      const profile = snapshot.val() as UserProfile;
      try {
        localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profile));
      } catch (e) {}
      return profile;
    }
    return cachedProfile;
  } catch (error) {
    console.warn("RTDB error fetching user profile, using cache fallback...", error);
    return cachedProfile;
  }
};

export const subscribeToUserProfile = (userId: string, callback: (profile: UserProfile | null) => void) => {
  if (isSupabaseEnabled()) {
    getUserProfile(userId).then(callback).catch(console.error);
    const supabase = getSupabaseClient();
    if (supabase) {
      const channel = supabase
        .channel(`public:profiles:id=eq.${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          (payload: any) => {
            const updatedProfile = payload.new as UserProfile;
            if (updatedProfile) {
              try {
                localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(updatedProfile));
              } catch (e) {}
            }
            callback(updatedProfile);
          }
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }

  const profileRef = ref(database, `profiles/${userId}`);
  return onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      const profile = snapshot.val() as UserProfile;
      try {
        localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profile));
      } catch (e) {}
      callback(profile);
    } else {
      callback(null);
    }
  });
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  // Speculatively update local storage cache first
  try {
    const cached = localStorage.getItem(`cached_profile_${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      localStorage.setItem(`cached_profile_${userId}`, JSON.stringify({ ...parsed, ...updates }));
    }
  } catch (e) {}

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const sanitized = sanitizeProfilePayload(updates);
      const { error } = await supabase.from('profiles').upsert({ id: userId, ...sanitized });
      if (error) throw error;
      return;
    }
  }

  const profileRef = ref(database, `profiles/${userId}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(profileRef, cleaned);
};

// My List functions
export const addToMyList = async (userId: string, content: Content) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const id = `ml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const item: MyListItem = {
        id,
        contentId: content.id,
        content: removeUndefinedDeep(content),
        addedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from('my_list').insert({
        id,
        userId,
        contentId: content.id,
        content: item.content,
        addedAt: item.addedAt
      });
      if (error) throw error;
      return item;
    }
  }

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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('my_list').delete().eq('id', itemId);
      if (error) throw error;
      return;
    }
  }

  const itemRef = ref(database, `myList/${userId}/${itemId}`);
  await remove(itemRef);
};

export const deleteUserProfile = async (userId: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.from('account_profiles').delete().eq('userId', userId);
      await supabase.from('my_list').delete().eq('userId', userId);
      return;
    }
  }

  await remove(ref(database, `profiles/${userId}`));
  await remove(ref(database, `accountProfiles/${userId}`));
  await remove(ref(database, `myList/${userId}`));
};

export const getMyList = async (userId: string): Promise<MyListItem[]> => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('my_list').select('*').eq('userId', userId);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        contentId: row.contentId,
        content: row.content,
        addedAt: row.addedAt
      })) as MyListItem[];
    }
  }

  const myListRef = ref(database, `myList/${userId}`);
  const snapshot = await get(myListRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
  }
  return [];
};

export const isInMyList = async (userId: string, contentId: string): Promise<boolean> => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('my_list')
        .select('id')
        .eq('userId', userId)
        .eq('contentId', contentId);
      if (error) throw error;
      return (data || []).length > 0;
    }
  }

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
  if (!profile) return true;
  if (!profile.subscriptionExpiresAt) return false;

  const expiresAt = new Date(profile.subscriptionExpiresAt);
  const now = new Date();

  if (now > expiresAt) {
    // Assinatura expirada, atualizar para free
    await updateUserProfile(userId, {
      isPremium: false,
      subscriptionTier: 'free',
      planId: 'free',
      subscriptionExpiresAt: null,
    });
    return true;
  }

  return false;
};

// Admin role functions
export const isUserAdmin = async (userId: string): Promise<boolean> => {
  try {
    if (isSupabaseEnabled()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Fallback: check if user exists and email is www.nivaldo.com.ao@gmail.com
        const profile = await getUserProfile(userId);
        if (profile?.email === 'www.nivaldo.com.ao@gmail.com') {
          return true;
        }

        // Query admins table in Supabase
        const { data, error } = await supabase.from('admins').select('id').eq('id', userId).maybeSingle();
        if (!error && data) {
          return true;
        }
        return false;
      }
    }

    // Check in admins table in Firebase
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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('admins').select('id');
      if (!error && data) {
        return data.map((d: any) => d.id);
      }
      return [];
    }
  }

  const adminsRef = ref(database, 'admins');
  const snapshot = await get(adminsRef);
  if (snapshot.exists()) {
    return Object.keys(snapshot.val());
  }
  return [];
};

export const setUserAsAdmin = async (userId: string, email: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('admins').upsert({
        id: userId,
        email,
        createdAt: new Date().toISOString()
      });
      return;
    }
  }

  const adminRef = ref(database, `admins/${userId}`);
  await set(adminRef, {
    email,
    createdAt: new Date().toISOString()
  });
};

export const removeUserAdmin = async (userId: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.from('admins').delete().eq('id', userId);
      return;
    }
  }

  const adminRef = ref(database, `admins/${userId}`);
  await remove(adminRef);
};

// Initialize the original admin (www.nivaldo.com.ao@gmail.com)
export const initializeOriginalAdmin = async () => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('email', 'www.nivaldo.com.ao@gmail.com').maybeSingle();
      if (profile) {
        const { data: adminExists } = await supabase.from('admins').select('id').eq('id', profile.id).maybeSingle();
        if (!adminExists) {
          await supabase.from('admins').insert({
            id: profile.id,
            email: 'www.nivaldo.com.ao@gmail.com',
            createdAt: new Date().toISOString()
          });
        }
      }
      return;
    }
  }

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
  appUpdateNotes?: string;
  iptvApiKey?: string;
  iptvApiBaseUrl?: string;
  maintenanceModeEnabled?: boolean;
}

export const getSiteSettings = async (bypassCache?: boolean): Promise<SiteSettings> => {
  const now = Date.now();
  if (!bypassCache) {
    // If in-memory cache is valid, return immediately
    if (inMemorySettings && (now - lastSettingsFetchTime < SETTINGS_CACHE_TTL)) {
      return inMemorySettings;
    }

    // If a fetch is currently in-flight, return the existing promise (deduplication)
    if (inMemorySettingsPromise) {
      return inMemorySettingsPromise;
    }
  }

  // Load from local storage cache immediately so UI renders in < 5ms (SWR pattern)
  let cachedSettings: SiteSettings | null = null;
  if (!bypassCache) {
    try {
      const cached = localStorage.getItem('cached_settings');
      if (cached) {
        cachedSettings = JSON.parse(cached);
        if (!inMemorySettings) {
          inMemorySettings = cachedSettings;
        }
      }
    } catch (e) {}
  }

  // Spawn the background fetch
  const fetchPromise = (async () => {
    try {
      if (isSupabaseEnabled()) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase.from('settings').select('value').eq('key', 'site').single();
          if (error && error.code !== 'PGRST116') throw error;
          const settings = data?.value || {};
          
          if (!bypassCache) {
            inMemorySettings = settings;
            lastSettingsFetchTime = Date.now();
            try { localStorage.setItem('cached_settings', JSON.stringify(settings)); } catch (e) { }
          }
          return settings;
        }
      }

      const settingsRef = ref(database, 'settings');
      const snapshot = await get(settingsRef);
      if (snapshot.exists()) {
        const settings = snapshot.val();
        
        if (!bypassCache) {
          inMemorySettings = settings;
          lastSettingsFetchTime = Date.now();
          try { localStorage.setItem('cached_settings', JSON.stringify(settings)); } catch (e) { }
        }
        return settings;
      }
      return cachedSettings || {};
    } catch (error) {
      console.warn("Error fetching site settings:", error);
      return cachedSettings || {};
    }
  })();

  if (bypassCache) {
    return fetchPromise;
  }

  inMemorySettingsPromise = fetchPromise.finally(() => {
    inMemorySettingsPromise = null;
  });

  // Return cached data immediately if available, allowing the promise to resolve in the background
  if (cachedSettings) {
    return cachedSettings;
  }

  // If no cached data, await the active request
  return inMemorySettingsPromise;
};

export const updateSiteSettings = async (updates: Partial<SiteSettings>) => {
  invalidateSettingsCache();
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const current = await getSiteSettings();
      const merged = removeUndefinedDeep({ ...current, ...updates });
      const { error } = await supabase.from('settings').upsert({ key: 'site', value: merged });
      if (error) throw error;
      return;
    }
  }

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
  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.from('settings').select('value').eq('key', 'slider').single();
        if (error && error.code !== 'PGRST116') throw error;
        const val = data?.value || {};
        return {
          mode: val.mode || 'random',
          selectedContentIds: val.selectedContentIds || []
        };
      }
    } catch (error) {
      console.warn("Supabase error fetching slider settings:", error);
      return { mode: 'random', selectedContentIds: [] };
    }
  }

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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const cleaned = removeUndefinedDeep(settings);
      const { error } = await supabase.from('settings').upsert({ key: 'slider', value: cleaned });
      if (error) throw error;
      return;
    }
  }

  const sliderRef = ref(database, 'sliderSettings');
  const cleaned = removeUndefinedDeep(settings);
  await set(sliderRef, cleaned);
};


// ==========================================
// Netflix-style Profile Management (Sub-profiles)
// ==========================================
import type { Profile, Avatar } from '@/types/user';

export const getAccountProfiles = async (userId: string): Promise<Profile[]> => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('account_profiles').select('*').eq('userId', userId);
      if (error) throw error;
      return (data || []) as Profile[];
    }
  }

  const profilesRef = ref(database, `accountProfiles/${userId}`);
  const snapshot = await get(profilesRef);
  if (snapshot.exists()) {
    return Object.values(snapshot.val());
  }
  return [];
};

export const createAccountProfile = async (userId: string, data: Omit<Profile, 'id' | 'userId' | 'createdAt'>) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const id = `ap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const profilePayload = {
        id,
        userId,
        name: data.name,
        avatar: data.avatar,
        avatarUrl: data.avatar || '',
        isKids: data.isKids || false,
        pin: data.pin || null,
        pinAttempts: data.pinAttempts || 0,
        lockoutUntil: data.lockoutUntil || null,
        createdAt: new Date().toISOString(),
      };
      const { error } = await supabase.from('account_profiles').insert(removeUndefinedDeep(profilePayload));
      if (error) throw error;
      return {
        ...data,
        id,
        userId,
        createdAt: profilePayload.createdAt
      } as Profile;
    }
  }

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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const cleanUpdates: any = {};
      if (updates.name !== undefined) cleanUpdates.name = updates.name;
      if (updates.avatar !== undefined) cleanUpdates.avatar = updates.avatar;
      if (updates.isKids !== undefined) cleanUpdates.isKids = updates.isKids;
      if (updates.pin !== undefined) cleanUpdates.pin = updates.pin;
      if (updates.pinAttempts !== undefined) cleanUpdates.pinAttempts = updates.pinAttempts;
      if (updates.lockoutUntil !== undefined) cleanUpdates.lockoutUntil = updates.lockoutUntil;
      // also include avatarUrl if it was updated or matches avatar
      if (updates.avatar !== undefined) cleanUpdates.avatarUrl = updates.avatar;

      const { error } = await supabase.from('account_profiles').update(cleanUpdates).eq('userId', userId).eq('id', profileId);
      if (error) throw error;
      return;
    }
  }

  const profileRef = ref(database, `accountProfiles/${userId}/${profileId}`);
  const cleaned = removeUndefinedDeep(updates);
  await update(profileRef, cleaned);
};

export const deleteAccountProfile = async (userId: string, profileId: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('account_profiles').delete().eq('userId', userId).eq('id', profileId);
      if (error) throw error;
      return;
    }
  }

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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.error("Error fetching users from Supabase:", error);
        throw error;
      }
      const users = (data || []) as UserProfile[];
      return users.filter(u => u && u.id && u.email && !u.email.includes('anonymous') && u.email !== 'convidado@unitvfilm.com');
    }
  }

  const usersRef = ref(database, 'profiles'); // 'profiles' stores User Account data
  const snapshot = await get(usersRef);
  if (snapshot.exists()) {
    const firebaseUsers = Object.values(snapshot.val()) as UserProfile[];
    return firebaseUsers.filter(u => u && u.id && u.email && !u.email.includes('anonymous') && u.email !== 'convidado@unitvfilm.com');
  }
  return [];
};

export const adminUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
  return updateUserProfile(userId, updates);
};

export const updateLastSeen = async (userId: string, profileName?: string, profileAvatar?: string) => {
  const updates: any = { lastSeen: getSyncedDate().toISOString() };
  if (profileName) updates.currentProfileName = profileName;
  if (profileAvatar) updates.currentProfileAvatar = profileAvatar;

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) console.error("Error updating lastSeen in Supabase:", error);
      return;
    }
  }

  const profileRef = ref(database, `profiles/${userId}`);
  await update(profileRef, updates);
};

export const clearLastSeen = async (userId: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('profiles').update({ lastSeen: null }).eq('id', userId);
      if (error) console.error("Error clearing lastSeen in Supabase:", error);
      return;
    }
  }

  const profileRef = ref(database, `profiles/${userId}`);
  await update(profileRef, { lastSeen: null });
};

export const updateLastIPTVGeneration = async (userId: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('profiles').update({ lastIPTVGeneratedAt: new Date().toISOString() }).eq('id', userId);
      if (error) console.error("Error updating lastIPTVGeneratedAt in Supabase:", error);
      return;
    }
  }

  const profileRef = ref(database, `profiles/${userId}`);
  await update(profileRef, { lastIPTVGeneratedAt: new Date().toISOString() });
};

export interface UserStats {
  total: number;
  active: number;
  online: number;
  offline: number;
}

export const subscribeToUserStats = (callback: (stats: UserStats) => void) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const fetchAndReport = async () => {
        try {
          const { data, error } = await supabase.from('profiles').select('*');
          if (!error && data) {
            const users = (data || []) as UserProfile[];
            const filteredUsers = users.filter(u => u && u.id && u.email && !u.email.includes('anonymous') && u.email !== 'convidado@unitvfilm.com');
            const now = getSyncedDate();
            const onlineThreshold = 5 * 60 * 1000; // 5 minutes

            const total = filteredUsers.length;
            const active = filteredUsers.filter(u => u.status === 'active').length;
            const online = filteredUsers.filter(u => {
              if (!u.lastSeen) return false;
              const lastSeenDate = new Date(u.lastSeen);
              const diff = now.getTime() - lastSeenDate.getTime();
              return diff >= -10000 && diff < onlineThreshold;
            }).length;
            const offline = total - online;

            callback({ total, active, online, offline });
          }
        } catch (e) {
          console.error("Error in Supabase stats subscription:", e);
        }
      };

      fetchAndReport();
      const interval = setInterval(fetchAndReport, 15000); // Poll every 15 seconds for stats

      const channel = supabase
        .channel('public:profiles-stats')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            fetchAndReport();
          }
        )
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }

  const usersRef = ref(database, 'profiles');
  return onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      const users = Object.values(snapshot.val()) as UserProfile[];
      const filteredUsers = users.filter(u => u && u.id && u.email && !u.email.includes('anonymous') && u.email !== 'convidado@unitvfilm.com');
      const now = getSyncedDate();
      const onlineThreshold = 5 * 60 * 1000; // 5 minutes

      const total = filteredUsers.length;
      const active = filteredUsers.filter(u => u.status === 'active').length;
      const online = filteredUsers.filter(u => {
        if (!u.lastSeen) return false;
        const lastSeenDate = new Date(u.lastSeen);
        const diff = now.getTime() - lastSeenDate.getTime();
        return diff >= -10000 && diff < onlineThreshold;
      }).length;
      const offline = total - online;

      callback({ total, active, online, offline });
    } else {
      callback({ total: 0, active: 0, online: 0, offline: 0 });
    }
  });
};

export const subscribeToOnlineUsers = (callback: (users: UserProfile[]) => void) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const fetchAndReport = async () => {
        try {
          const { data, error } = await supabase.from('profiles').select('*');
          if (!error && data) {
            const users = (data || []) as UserProfile[];
            const filteredUsers = users.filter(u => u && u.id && u.email && !u.email.includes('anonymous') && u.email !== 'convidado@unitvfilm.com');
            const now = getSyncedDate();
            const onlineThreshold = 5 * 60 * 1000; // 5 minutes

            const onlineUsers = filteredUsers.filter(u => {
              if (!u.lastSeen) return false;
              const lastSeenDate = new Date(u.lastSeen);
              const diff = now.getTime() - lastSeenDate.getTime();
              return diff >= -10000 && diff < onlineThreshold;
            });

            callback(onlineUsers);
          }
        } catch (e) {
          console.error("Error in Supabase online users subscription:", e);
        }
      };

      fetchAndReport();
      const interval = setInterval(fetchAndReport, 15000); // Poll every 15 seconds

      const channel = supabase
        .channel('public:profiles-online')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            fetchAndReport();
          }
        )
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }

  const usersRef = ref(database, 'profiles');
  return onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      const users = Object.values(snapshot.val()) as UserProfile[];
      const filteredUsers = users.filter(u => u && u.id && u.email && !u.email.includes('anonymous') && u.email !== 'convidado@unitvfilm.com');
      const now = getSyncedDate();
      const onlineThreshold = 5 * 60 * 1000; // 5 minutes

      const onlineUsers = filteredUsers.filter(u => {
        if (!u.lastSeen) return false;
        const lastSeenDate = new Date(u.lastSeen);
        const diff = now.getTime() - lastSeenDate.getTime();
        return diff >= -10000 && diff < onlineThreshold;
      });

      callback(onlineUsers);
    } else {
      callback([]);
    }
  });
};

// ==========================================
// Progress Tracking (Continue Watching)
// ==========================================

export const saveUserProgress = async (progress: Omit<UserContentProgress, 'updatedAt'>) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { userId, profileId, contentId, season, episode } = progress;
      const key = `${contentId}_${season || 0}_${episode || 0}`;
      const id = `${profileId}_${key}`;
      const fullProgress: UserContentProgress = {
        ...progress,
        updatedAt: new Date().toISOString()
      };
      const { error } = await supabase.from('user_progress').upsert({
        id,
        userId: userId || null,
        profileId,
        contentId,
        season: season || 0,
        episode: episode || 0,
        lastPositionSeconds: progress.lastPositionSeconds,
        durationSeconds: progress.durationSeconds || null,
        updatedAt: fullProgress.updatedAt
      });
      if (error) throw error;
      return;
    }
  }

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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const key = `${contentId}_${season || 0}_${episode || 0}`;
      const id = `${profileId}_${key}`;
      const { data, error } = await supabase.from('user_progress').select('*').eq('id', id).single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;
      return {
        userId: data.userId,
        profileId: data.profileId,
        contentId: data.contentId,
        season: data.season,
        episode: data.episode,
        lastPositionSeconds: Number(data.lastPositionSeconds),
        durationSeconds: data.durationSeconds ? Number(data.durationSeconds) : undefined,
        updatedAt: data.updatedAt
      } as UserContentProgress;
    }
  }

  const key = `${contentId}_${season || 0}_${episode || 0}`;
  const progressRef = ref(database, `userProgress/${profileId}/${key}`);
  const snapshot = await get(progressRef);

  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
};

export const getUserAllProgress = async (profileId: string): Promise<UserContentProgress[]> => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from('user_progress').select('*').eq('profileId', profileId);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        userId: row.userId,
        profileId: row.profileId,
        contentId: row.contentId,
        season: row.season,
        episode: row.episode,
        lastPositionSeconds: Number(row.lastPositionSeconds),
        durationSeconds: row.durationSeconds ? Number(row.durationSeconds) : undefined,
        updatedAt: row.updatedAt
      })) as UserContentProgress[];
    }
  }

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

export const deleteTransfer = async (userId: string, transferId: string) => {
  const transferRef = ref(database, `transfers/${userId}/${transferId}`);
  await remove(transferRef);
};

export const clearAllTransfers = async (userId: string) => {
  const transfersRef = ref(database, `transfers/${userId}`);
  await remove(transfersRef);
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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: p, error } = await supabase
        .from('account_profiles')
        .select('*')
        .eq('userId', userId)
        .eq('id', profileId)
        .maybeSingle();

      if (error || !p) return { success: false };

      // Check Lockout
      if (p.lockoutUntil && new Date(p.lockoutUntil) > new Date()) {
        const remaining = Math.ceil((new Date(p.lockoutUntil).getTime() - new Date().getTime()) / 60000);
        return { success: false, locked: true, remainingTime: remaining };
      }

      if (p.pin === inputPin) {
        // Reset attempts on success
        if (p.pinAttempts && p.pinAttempts > 0) {
          await supabase
            .from('account_profiles')
            .update({ pinAttempts: 0, lockoutUntil: null })
            .eq('userId', userId)
            .eq('id', profileId);
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
          await supabase
            .from('account_profiles')
            .update(updates)
            .eq('userId', userId)
            .eq('id', profileId);
          return { success: false, locked: true, remainingTime: 15 };
        } else {
          await supabase
            .from('account_profiles')
            .update(updates)
            .eq('userId', userId)
            .eq('id', profileId);
          return { success: false };
        }
      }
    }
  }

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
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: c, error } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('code', code)
        .eq('type', 'pin_reset')
        .eq('isUsed', false)
        .maybeSingle();

      if (!error && c && new Date(c.expiresAt) > new Date()) {
        await supabase
          .from('verification_codes')
          .update({
            isUsed: true,
            usedAt: new Date().toISOString(),
            usedBy: userId
          })
          .eq('id', c.id);

        return { success: true };
      }
      return { success: false };
    }
  }

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
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const id = `vc_${Date.now()}`;
      await supabase.from('verification_codes').insert({
        id,
        code,
        type: 'pin_reset',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        isUsed: false,
        usedBy: userId
      });
      return code;
    }
  }

  const newCodeRef = push(ref(database, 'verification_codes'));
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

export const updateUserActivity = async (
  userId: string,
  activity: {
    currentPage?: string;
    currentWatchingId?: string | null;
    currentWatchingTitle?: string | null;
    sessionStartAt?: string | null;
    deviceType?: string;
  }
) => {
  const updates: any = {
    lastSeen: getSyncedDate().toISOString(),
    ...activity
  };

  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) console.error("Error updating user activity in Supabase:", error);
      return;
    }
  }

  const profileRef = ref(database, `profiles/${userId}`);
  await update(profileRef, updates);
};

export const logActivityHistory = async (userId: string, pageName: string, deviceType: string) => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.from('activity_logs').insert([
        { user_id: userId, page_name: pageName, device_type: deviceType }
      ]);
      if (error && error.code !== '42P01') {
        // 42P01 means table does not exist yet. We ignore it if not created.
        console.error("Error inserting activity log:", error);
      }
    }
  } else {
    // Fallback to Firebase if Supabase not used
    const logRef = push(ref(database, 'activity_logs'));
    await set(logRef, {
      userId,
      pageName,
      deviceType,
      createdAt: getSyncedDate().toISOString()
    });
  }
};

export const getActivityLogs = async (): Promise<any[]> => {
  if (isSupabaseEnabled()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      // Fetch the last 1000 logs for performance, or fetch all if needed
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) {
        if (error.code !== '42P01') console.error("Error fetching activity logs:", error);
        return [];
      }
      return data || [];
    }
  } else {
    const logsRef = ref(database, 'activity_logs');
    const snapshot = await get(logsRef);
    if (!snapshot.exists()) return [];
    
    const logs: any[] = [];
    snapshot.forEach((child) => {
      logs.push({ id: child.key, ...child.val() });
    });
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return [];
};
