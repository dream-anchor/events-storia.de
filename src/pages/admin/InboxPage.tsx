import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/refine/AdminLayout';
import { InboxLayout, InboxSidebar, DetailPane, DetailHeader, Timeline } from '@/components/admin/inbox';
import { useInboxItem } from '@/hooks/useUnifiedInbox';
import { usePresence } from '@/hooks/usePresence';
import { useInboxKeyboard } from '@/hooks/useInboxKeyboard';
import { useUnifiedInbox } from '@/hooks/useUnifiedInbox';
import type { EntityType } from '@/components/admin/inbox/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const InboxPage = () => {
  const { entityType, id } = useParams<{ entityType?: string; id?: string }>();
  const navigate = useNavigate();
  
  // Get all inbox items for keyboard navigation
  const { data: items = [] } = useUnifiedInbox({});
  
  // Get selected item details
  const validEntityType = entityType as EntityType | undefined;
  const { data: selectedItem, isLoading: itemLoading } = useInboxItem(
    validEntityType || 'event_inquiry',
    id || ''
  );
  
  // Presence tracking
  const { viewers } = usePresence(
    validEntityType || 'event_inquiry',
    id || ''
  );

  // Keyboard navigation
  useInboxKeyboard(items, id || null, {
    onEscape: () => navigate('/admin/inbox'),
  });

  const handleSelect = (itemId: string, type: EntityType) => {
    navigate(`/admin/inbox/${type}/${itemId}`);
  };

  const handleBack = () => {
    navigate('/admin/inbox');
  };

  const handleEdit = () => {
    if (!validEntityType || !id) return;
    
    // Navigate to the appropriate editor
    if (validEntityType === 'event_inquiry') {
      navigate(`/admin/events/${id}/edit`);
    } else if (validEntityType === 'catering_order') {
      navigate(`/admin/orders/${id}/edit`);
    } else if (validEntityType === 'event_booking') {
      navigate(`/admin/bookings/${id}/edit`);
    }
  };

  return (
    <AdminLayout activeTab="inbox">
      <InboxLayout
        sidebar={
          <InboxSidebar 
            selectedId={id} 
            onSelect={handleSelect}
          />
        }
      >
        {!id ? (
          <DetailPane isEmpty />
        ) : itemLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : selectedItem ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <DetailHeader
              item={selectedItem}
              viewers={viewers}
              onBack={handleBack}
              onEdit={handleEdit}
            />

            {/* Content tabs */}
            <Tabs defaultValue="timeline" className="flex-1 flex flex-col">
              <TabsList className="px-4 py-2 justify-start border-b rounded-none bg-transparent">
                <TabsTrigger value="timeline" className="data-[state=active]:bg-muted">
                  Aktivitäten
                </TabsTrigger>
                <TabsTrigger value="details" className="data-[state=active]:bg-muted">
                  Details
                </TabsTrigger>
                <TabsTrigger value="documents" className="data-[state=active]:bg-muted">
                  Dokumente
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="flex-1 overflow-auto m-0">
                <Timeline
                  entityType={validEntityType!}
                  entityId={id}
                />
              </TabsContent>

              <TabsContent value="details" className="flex-1 overflow-auto m-0 p-4">
                <div className="space-y-4">
                  <h3 className="font-medium">Rohdaten</h3>
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[500px]">
                    {JSON.stringify(selectedItem.raw, null, 2)}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="flex-1 overflow-auto m-0 p-4">
                <p className="text-muted-foreground text-sm">
                  Dokumente werden hier angezeigt sobald verfügbar.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <DetailPane isEmpty />
        )}
      </InboxLayout>
    </AdminLayout>
  );
};

export default InboxPage;
