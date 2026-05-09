import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  name?: string;
  email: string;
  role: 'aideur' | 'demandeur' | 'admin';
  university?: string;
  school?: string;
  city?: string;
  level?: string;
  gender?: 'male' | 'female';
  avatar_url?: string;
  profile_picture?: string;
  bio?: string;
  rating?: number;
  skills?: string[];
  projects?: any[];
  banned?: boolean;
  suspended?: boolean;
}

interface AuthContextType {
  user: User | null;
  role: 'aideur' | 'demandeur' | 'admin';
  login: (userData: User, token: string) => void;
  logout: () => void;
  switchRole: () => void;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  updateUserProfile: (updates: Partial<User>) => Promise<{ error: any | null }>;
  resetPassword: (email: string) => Promise<{ error: any | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: any | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'aideur' | 'demandeur' | 'admin'>('demandeur');
  const [isLoading, setIsLoading] = useState(true);

  const getDefaultAvatar = (seed: string, gender?: 'male' | 'female') => {
    if (gender === 'female') {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&gender=female`;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&gender=male`;
  };

  const loadUserFromSupabase = async () => {
    try {
      const isAdminSession = localStorage.getItem('admin_session') === 'true';
      if (isAdminSession) {
        const adminUser: User = {
          id: '5636739d-0d77-4da6-9a35-0fb1a2c217a4',
          first_name: 'Super',
          last_name: 'Admin',
          name: 'Super Admin',
          email: 'admin@uniskills.ma',
          role: 'admin',
          city: 'Casablanca',
          university: 'Uniskills',
          level: '',
          gender: 'male',
          avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
          bio: 'Super Administrateur',
          rating: 5,
          skills: [],
          banned: false,
          suspended: false
        };
        setUser(adminUser);
        setRole('admin');
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
        }
        
        if (profile) {
          if (profile.banned) {
            await supabase.auth.signOut();
            setUser(null);
            setIsLoading(false);
            return;
          }

          let avatarUrl = profile.avatar_url;
          if (!avatarUrl) {
            avatarUrl = getDefaultAvatar(profile.id || profile.email || 'user', profile.gender);
          }
          
          const userData: User = {
            id: profile.id,
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            email: profile.email,
            role: profile.role === 'admin' ? 'admin' : ((localStorage.getItem('role') as 'aideur' | 'demandeur') || profile.role || 'demandeur'),
            university: profile.university || '',
            city: profile.city || '',
            level: profile.level || '',
            gender: profile.gender || 'male',
            avatar_url: avatarUrl,
            bio: profile.bio || '',
            rating: profile.rating || 0,
            skills: profile.skills || [],
            banned: profile.banned || false,
            suspended: profile.suspended || false
          };
          setUser(userData);
          setRole(userData.role);
        } else if (session.user) {
          const defaultAvatar = getDefaultAvatar(session.user.id, 'male');
          const newProfile = {
            id: session.user.id,
            email: session.user.email,
            first_name: session.user.user_metadata?.first_name || '',
            last_name: session.user.user_metadata?.last_name || '',
            avatar_url: defaultAvatar,
            gender: session.user.user_metadata?.gender || 'male',
            level: session.user.user_metadata?.level || '',
            role: 'demandeur',
            created_at: new Date().toISOString()
          };
          
          const { error: insertError } = await supabase
            .from('users')
            .insert([newProfile]);
          
          if (insertError) {
            console.error('Error creating profile:', insertError);
          }
          
          setUser({
            id: newProfile.id,
            first_name: newProfile.first_name,
            last_name: newProfile.last_name,
            name: `${newProfile.first_name} ${newProfile.last_name}`.trim(),
            email: newProfile.email || '',
            role: 'demandeur',
            avatar_url: defaultAvatar,
            gender: 'male',
            level: ''
          });
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Error loading user:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserFromSupabase();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadUserFromSupabase();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('role');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = (userData: User, token: string) => {
    setUser(userData);
    setRole(userData.role);
    localStorage.setItem('role', userData.role);
  };

  const logout = async () => {
    if (localStorage.getItem('admin_session')) {
      localStorage.removeItem('admin_session');
      setUser(null);
      localStorage.removeItem('role');
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('role');
  };

  const switchRole = () => {
    const newRole = role === 'aideur' ? 'demandeur' : 'aideur';
    setRole(newRole);
    localStorage.setItem('role', newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user?.id) return { error: 'No user logged in' };
    
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);
    
    if (!error) {
      setUser({ ...user, ...updates });
    }
    
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ 
      user, role, login, logout, switchRole, 
      setUser, isLoading, 
      updateUserProfile, resetPassword, updatePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};