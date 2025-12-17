import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, logOut, isUserAdmin, getAccountProfiles, getPlans, subscribeToUserProfile } from '@/lib/firebase';
import type { UserProfile, Profile, Plan } from '@/types/user';
import type { Content } from '@/types/content';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  currentProfile: Profile | null;
  plan: Plan | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  selectProfile: (profile: Profile) => void;
  refreshUser: () => Promise<void>; // Kept for interface compatibility, though auto-updating
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

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      // Cleanup previous profile listener if exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (firebaseUser) {
        // Subscribe to Realtime Profile Changes
        unsubscribeProfile = subscribeToUserProfile(firebaseUser.uid, async (userProfile) => {
          setProfile(userProfile);

          if (userProfile) {
            // Check Admin Status
            const adminStatus = await isUserAdmin(firebaseUser.uid);
            setIsAdmin(adminStatus);

            // Update Plan
            const plans = await getPlans();
            const currentPlanId = userProfile.planId || 'free';
            const activePlan = plans.find(p => p.id === currentPlanId) || plans.find(p => p.id === 'free') || null;
            setPlan(activePlan);
          }
        });

        // Restore active profile (Client-side mainly, distinct from UserProfile)
        const savedProfileId = localStorage.getItem('unitv_current_profile_id');
        // Only if we haven't selected one yet
        if (savedProfileId) {
          try {
            // We fetch profiles once to restore selection
            const profiles = await getAccountProfiles(firebaseUser.uid);
            const matched = profiles.find(p => p.id === savedProfileId);
            if (matched) setCurrentProfile(matched);
          } catch (e) {
            console.error("Error restoring profile", e);
          }
        }

      } else {
        // User Logged Out
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
    // Logic is now handled by realtime subscription, but we can re-fetch plans manually if needed
    if (user) {
      const plans = await getPlans();
      // Profile updates come automatically via socket
    }
  };

  const checkAccess = (content: Content & { isPremium?: boolean }) => {
    if (isAdmin) return { allowed: true };
    if (!profile || !plan) return { allowed: false, reason: 'no_credits' as const };

    // 1. Check Content Premium vs Plan Verification
    if (content.isPremium || content.category === 'tv') {
      if (!profile.isPremium) {
        return { allowed: false, reason: 'premium_content' as const };
      }
    }

    // 2. Check Daily Limits (Credits)
    const isSeries = content.category === 'series' || !!(content as any).episodeTitle;
    const limit = isSeries ? plan.limits.episodesPerDay : plan.limits.moviesPerDay;

    if (limit === -1) return { allowed: true }; // Unlimited

    const usage = isSeries
      ? (profile.credits?.episodesWatched || 0)
      : (profile.credits?.moviesWatched || 0);

    // Should we allow if usage < limit?
    // If usage is 2, and limit is 2, allowed is FALSE.
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
