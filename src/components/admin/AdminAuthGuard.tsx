import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

// Cache admin role in sessionStorage to avoid repeated DB queries on reload
const ADMIN_CACHE_KEY = 'sm_admin_verified';

function getCachedAdmin(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_CACHE_KEY);
  } catch {
    return null;
  }
}

function setCachedAdmin(userId: string) {
  try {
    sessionStorage.setItem(ADMIN_CACHE_KEY, userId);
  } catch { /* ignore */ }
}

function clearCachedAdmin() {
  try {
    sessionStorage.removeItem(ADMIN_CACHE_KEY);
  } catch { /* ignore */ }
}

/**
 * AdminAuthGuard - Wraps admin routes to prevent frontend flash on reload.
 * Uses onAuthStateChange INITIAL_SESSION for fast session retrieval,
 * and caches admin role in sessionStorage to skip DB query on reload.
 */
export const AdminAuthGuard = ({ children }: AdminAuthGuardProps) => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const location = useLocation();
  const checkedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const verifyAdmin = async (userId: string) => {
      // Check cache first — same session, same user = skip DB query
      const cached = getCachedAdmin();
      if (cached === userId) {
        if (mounted) setAuthState('authenticated');
        return;
      }

      // Query DB for admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

      if (!mounted) return;

      if (roleData) {
        setCachedAdmin(userId);
        setAuthState('authenticated');
      } else {
        clearCachedAdmin();
        setAuthState('unauthenticated');
      }
    };

    // Use onAuthStateChange — fires INITIAL_SESSION immediately from cache
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session?.user) {
          clearCachedAdmin();
          setAuthState('unauthenticated');
          return;
        }

        // INITIAL_SESSION or SIGNED_IN — verify admin role
        if (session?.user && !checkedRef.current) {
          checkedRef.current = true;
          await verifyAdmin(session.user.id);
        }
      }
    );

    // Fallback: if onAuthStateChange hasn't fired after 2s, check manually
    const fallbackTimer = setTimeout(async () => {
      if (!mounted || checkedRef.current) return;
      checkedRef.current = true;

      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!session?.user) {
        setAuthState('unauthenticated');
        return;
      }
      await verifyAdmin(session.user.id);
    }, 2000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Loading state - Full screen admin-branded loader
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

  // Not authenticated - redirect to login
  if (authState === 'unauthenticated') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Authenticated - render children
  return <>{children}</>;
};
