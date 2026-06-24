import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLoader } from "@/components/admin/AdminLoader";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

/**
 * Shared role cache — also used by refine-auth-provider
 * to avoid redundant DB queries on page load.
 * Stores JSON: { userId, role }
 */
export const ADMIN_CACHE_KEY = 'sm_admin_verified';

export type AppRole = 'admin' | 'staff';

interface CachedAuth {
  userId: string;
  role: AppRole;
}

const SESSION_TIMEOUT_MS = 6000;
const ROLE_TIMEOUT_MS = 8000;

const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> => {
  const wrappedPromise = Promise.resolve(promise);

  return Promise.race([
    wrappedPromise,
    new Promise<never>((_, reject) => {
      const t: ReturnType<typeof setTimeout> = setTimeout(
        () => reject(new Error(`${label} timeout`)),
        timeoutMs
      );
      wrappedPromise.finally(() => clearTimeout(t));
    }),
  ]);
};

export function getCachedAuth(): CachedAuth | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_CACHE_KEY);
    if (!raw) return null;
    // Alter Cache-Format (nur userId) → re-auth erzwingen statt blind admin zu setzen
    if (!raw.startsWith('{')) return null;
    return JSON.parse(raw) as CachedAuth;
  } catch {
    return null;
  }
}

/** @deprecated — Verwende getCachedAuth() */
export function getCachedAdminUserId(): string | null {
  return getCachedAuth()?.userId ?? null;
}

export function setCachedAuth(userId: string, role: AppRole) {
  try {
    sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify({ userId, role }));
  } catch { /* ignore */ }
}

/** @deprecated — Verwende setCachedAuth() */
export function setCachedAdminUserId(userId: string) {
  setCachedAuth(userId, 'admin');
}

export function clearCachedAdmin() {
  try {
    sessionStorage.removeItem(ADMIN_CACHE_KEY);
  } catch { /* ignore */ }
}

/**
 * AdminAuthGuard - Prevents frontend flash on admin page reload.
 *
 * Strategy:
 * 1. getSession() reads from localStorage — instant, no network call
 * 2. If session exists, check sessionStorage cache for admin role
 * 3. If not cached, single DB query with try/catch
 * 4. Listen for SIGNED_OUT to clear and redirect
 */
export const AdminAuthGuard = ({ children }: AdminAuthGuardProps) => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const verifyRole = async (userId: string) => {
      const cached = getCachedAuth();
      if (cached?.userId === userId) {
        setAuthState('authenticated');
        return;
      }

      const { data: roleData, error } = await withTimeout(
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .in('role', ['admin', 'staff'])
          .maybeSingle(),
        ROLE_TIMEOUT_MS,
        'admin role check'
      );

      if (!mounted) return;

      if (error) {
        console.error('AdminAuthGuard: role check failed', error);
        setAuthState('unauthenticated');
        return;
      }

      if (roleData) {
        setCachedAuth(userId, roleData.role as AppRole);
        setAuthState('authenticated');
      } else {
        clearCachedAdmin();
        setAuthState('unauthenticated');
      }
    };

    const checkAuth = async () => {
      try {
        // Step 1: getSession() — reads from localStorage, no network call.
        // Timeout als Fallback falls Supabase nicht antwortet.
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
          'getSession'
        );
        const { data: { session } } = sessionResult;

        if (!mounted) return;

        if (!session?.user) {
          setAuthState('unauthenticated');
          return;
        }

        await verifyRole(session.user.id);
      } catch (err) {
        console.error('AdminAuthGuard: unexpected error', err);
        if (mounted) {
          setAuthState('unauthenticated');
        }
      }
    };

    checkAuth();

    // Listen for auth state changes.
    // iOS-Hinweis: Bei Token-Refresh feuert Supabase manchmal SIGNED_OUT gefolgt von
    // TOKEN_REFRESHED/SIGNED_IN. Deshalb bei diesen Events neu verifizieren statt blind auszuloggen.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT') {
          clearCachedAdmin();
          setAuthState('unauthenticated');
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (!session?.user) return;
          // Never run Supabase calls directly inside onAuthStateChange.
          // supabase-js can deadlock and make the following getSession()/query hang.
          setTimeout(() => {
            if (mounted) {
              verifyRole(session.user.id).catch((err) => {
                console.error('AdminAuthGuard: deferred role check failed', err);
              });
            }
          }, 0);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authState === 'loading') {
    return <AdminLoader />;
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
