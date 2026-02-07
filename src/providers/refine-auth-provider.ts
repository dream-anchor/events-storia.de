import { AuthProvider } from "@refinedev/core";
import { supabase } from "@/integrations/supabase/client";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";
import { getCachedAdminUserId, setCachedAdminUserId, clearCachedAdmin } from "@/components/admin/AdminAuthGuard";

export const supabaseAuthProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: error.message,
        },
      };
    }

    if (data?.session) {
      return {
        success: true,
        redirectTo: "/admin",
      };
    }

    return {
      success: false,
      error: {
        name: "LoginError",
        message: "Invalid credentials",
      },
    };
  },

  logout: async () => {
    clearCachedAdmin();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        error: {
          name: "LogoutError",
          message: error.message,
        },
      };
    }

    return {
      success: true,
      redirectTo: "/admin/login",
    };
  },

  check: async () => {
    try {
      const { data } = await supabase.auth.getSession();

      if (!data?.session) {
        return { authenticated: false, redirectTo: "/admin/login" };
      }

      const userId = data.session.user.id;

      // Use shared cache — AdminAuthGuard already verified this
      if (getCachedAdminUserId() === userId) {
        return { authenticated: true };
      }

      // Fallback: query DB (should rarely happen since AdminAuthGuard runs first)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (roles && roles.length > 0) {
        setCachedAdminUserId(userId);
        return { authenticated: true };
      }
    } catch (err) {
      console.error('Refine auth check error:', err);
    }

    return { authenticated: false, redirectTo: "/admin/login" };
  },

  getIdentity: async () => {
    // Use getSession() instead of getUser() — getSession reads from cache, getUser makes network call
    const { data } = await supabase.auth.getSession();

    if (data?.session?.user) {
      return {
        id: data.session.user.id,
        email: data.session.user.email,
        name: getAdminDisplayName(data.session.user.email),
      };
    }

    return null;
  },

  onError: async (error) => {
    console.error(error);
    return { error };
  },

  getPermissions: async () => {
    const { data } = await supabase.auth.getSession();

    if (!data?.session) return [];

    const userId = data.session.user.id;

    // If cached as admin, return immediately
    if (getCachedAdminUserId() === userId) {
      return ['admin'];
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    return roles?.map(r => r.role) || [];
  },
};
