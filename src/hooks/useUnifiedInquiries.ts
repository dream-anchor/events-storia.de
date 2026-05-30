import { useList } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CateringOrder } from "@/types/refine";
import {
  type InquiryRecord,
  type V2EventRow,
  mapV2Event,
  mapOrder,
} from "@/types/inquiryRecord";
import { useTestMode } from "@/contexts/TestModeContext";

export function useUnifiedInquiries() {
  const { showTestData } = useTestMode();

  const eventsQuery = useQuery({
    queryKey: ["unified-v2-events", showTestData],
    queryFn: async (): Promise<V2EventRow[]> => {
      let q = supabase
        .from("v2_events")
        .select(
          "id, customer_id, number, status, offer_phase, service_type, date, date_end, time_from, time_to, guest_count, occasion, amount_total, is_test, archived, archived_at, offer_slug, booking_number, customer_language, created_at, updated_at, v2_customers ( id, name, company, email, phone )",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (!showTestData) q = q.or("is_test.is.null,is_test.eq.false");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as V2EventRow[];
    },
  });

  const ordersQuery = useList<CateringOrder>({
    resource: "orders",
    pagination: { pageSize: 200 },
    sorters: [
      { field: "desired_date", order: "asc" },
      { field: "desired_time", order: "asc" },
    ],
    filters: showTestData
      ? []
      : [{ field: "is_test", operator: "ne", value: true }],
    queryOptions: {
      queryKey: ["unified-orders", showTestData] as unknown as readonly unknown[],
    },
  });

  const records: InquiryRecord[] = useMemo(() => {
    const events = (eventsQuery.data || []).map(mapV2Event);
    const orders = (ordersQuery.result?.data || []).map(mapOrder);
    const all = [...events, ...orders];
    // Default sort: newest first
    all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return all;
  }, [eventsQuery.data, ordersQuery.result?.data]);

  const isLoading =
    eventsQuery.isLoading ||
    ordersQuery.query.isLoading;

  const refetch = () => {
    eventsQuery.refetch();
    ordersQuery.query.refetch();
  };

  return { records, isLoading, refetch };
}
