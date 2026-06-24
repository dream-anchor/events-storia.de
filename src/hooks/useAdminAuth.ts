import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearCachedAdmin, getCachedAuth, setCachedAuth, type AppRole } from "@/components/admin/AdminAuthGuard";

const SESSION_TIMEOUT_MS = 6000;
const ROLE_TIMEOUT_MS = 8000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const t: ReturnType<typeof setTimeout> = setTimeout(
        () => reject(new Error(`${label} timeout`)),
        timeoutMs
      );
      promise.finally(() => clearTimeout(t));
    }),
  ]);
};

export const useAdminAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role check to avoid deadlock
        if (session?.user) {
          setLoading(true);
          setTimeout(() => {
            if (mounted) checkAdminRole(session.user.id);
          }, 0);
        } else {
          clearCachedAdmin();
          setIsAdmin(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, 'getSession')
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          checkAdminRole(session.user.id);
        } else {
          clearCachedAdmin();
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading admin session:', err);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminRole = async (userId: string) => {
    try {
      const cached = getCachedAuth();
      if (cached?.userId === userId) {
        setIsAdmin(true);
        setLoading(false);
        return;
      }

      const { data, error } = await withTimeout(
        supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .in('role', ['admin', 'staff'])
        .maybeSingle(),
        ROLE_TIMEOUT_MS,
        'admin role check'
      );

      if (error) {
        clearCachedAdmin();
        setIsAdmin(false);
      } else {
        if (data?.role) {
          setCachedAuth(userId, data.role as AppRole);
        } else {
          clearCachedAdmin();
        }
        setIsAdmin(!!data);
      }
    } catch (err) {
      console.error('Error checking admin role:', err);
      clearCachedAdmin();
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/admin-login`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    isAdmin,
    loading,
    signIn,
    signUp,
    signOut,
  };
};
