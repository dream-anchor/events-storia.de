import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OperationKind = "catering" | "booking" | "inquiry";

export function useOperationActions() {
  const qc = useQueryClient();

  const completeOperation = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: OperationKind }) => {
      if (kind === "catering") {
        const { error } = await supabase
          .from("catering_orders")
          .update({ status: "completed" })
          .eq("id", id);
        if (error) throw error;
      } else if (kind === "booking") {
        const { error } = await supabase
          .from("event_bookings")
          .update({ status: "completed" })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_inquiries")
          .update({ status: "completed" })
          .eq("id", id);
        if (error) throw error;
      }
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
      if (prefix === "task") {
        const { error } = await supabase
          .from("inquiry_tasks" as never)
          .update({ reminder_sent: true })
          .eq("id", realId);
        if (error) throw error;
      } else if (prefix === "cat") {
        const { error } = await supabase
          .from("catering_orders")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", realId);
        if (error) throw error;
      } else if (prefix === "offer") {
        // Bump reminder_count to suppress
        const { data: row } = await supabase
          .from("event_inquiries" as never)
          .select("reminder_count")
          .eq("id", realId)
          .single();
        const cnt = ((row as { reminder_count?: number } | null)?.reminder_count ?? 0) + 1;
        const { error } = await supabase
          .from("event_inquiries" as never)
          .update({ reminder_count: cnt, reminder_sent_at: new Date().toISOString() })
          .eq("id", realId);
        if (error) throw error;
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