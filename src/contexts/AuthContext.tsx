import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, getUserProfile, logOut, isUserAdmin, getAccountProfiles } from '@/lib/firebase';
import type { UserProfile, Profile } from '@/types/user';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  currentProfile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  selectProfile: (profile: Profile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userProfile = await getUserProfile(firebaseUser.uid);
        setProfile(userProfile);

        // Check admin role
        const adminStatus = await isUserAdmin(firebaseUser.uid);
        setIsAdmin(adminStatus);

        // Restore active profile
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
      } else {
        setProfile(null);
        setCurrentProfile(null);
        setIsAdmin(false);
        localStorage.removeItem('unitv_current_profile_id');
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await logOut();
    setUser(null);
    setProfile(null);
    setCurrentProfile(null);
    setIsAdmin(false);
    localStorage.removeItem('unitv_current_profile_id');
  };

  const selectProfile = (p: Profile) => {
    setCurrentProfile(p);
    localStorage.setItem('unitv_current_profile_id', p.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, currentProfile, isAdmin, loading, logout, selectProfile }}>
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
