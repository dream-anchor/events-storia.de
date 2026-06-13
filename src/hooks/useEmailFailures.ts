import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const FAILURE_STATUSES = ["failed", "bounced", "complained", "suppressed"] as const;

export interface EmailFailure {
  id: string;
  entity_type: string;
  entity_id: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  provider: string;
  sent_at: string;
  metadata: Record<string, unknown> | null;
}

function isUnresolved(row: { status: string; metadata: Record<string, unknown> | null }): boolean {
  if (!FAILURE_STATUSES.includes(row.status as typeof FAILURE_STATUSES[number])) return false;
  const m = row.metadata ?? {};
  return !m.resolved_at;
}

/** Realtime subscription that invalidates email-failure caches */
function useFailuresRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("email-failures")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_delivery_logs" },
        () => {
          qc.invalidateQueries({ queryKey: ["email-failures"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

/** Email failures for a specific inquiry/entity */
export function useEmailFailuresForEntity(entityId: string | undefined) {
  useFailuresRealtime();
  return useQuery({
    queryKey: ["email-failures", "entity", entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<EmailFailure[]> => {
      const { data, error } = await supabase
        .from("email_delivery_logs")
        .select("*")
        .eq("entity_id", entityId!)
        .in("status", FAILURE_STATUSES as unknown as string[])
        .order("sent_at", { ascending: false });
      if (error) {
        console.error("useEmailFailuresForEntity error", error);
        return [];
      }
      return ((data as unknown as EmailFailure[]) || []).filter(isUnresolved);
    },
  });
}

/** All unresolved email failures (last 30 days) — for dashboard + list indicators */
export function useGlobalEmailFailures() {
  useFailuresRealtime();
  return useQuery({
    queryKey: ["email-failures", "global"],
    queryFn: async (): Promise<EmailFailure[]> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("email_delivery_logs")
        .select("*")
        .in("status", FAILURE_STATUSES as unknown as string[])
        .gte("sent_at", since)
        .order("sent_at", { ascending: false });
      if (error) {
        console.error("useGlobalEmailFailures error", error);
        return [];
      }
      return ((data as unknown as EmailFailure[]) || []).filter(isUnresolved);
    },
    staleTime: 30_000,
  });
}

/** Set of entity_ids with unresolved failures (Map for O(1) lookup) */
export function useEntityFailureIndex(): { ids: Set<string>; count: number; isLoading: boolean } {
  const { data, isLoading } = useGlobalEmailFailures();
  const ids = new Set<string>((data || []).map((r) => r.entity_id));
  return { ids, count: data?.length ?? 0, isLoading };
}

/** Mark a failure as resolved */
export async function resolveEmailFailure(id: string, currentMetadata: Record<string, unknown> | null) {
  const merged = {
    ...(currentMetadata ?? {}),
    resolved_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("email_delivery_logs")
    .update({ metadata: merged } as never)
    .eq("id", id);
  if (error) throw error;
}