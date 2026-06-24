import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLoader } from "@/components/admin/AdminLoader";
import {
  ADMIN_CACHE_KEY,
  clearCachedAdmin,
  getCachedAuth,
  loadAdminRole,
  setCachedAuth,
  type AppRole,
} from "@/lib/adminAuth";

// Re-exports for backward compatibility
export { ADMIN_CACHE_KEY, clearCachedAdmin, getCachedAuth, setCachedAuth };
export type { AppRole };

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

/** @deprecated — Verwende getCachedAuth() */
export function getCachedAdminUserId(): string | null {
  return getCachedAuth()?.userId ?? null;
}

/** @deprecated — Verwende setCachedAuth() */
export function setCachedAdminUserId(userId: string) {
  setCachedAuth(userId, 'admin');
}

/**
 * AdminAuthGuard
 * - Solange eine Session vorhanden ist, niemals auf "unauthenticated" springen.
 * - Rolle wird einmalig geladen und gecached.
 * - SIGNED_OUT führt nur dann zum Logout, wenn auch wirklich keine Session mehr da ist
 *   (verhindert false-positive Redirects beim Token-Refresh).
 */
export const AdminAuthGuard = ({ children }: AdminAuthGuardProps) => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const verifyRole = async (userId: string) => {
      // Falls bereits gecached → sofort authenticated.
      const cached = getCachedAuth();
      if (cached?.userId === userId) {
        if (mounted) setAuthState('authenticated');
        return;
      }

      const role = await loadAdminRole(userId);
      if (!mounted) return;

      if (role) {
        setAuthState('authenticated');
      } else {
        clearCachedAdmin();
        setAuthState('unauthenticated');
      }
    };

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session?.user) {
          setAuthState('unauthenticated');
          return;
        }

        await verifyRole(session.user.id);
      } catch (err) {
        console.error('AdminAuthGuard: unexpected error', err);
        // Bei Netzwerkfehler: nicht hart ausloggen, wenn Cache passt.
        if (!mounted) return;
        const cached = getCachedAuth();
        setAuthState(cached ? 'authenticated' : 'unauthenticated');
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT') {
          // Race-Schutz: erst nach Microtask prüfen, ob wirklich keine Session mehr da ist.
          setTimeout(async () => {
            if (!mounted) return;
            const { data } = await supabase.auth.getSession();
            if (!mounted) return;
            if (!data?.session?.user) {
              clearCachedAdmin();
              setAuthState('unauthenticated');
            }
          }, 0);
          return;
        }
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (!session?.user) return;
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
