import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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

    const checkAuth = async () => {
      try {
        // Step 1: getSession() — reads from localStorage, no network call
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          setAuthState('unauthenticated');
          return;
        }

        const userId = session.user.id;

        // Step 2: Check sessionStorage cache
        const cached = getCachedAuth();
        if (cached?.userId === userId) {
          setAuthState('authenticated');
          return;
        }

        // Step 3: Single DB query for admin or staff role — with timeout
        const roleCheck = supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .in('role', ['admin', 'staff'])
          .maybeSingle();

        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timeout')), 8000)
        );

        const { data: roleData, error } = await Promise.race([roleCheck, timeout]);

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
      } catch (err) {
        console.error('AdminAuthGuard: unexpected error', err);
        if (mounted) {
          setAuthState('unauthenticated');
        }
      }
    };

    checkAuth();

    // Listen for sign out to clear cache and redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT') {
          clearCachedAdmin();
          setAuthState('unauthenticated');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101922] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary size-12 rounded-lg flex items-center justify-center text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground">StoriaMaestro</h1>
            <p className="text-sm text-muted-foreground">Wird geladen...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
