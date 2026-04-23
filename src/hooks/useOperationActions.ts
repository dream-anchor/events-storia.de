import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OperationKind = "catering" | "booking" | "inquiry";

export function useOperationActions() {
  const qc = useQueryClient();

  const completeOperation = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: OperationKind }) => {
      const table = kind === "catering" ? "catering_orders" : kind === "booking" ? "event_bookings" : "event_inquiries";
      const { error } = await (supabase.from(table as never) as unknown as { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } })
        .update({ status: "completed" })
        .eq("id", id);
      if (error) throw error as Error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-data"] });
      toast.success("Als erledigt markiert");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Fehler: ${msg}`);
    },
  });

  const skipReminder = useMutation({
    mutationFn: async ({ kind, id }: { kind: string; id: string }) => {
      // id format from useUpcomingReminders: "task-<id>", "cat-<id>", "pay-<id>", "offer-<id>"
      const [prefix, ...rest] = id.split("-");
      const realId = rest.join("-");
      const updater = (table: string, payload: Record<string, unknown>) =>
        (supabase.from(table as never) as unknown as { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } })
          .update(payload).eq("id", realId);
      if (prefix === "task") {
        const { error } = await updater("inquiry_tasks", { reminder_sent: true });
        if (error) throw error as Error;
      } else if (prefix === "cat") {
        const { error } = await updater("catering_orders", { reminder_sent_at: new Date().toISOString() });
        if (error) throw error as Error;
      } else if (prefix === "offer") {
        const { data: row } = await (supabase.from("event_inquiries" as never) as unknown as { select: (c: string) => { eq: (c: string, v: string) => { single: () => Promise<{ data: { reminder_count?: number } | null }> } } })
          .select("reminder_count").eq("id", realId).single();
        const cnt = (row?.reminder_count ?? 0) + 1;
        const { error } = await updater("event_inquiries", { reminder_count: cnt, reminder_sent_at: new Date().toISOString() });
        if (error) throw error as Error;
      } else {
        throw new Error("Diese Erinnerung kann nicht übersprungen werden");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["upcoming-reminders"] });
      toast.success("Erinnerung übersprungen");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Fehler: ${msg}`);
    },
  });

  return { completeOperation, skipReminder };
}