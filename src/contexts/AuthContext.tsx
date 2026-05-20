import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { onAuthChange, logOut, isUserAdmin, getAccountProfiles, getPlans, subscribeToUserProfile, initializeOriginalAdmin, checkSubscriptionExpired, updateLastSeen, clearLastSeen } from '@/lib/firebase';
import type { UserProfile, Profile, Plan } from '@/types/user';
import type { Content } from '@/types/content';
import { useAppConfig } from '@/hooks/useAppConfig';

interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  currentProfile: Profile | null;
  plan: Plan | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  selectProfile: (profile: Profile) => void;
  refreshUser: () => Promise<void>;
  checkAccess: (content: Content & { isPremium?: boolean }) => { allowed: boolean; reason?: 'plan_limit' | 'premium_content' | 'no_credits' | null };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('unitv_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('unitv_cached_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(() => {
    try {
      const cached = localStorage.getItem('unitv_current_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [plan, setPlan] = useState<Plan | null>(() => {
    try {
      const cached = localStorage.getItem('unitv_cached_plan');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('unitv_cached_is_admin') === 'true';
  });
  const [loading, setLoading] = useState(true);
  const { isLiteMode } = useAppConfig();

  useEffect(() => {
    // Initialize the original admin on app start
    initializeOriginalAdmin().catch(console.error);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let lastAuthState: any = null;
    let authFlickerTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribeAuth = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        if (authFlickerTimer) {
          clearTimeout(authFlickerTimer);
          authFlickerTimer = null;
        }
        lastAuthState = firebaseUser;

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = undefined;
        }

        const simplifiedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          isAnonymous: firebaseUser.isAnonymous
        };
        setUser(simplifiedUser);
        localStorage.setItem('unitv_cached_user', JSON.stringify(simplifiedUser));

        unsubscribeProfile = subscribeToUserProfile(firebaseUser.uid, async (userProfile) => {

          if (userProfile && userProfile.subscriptionExpiresAt) {
            const isExpired = await checkSubscriptionExpired(firebaseUser.uid);
            if (isExpired) return;
          }
          setProfile(userProfile);

          if (userProfile) {
            localStorage.setItem('unitv_cached_user_profile', JSON.stringify(userProfile));

            const adminStatus = await isUserAdmin(firebaseUser.uid);
            setIsAdmin(adminStatus);
            localStorage.setItem('unitv_cached_is_admin', adminStatus ? 'true' : 'false');

            const plans = await getPlans();
            const currentPlanId = userProfile.planId || 'free';
            let activePlan = plans.find(p => p.id === currentPlanId);

            if (!activePlan && currentPlanId === 'trial_30d') {
              activePlan = {
                id: 'trial_30d',
                name: '30 Dias Grátis',
                description: 'Acesso Premium Ilimitado por 30 dias',
                price: 0,
                limits: { moviesPerDay: -1, episodesPerDay: -1, maxProfiles: 4, canDownload: true },
                isActive: true,
                requiresVerification: false
              };
            }

            if (!activePlan) {
              activePlan = plans.find(p => p.id === 'free') || null;
            }

            setPlan(activePlan);
            if (activePlan) {
              localStorage.setItem('unitv_cached_plan', JSON.stringify(activePlan));
            }
          }
        });

        const savedProfileId = localStorage.getItem('unitv_current_profile_id');
        if (savedProfileId) {
          const cachedProfileStr = localStorage.getItem('unitv_current_profile');
          if (cachedProfileStr) {
            try {
              const cachedProfile = JSON.parse(cachedProfileStr);
              if (cachedProfile && cachedProfile.id === savedProfileId) {
                setCurrentProfile(cachedProfile);
              }
            } catch (e) {
              console.error("Error parsing cached profile", e);
            }
          }

          try {
            const profilesPromise = getAccountProfiles(firebaseUser.uid);
            const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
            const profiles = await Promise.race([profilesPromise, timeoutPromise]);
            
            if (profiles) {
              const matched = profiles.find(p => p.id === savedProfileId);
              if (matched) {
                setCurrentProfile(matched);
                localStorage.setItem('unitv_current_profile', JSON.stringify(matched));
              }
            }
          } catch (e) {
            console.error("Error restoring profile in background", e);
          }
        }

        if (firebaseUser.isAnonymous) {
          const guestProfile: Profile = {
            id: 'guest',
            userId: firebaseUser.uid,
            name: 'Convidado',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
            isKids: false,
            createdAt: new Date().toISOString()
          };
          setCurrentProfile(guestProfile);
        }
      } else {
        const hasCachedUser = !!localStorage.getItem('unitv_cached_user');
        
        if (!hasCachedUser) {
          if (lastAuthState) {
            console.warn('[Auth] Received null auth state but cached user exists, waiting for recovery...');
            authFlickerTimer = setTimeout(() => {
              const cached = localStorage.getItem('unitv_cached_user');
              if (cached) {
                try {
                  const parsed = JSON.parse(cached);
                  setUser(parsed);
                } catch {}
              }
              authFlickerTimer = null;
            }, 3000);
            return;
          }

          setUser(null);
          setProfile(null);
          setPlan(null);
          setCurrentProfile(null);
          setIsAdmin(false);
        } else {
          console.warn('[Auth] Received null auth state but cached user exists, preserving session');
        }
      }
      setLoading(false);
    });

    return () => {
      if (authFlickerTimer) clearTimeout(authFlickerTimer);
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Presença/Heartbeat
  useEffect(() => {
    if (user?.uid) {
      const pName = currentProfile?.name;
      const pAvatar = currentProfile?.avatar;

      const update = () => {
        if (document.visibilityState === 'visible') {
          updateLastSeen(user.uid, pName, pAvatar).catch(console.error);
        }
      };

      // Atualizar imediatamente ao entrar
      updateLastSeen(user.uid, pName, pAvatar).catch(console.error);
  
      // Atualizar a cada 2 minutos
      const interval = setInterval(update, 2 * 60 * 1000);

      // Listen for visibility changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          updateLastSeen(user.uid, pName, pAvatar).catch(console.error);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Clean up on unload (best effort)
      const handleUnload = () => {
        clearLastSeen(user.uid).catch(() => {});
      };
      window.addEventListener('beforeunload', handleUnload);
  
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleUnload);
      };
    }
  }, [user, currentProfile]);

  const logout = async () => {
    if (user?.uid) {
      try {
        await clearLastSeen(user.uid);
      } catch (e) {
        console.error("Error clearing status on logout:", e);
      }
    }
    await logOut();
    setUser(null);
    setProfile(null);
    setPlan(null);
    setCurrentProfile(null);
    setIsAdmin(false);
    localStorage.removeItem('unitv_current_profile_id');
    localStorage.removeItem('unitv_current_profile');
    localStorage.removeItem('unitv_cached_user');
    localStorage.removeItem('unitv_cached_user_profile');
    localStorage.removeItem('unitv_cached_plan');
    localStorage.removeItem('unitv_cached_is_admin');
  };

  const selectProfile = (profile: Profile) => {
    setCurrentProfile(profile);
    localStorage.setItem('unitv_current_profile_id', profile.id);
    localStorage.setItem('unitv_current_profile', JSON.stringify(profile));
  };

  const refreshUser = async () => {
    if (user) {
      await getPlans();
    }
  };

  const checkAccess = (content: Content & { isPremium?: boolean }) => {
    // Lite mode TVs have completely unlimited access for now by design.
    if (isLiteMode) return { allowed: true };
    if (isAdmin || user?.email === 'www.nivaldo.com.ao@gmail.com') return { allowed: true };
    if (!profile || !plan) return { allowed: false, reason: 'no_credits' as const };

    if (content.isPremium || content.category === 'tv') {
      if (!profile.isPremium) {
        return { allowed: false, reason: 'premium_content' as const };
      }
    }

    const isSeries = content.category === 'series' || !!(content as any).episodeTitle;
    const limit = isSeries ? plan.limits.episodesPerDay : plan.limits.moviesPerDay;

    if (limit === -1) return { allowed: true };

    const today = new Date().toISOString().split('T')[0];
    const usage = profile.credits?.date === today
      ? (isSeries ? (profile.credits?.episodesWatched || 0) : (profile.credits?.moviesWatched || 0))
      : 0;

    if (usage >= limit) {
      return { allowed: false, reason: 'plan_limit' as const };
    }

    return { allowed: true };
  };

  return (
    <AuthContext.Provider value={{ user, profile, currentProfile, plan, isAdmin, loading, logout, selectProfile, refreshUser, checkAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
