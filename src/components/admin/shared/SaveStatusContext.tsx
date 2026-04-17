/**
 * SaveStatusContext
 *
 * Zentraler Context für Auto-Save-Status im Admin. Jeder Editor
 * (OfferBuilder, MultiOffer, SmartInquiryEditor, OfferCreate) registriert
 * seinen aktuellen Status hier. Das AdminLayout zeigt einen einzigen,
 * konsistenten <SaveStatusBadge /> oben im Header.
 *
 * Design-Prinzipien (Senior CX):
 * - EIN Ort für die "Wahrheit": nie verschiedene Badges an verschiedenen Stellen
 * - Google-Docs-Style: immer sichtbar, aber dezent
 * - Fehlerfall ist prominent und persistent bis User reagiert
 * - Cmd+S triggert `flushAll()` für explizites Speichern
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Registration {
  id: string;
  status: SaveStatus;
  /** Optional: Editor kann einen "flush now" Handler registrieren für Cmd+S */
  flush?: () => Promise<void> | void;
  /** Optional: Fehlermeldung für Error-Status */
  errorMessage?: string;
}

interface SaveStatusContextValue {
  /** Aktueller aggregierter Status aller registrierten Editoren */
  status: SaveStatus;
  /** Letzte Fehlermeldung wenn status=error */
  errorMessage: string | null;
  /** Editor registriert sich beim Mount, ruft register() bei Status-Änderung */
  register: (id: string, status: SaveStatus, flush?: () => Promise<void> | void, errorMessage?: string) => void;
  /** Editor deregistriert sich beim Unmount */
  unregister: (id: string) => void;
  /** Cmd+S: triggert alle registrierten flush()-Handler */
  flushAll: () => Promise<void>;
  /** Ob aktuell Editors registriert sind (für Badge-Sichtbarkeit) */
  hasActiveEditors: boolean;
}

const SaveStatusContext = createContext<SaveStatusContextValue | null>(null);

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const registrationsRef = useRef<Map<string, Registration>>(new Map());
  const [version, setVersion] = useState(0); // Forces re-render on registration changes

  const register = useCallback((
    id: string,
    status: SaveStatus,
    flush?: () => Promise<void> | void,
    errorMessage?: string
  ) => {
    registrationsRef.current.set(id, { id, status, flush, errorMessage });
    setVersion(v => v + 1);
  }, []);

  const unregister = useCallback((id: string) => {
    registrationsRef.current.delete(id);
    setVersion(v => v + 1);
  }, []);

  const flushAll = useCallback(async () => {
    const promises: Promise<void>[] = [];
    for (const reg of registrationsRef.current.values()) {
      if (reg.flush) {
        const result = reg.flush();
        if (result instanceof Promise) promises.push(result);
      }
    }
    await Promise.allSettled(promises);
  }, []);

  // Aggregierter Status: error > saving > saved > idle
  const { status, errorMessage, hasActiveEditors } = useMemo(() => {
    const regs = Array.from(registrationsRef.current.values());
    const hasActive = regs.length > 0;

    if (!hasActive) {
      return { status: 'idle' as SaveStatus, errorMessage: null, hasActiveEditors: false };
    }

    // Priorität: error > saving > saved > idle
    const errorReg = regs.find(r => r.status === 'error');
    if (errorReg) {
      return { status: 'error' as SaveStatus, errorMessage: errorReg.errorMessage || 'Fehler beim Speichern', hasActiveEditors: true };
    }

    if (regs.some(r => r.status === 'saving')) {
      return { status: 'saving' as SaveStatus, errorMessage: null, hasActiveEditors: true };
    }

    if (regs.some(r => r.status === 'saved')) {
      return { status: 'saved' as SaveStatus, errorMessage: null, hasActiveEditors: true };
    }

    return { status: 'idle' as SaveStatus, errorMessage: null, hasActiveEditors: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // Cmd+S globaler Shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isSave = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's';
      if (isSave && registrationsRef.current.size > 0) {
        e.preventDefault();
        flushAll();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flushAll]);

  const value = useMemo(() => ({
    status,
    errorMessage,
    register,
    unregister,
    flushAll,
    hasActiveEditors,
  }), [status, errorMessage, register, unregister, flushAll, hasActiveEditors]);

  return (
    <SaveStatusContext.Provider value={value}>
      {children}
    </SaveStatusContext.Provider>
  );
}

/**
 * Hook für Editoren um ihren Save-Status an den Context zu melden.
 * Beispiel in einem Editor:
 *
 *   useRegisterSaveStatus('offer-builder', saveStatus, flushSave, errorMsg);
 */
export function useRegisterSaveStatus(
  id: string,
  status: SaveStatus,
  flush?: () => Promise<void> | void,
  errorMessage?: string,
) {
  const ctx = useContext(SaveStatusContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.register(id, status, flush, errorMessage);
    return () => ctx.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status, errorMessage]);
}

/**
 * Hook für das Badge im AdminLayout.
 */
export function useSaveStatus() {
  const ctx = useContext(SaveStatusContext);
  if (!ctx) {
    // Wenn das Admin-Layout den Provider vergessen hat, fallback auf "kein Editor aktiv"
    return {
      status: 'idle' as SaveStatus,
      errorMessage: null,
      hasActiveEditors: false,
      flushAll: async () => {},
    };
  }
  return {
    status: ctx.status,
    errorMessage: ctx.errorMessage,
    hasActiveEditors: ctx.hasActiveEditors,
    flushAll: ctx.flushAll,
  };
}
