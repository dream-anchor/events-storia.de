import { AuthProvider } from "@refinedev/core";
import { supabase } from "@/integrations/supabase/client";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";

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
    const { data } = await supabase.auth.getSession();

    if (data?.session) {
      // Check if user has admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.session.user.id)
        .eq('role', 'admin');

      if (roles && roles.length > 0) {
        return {
          authenticated: true,
        };
      }
    }

    return {
      authenticated: false,
      redirectTo: "/admin/login",
    };
  },

  getIdentity: async () => {
    const { data } = await supabase.auth.getUser();

    if (data?.user) {
      return {
        id: data.user.id,
        email: data.user.email,
        name: getAdminDisplayName(data.user.email),
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

    if (data?.session) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.session.user.id);

      return roles?.map(r => r.role) || [];
    }

    return [];
  },
};
