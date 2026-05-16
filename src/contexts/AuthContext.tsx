import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User } from 'firebase/auth';
import { onAuthChange, logOut, isUserAdmin, getAccountProfiles, getPlans, subscribeToUserProfile, initializeOriginalAdmin, checkSubscriptionExpired, updateLastSeen } from '@/lib/firebase';
import type { UserProfile, Profile, Plan } from '@/types/user';
import type { Content } from '@/types/content';
import { useAppConfig } from '@/hooks/useAppConfig';

interface AuthContextType {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isLiteMode } = useAppConfig();

  useEffect(() => {
    // Initialize the original admin on app start
    initializeOriginalAdmin().catch(console.error);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (firebaseUser) {
        unsubscribeProfile = subscribeToUserProfile(firebaseUser.uid, async (userProfile) => {
          if (userProfile && userProfile.subscriptionExpiresAt) {
            const isExpired = await checkSubscriptionExpired(firebaseUser.uid);
            if (isExpired) return; // The DB update will trigger a new onValue tick
          }
          setProfile(userProfile);

          if (userProfile) {
            const adminStatus = await isUserAdmin(firebaseUser.uid);
            setIsAdmin(adminStatus);

            const plans = await getPlans();
            const currentPlanId = userProfile.planId || 'free';
            const activePlan = plans.find(p => p.id === currentPlanId) || plans.find(p => p.id === 'free') || null;
            setPlan(activePlan);
          }
        });

        const savedProfileId = localStorage.getItem('unitv_current_profile_id');
        if (savedProfileId) {
          try {
            const profiles = await getAccountProfiles(firebaseUser.uid);
            const matched = profiles.find(p => p.id === savedProfileId);
            if (matched) setCurrentProfile(matched);
          } catch (e) {
            console.error("Error restoring profile", e);
          }
        }

        // Auto-select dummy profile for Guest users
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
        setProfile(null);
        setPlan(null);
        setCurrentProfile(null);
        setIsAdmin(false);
        localStorage.removeItem('unitv_current_profile_id');
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Presença/Heartbeat
  useEffect(() => {
    if (user?.uid) {
      // Atualizar imediatamente ao entrar
      updateLastSeen(user.uid, currentProfile?.name, currentProfile?.avatar).catch(console.error);
  
      // Atualizar a cada 2 minutos
      const interval = setInterval(() => {
        updateLastSeen(user.uid, currentProfile?.name, currentProfile?.avatar).catch(console.error);
      }, 2 * 60 * 1000);
  
      return () => clearInterval(interval);
    }
  }, [user, currentProfile]);

  const logout = async () => {
    await logOut();
    setUser(null);
    setProfile(null);
    setPlan(null);
    setCurrentProfile(null);
    setIsAdmin(false);
    localStorage.removeItem('unitv_current_profile_id');
  };

  const selectProfile = (profile: Profile) => {
    setCurrentProfile(profile);
    localStorage.setItem('unitv_current_profile_id', profile.id);
  };

  const refreshUser = async () => {
    if (user) {
      await getPlans();
    }
  };

  const checkAccess = (content: Content & { isPremium?: boolean }) => {
    // Lite mode TVs have completely unlimited access for now by design.
    if (isLiteMode) return { allowed: true };
    if (isAdmin) return { allowed: true };
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
