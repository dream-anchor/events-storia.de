import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

/**
 * AdminAuthGuard - Wraps admin routes to prevent frontend flash on reload
 *
 * This component checks authentication BEFORE rendering any admin content.
 * It shows a full-screen loading state with admin branding while checking,
 * preventing the brief flash of frontend content on page reload.
 */
export const AdminAuthGuard = ({ children }: AdminAuthGuardProps) => {
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          setAuthState('unauthenticated');
          return;
        }

        // Check admin role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();

        if (!mounted) return;

        if (roleData) {
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      } catch {
        if (mounted) {
          setAuthState('unauthenticated');
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setAuthState('unauthenticated');
        } else if (event === 'SIGNED_IN' && session) {
          // Re-check admin role on sign in
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'admin')
            .single();

          if (mounted) {
            setAuthState(roleData ? 'authenticated' : 'unauthenticated');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
