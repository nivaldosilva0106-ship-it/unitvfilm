import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile, logOut, isUserAdmin, getAccountProfiles, getPlans } from '@/lib/firebase';
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
  refreshUser: () => Promise<void>;
  checkAccess: (content: Content & { isPremium?: boolean }) => { allowed: boolean; reason?: 'plan_limit' | 'premium_content' | 'no_credits' | null };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (firebaseUser: User) => {
    try {
      const userProfile = await getUserProfile(firebaseUser.uid);
      setProfile(userProfile);

      // Check admin
      const adminStatus = await isUserAdmin(firebaseUser.uid);
      setIsAdmin(adminStatus);

      // Load Plans and Current Plan
      const plans = await getPlans();
      const currentPlanId = userProfile.planId || 'free';
      const activePlan = plans.find(p => p.id === currentPlanId) || plans.find(p => p.id === 'free') || null;
      setPlan(activePlan);

      // Restore active profile
      const savedProfileId = localStorage.getItem('unitv_current_profile_id');
      if (savedProfileId && !currentProfile) {
        const profiles = await getAccountProfiles(firebaseUser.uid);
        const matched = profiles.find(p => p.id === savedProfileId);
        if (matched) setCurrentProfile(matched);
      }
    } catch (e) {
      console.error("Error fetching user data", e);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        setProfile(null);
        setPlan(null);
        setCurrentProfile(null);
        setIsAdmin(false);
        localStorage.removeItem('unitv_current_profile_id');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshUser = async () => {
    if (user) await fetchUserData(user);
  };

  const logout = async () => {
    await logOut();
    setUser(null);
    setProfile(null);
    setPlan(null);
    setCurrentProfile(null);
    setIsAdmin(false);
    localStorage.removeItem('unitv_current_profile_id');
  };

  const selectProfile = (p: Profile) => {
    setCurrentProfile(p);
    localStorage.setItem('unitv_current_profile_id', p.id);
  };

  const checkAccess = (content: any): { allowed: boolean; reason?: 'plan_limit' | 'premium_content' | 'no_credits' | null } => {
    if (!profile || !plan) return { allowed: false, reason: 'no_credits' };
    if (isAdmin) return { allowed: true };

    // 1. Premium Content Check
    if (content.isPremium && !profile.isPremium) {
      return { allowed: false, reason: 'premium_content' };
    }

    // 2. Daily Limits Check
    const today = new Date().toISOString().split('T')[0];
    const credits = profile.credits?.date === today ? profile.credits : { date: today, moviesWatched: 0, episodesWatched: 0 };

    if (content.category === 'series') {
      if (plan.limits.episodesPerDay !== -1 && credits.episodesWatched >= plan.limits.episodesPerDay) {
        return { allowed: false, reason: 'plan_limit' };
      }
    } else {
      if (plan.limits.moviesPerDay !== -1 && credits.moviesWatched >= plan.limits.moviesPerDay) {
        return { allowed: false, reason: 'plan_limit' };
      }
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
