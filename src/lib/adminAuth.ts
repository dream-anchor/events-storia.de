import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff";

const CACHE_KEY = "sm_admin_verified";
const ROLE_TIMEOUT_MS = 8000;

interface CachedAuth {
  userId: string;
  role: AppRole;
}

export function getCachedAuth(): CachedAuth | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw || !raw.startsWith("{")) return null;
    return JSON.parse(raw) as CachedAuth;
  } catch {
    return null;
  }
}

export function setCachedAuth(userId: string, role: AppRole): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, role }));
  } catch {
    /* ignore */
  }
}

export function clearCachedAdmin(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export const ADMIN_CACHE_KEY = CACHE_KEY;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  const wrapped = Promise.resolve(promise);
  return Promise.race([
    wrapped,
    new Promise<never>((_, reject) => {
      const t: ReturnType<typeof setTimeout> = setTimeout(
        () => reject(new Error(`${label} timeout`)),
        ms,
      );
      wrapped.finally(() => clearTimeout(t));
    }),
  ]);
}

/**
 * Lädt die Admin-/Staff-Rolle für einen Benutzer.
 * Nutzt zuerst den Cache, fragt sonst die DB.
 * Wirft NICHT — gibt bei Fehler `null` zurück, damit der Aufrufer entscheiden kann.
 */
export async function loadAdminRole(userId: string): Promise<AppRole | null> {
  const cached = getCachedAuth();
  if (cached?.userId === userId) return cached.role;

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "staff"]),
      ROLE_TIMEOUT_MS,
      "admin role check",
    );

    if (error) {
      console.error("[adminAuth] role query failed", error);
      return null;
    }
    if (!data || data.length === 0) return null;

    const role: AppRole = data.some((r) => r.role === "admin") ? "admin" : "staff";
    setCachedAuth(userId, role);
    return role;
  } catch (err) {
    console.error("[adminAuth] role check error", err);
    return null;
  }
}

/**
 * Prüft die aktuelle Session und lädt die Rolle.
 * Liefert `{ userId, role }` bei erfolgreicher Admin-/Staff-Authentifizierung.
 */
export async function resolveCurrentAdmin(): Promise<{ userId: string; role: AppRole } | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return null;

    const role = await loadAdminRole(userId);
    if (!role) return null;
    return { userId, role };
  } catch (err) {
    console.error("[adminAuth] resolveCurrentAdmin error", err);
    return null;
  }
}