import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerProfile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  delivery_street: string | null;
  delivery_city: string | null;
  delivery_zip: string | null;
  delivery_country: string | null;
  delivery_floor: string | null;
  has_elevator: boolean | null;
  billing_name: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_zip: string | null;
  billing_country: string | null;
}

interface CustomerAuthContextType {
  user: User | null;
  session: Session | null;
  profile: CustomerProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signup: (email: string, password: string, name?: string) => Promise<{ data: any; error: any }>;
  logout: () => Promise<{ error: any }>;
  updateProfile: (updates: Partial<CustomerProfile>) => Promise<{ data: any; error: any }>;
  refreshProfile: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileFetched, setProfileFetched] = useState(false);

  // Fetch profile data - only once per user
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // No profile yet is not a real error for new users
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
        return null;
      }
      return data as CustomerProfile;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user && !profileFetched) {
        fetchProfile(session.user.id).then((p) => {
          if (isMounted) {
            setProfile(p);
            setProfileFetched(true);
          }
        });
      }
      setLoading(false);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Only fetch profile if user changed or not yet fetched
          if (!profileFetched || event === 'SIGNED_IN') {
            // Use setTimeout to avoid Supabase auth deadlock
            setTimeout(() => {
              fetchProfile(session.user.id).then((p) => {
                if (isMounted) {
                  setProfile(p);
                  setProfileFetched(true);
                }
              });
            }, 0);
          }
        } else {
          setProfile(null);
          setProfileFetched(false);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, profileFetched]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name || '',
        }
      }
    });
    return { data, error };
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfileFetched(false);
    }
    return { error };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<CustomerProfile>) => {
    if (!user) return { data: null, error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('customer_profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data as CustomerProfile);
    }
    return { data, error };
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const newProfile = await fetchProfile(user.id);
      setProfile(newProfile);
    }
  }, [user, fetchProfile]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    loading,
    login,
    signup,
    logout,
    updateProfile,
    refreshProfile,
  }), [user, session, profile, loading, login, signup, logout, updateProfile, refreshProfile]);

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
};
