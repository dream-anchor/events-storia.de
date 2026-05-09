import { useList } from "@refinedev/core";
import { useMemo } from "react";
import type { EventInquiry, CateringOrder } from "@/types/refine";
import {
  type InquiryRecord,
  mapEvent,
  mapOrder,
} from "@/types/inquiryRecord";
import { useTestMode } from "@/contexts/TestModeContext";

export function useUnifiedInquiries() {
  const { showTestData } = useTestMode();

  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 200 },
    sorters: [{ field: "created_at", order: "desc" }],
    filters: showTestData
      ? []
      : [{ field: "is_test", operator: "ne", value: true }],
    queryOptions: {
      queryKey: ["unified-events", showTestData] as unknown as readonly unknown[],
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
    const events = (eventsQuery.result?.data || []).map(mapEvent);
    const orders = (ordersQuery.result?.data || []).map(mapOrder);
    const all = [...events, ...orders];
    // Default sort: newest first
    all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return all;
  }, [eventsQuery.result?.data, ordersQuery.result?.data]);

  const isLoading =
    eventsQuery.query.isLoading || ordersQuery.query.isLoading;

  const refetch = () => {
    eventsQuery.query.refetch();
    ordersQuery.query.refetch();
  };

  return { records, isLoading, refetch };
}
