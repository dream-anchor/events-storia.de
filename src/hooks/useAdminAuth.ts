import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearCachedAdmin, getCachedAuth, loadAdminRole } from "@/lib/adminAuth";

export const useAdminAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkRole = async (userId: string) => {
      const cached = getCachedAuth();
      if (cached?.userId === userId) {
        if (mounted) {
          setIsAdmin(true);
          setLoading(false);
        }
        return;
      }
      const role = await loadAdminRole(userId);
      if (!mounted) return;
      if (role) {
        setIsAdmin(true);
      } else {
        clearCachedAdmin();
        setIsAdmin(false);
      }
      setLoading(false);
    };

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            if (mounted) checkRole(session.user.id);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // Race-Schutz: nur loggen, wenn wirklich keine Session
          setTimeout(async () => {
            if (!mounted) return;
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;
            if (!data?.session?.user) {
              clearCachedAdmin();
              setIsAdmin(false);
              setLoading(false);
            }
          }, 0);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          checkRole(session.user.id);
        } else {
          clearCachedAdmin();
          setIsAdmin(false);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading admin session:', err);
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return { error };

    if (!data.user) {
      return { error: new Error('Anmeldung konnte nicht bestätigt werden') };
    }

    // Kurz warten, damit der Supabase-Client das neue JWT an PostgREST bindet,
    // bevor wir die Rolle abfragen. Verhindert Race mit onAuthStateChange.
    await new Promise<void>((resolve) => {
      const t: ReturnType<typeof setTimeout> = setTimeout(resolve, 150);
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          clearTimeout(t);
          sub.subscription.unsubscribe();
          resolve();
        }
      });
    });

    console.info('[adminAuth] signIn: loading role');
    const role = await loadAdminRole(data.user.id);
    console.info('[adminAuth] signIn: role =', role);
    if (!role) {
      await supabase.auth.signOut();
      clearCachedAdmin();
      return { error: new Error('Keine Admin-Berechtigung für dieses Konto') };
    }
    // Optimistisch State setzen, damit Guards sofort durchlassen
    setUser(data.user);
    setSession(data.session);
    setIsAdmin(true);
    setLoading(false);

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
