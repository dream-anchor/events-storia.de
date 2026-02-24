import { useMemo } from "react";
import { getCachedAuth, type AppRole } from "@/components/admin/AdminAuthGuard";

/**
 * Hook für Admin vs. Staff Berechtigungen.
 * Liest die Rolle aus dem sessionStorage-Cache (wird von AdminAuthGuard gesetzt).
 */
export function usePermissions() {
  const cached = useMemo(() => getCachedAuth(), []);
  const role: AppRole = cached?.role ?? 'staff';
  const isAdmin = role === 'admin';

  return { role, isAdmin };
}
