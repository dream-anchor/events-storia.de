import { AuthProvider } from "@refinedev/core";
import { supabase } from "@/integrations/supabase/client";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";
import { getCachedAuth, clearCachedAdmin, loadAdminRole } from "@/lib/adminAuth";

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
      // Cache-first: Wenn Rolle bereits gecached ist, sofort durchlassen.
      // Session-Refresh läuft asynchron im Hintergrund.
      const cachedFirst = getCachedAuth();
      if (cachedFirst) {
        void supabase.auth.getSession().then(({ data }) => {
          if (!data?.session) clearCachedAdmin();
        });
        return { authenticated: true };
      }

      const { data } = await supabase.auth.getSession();

      if (!data?.session) {
        return { authenticated: false, redirectTo: "/admin/login" };
      }

      const userId = data.session.user.id;

      const role = await loadAdminRole(userId);
      if (role) return { authenticated: true };
    } catch (err) {
      console.error('Refine auth check error:', err);
      // Bei Fehler nicht hart auf Login schicken, wenn Cache vorhanden ist.
      const cached = getCachedAuth();
      if (cached) return { authenticated: true };
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

    const cached = getCachedAuth();
    if (cached?.userId === userId) {
      return [cached.role];
    }

    const role = await loadAdminRole(userId);
    return role ? [role] : [];
  },
};
