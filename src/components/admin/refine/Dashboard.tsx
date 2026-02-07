import { useList } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { EventInquiry } from "@/types/refine";
import { KanbanView } from "./KanbanView";

export const Dashboard = () => {
  // Fetch ALL events to categorize them (excluding archived)
  const eventsQuery = useList<EventInquiry>({
    resource: "events",
    pagination: { pageSize: 100 },
    filters: [
      { field: "status", operator: "in", value: ["new", "contacted", "offer_sent", "confirmed", "declined", "cancelled"] },
      { field: "archived_at", operator: "null", value: true },
    ],
    sorters: [{ field: "created_at", order: "desc" }],
  });

  const events = eventsQuery.result?.data || [];

  const handleRefresh = () => {
    eventsQuery.query.refetch();
  };

  return (
    <AdminLayout
      activeTab="dashboard"
      title="Sales Pipeline"
      showSearch={true}
      showCreateButton={true}
      createButtonText="Neue Anfrage"
    >
      <KanbanView events={events} onRefresh={handleRefresh} />
    </AdminLayout>
  );
};
