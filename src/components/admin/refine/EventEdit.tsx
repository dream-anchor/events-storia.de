import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate } from "@refinedev/core";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { QuoteBuilder } from "./QuoteBuilder";
import { QuotePDFDocument } from "./QuotePDF";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventInquiry, QuoteItem } from "@/types/refine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const EventEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [currentQuoteItems, setCurrentQuoteItems] = useState<QuoteItem[]>([]);
  const [currentNotes, setCurrentNotes] = useState("");
  const [isSendingToLexOffice, setIsSendingToLexOffice] = useState(false);

  // Fetch event data
  const eventQuery = useOne<EventInquiry>({
    resource: "events",
    id: id!,
  });

  const event = eventQuery.result;
  const isLoading = eventQuery.query.isLoading;

  // Update mutation
  const { mutate: updateEvent } = useUpdate();

  // Handle save quote
  const handleSave = useCallback((items: QuoteItem[], notes: string) => {
    if (!id) return;
    
    // Save quote data to internal_notes for now (could be a separate table)
    const quoteData = JSON.stringify({ items, notes, updatedAt: new Date().toISOString() });
    
    updateEvent({
      resource: "events",
      id,
      values: {
        internal_notes: quoteData,
        status: 'offer_sent',
      },
    }, {
      onSuccess: () => {
        toast.success("Angebot gespeichert");
      },
      onError: (error) => {
        toast.error("Fehler beim Speichern");
        console.error(error);
      },
    });
  }, [id, updateEvent]);

  // Handle PDF preview
  const handlePreviewPdf = useCallback((items: QuoteItem[], notes: string) => {
    setCurrentQuoteItems(items);
    setCurrentNotes(notes);
    setPdfDialogOpen(true);
  }, []);

  // Handle send to LexOffice
  const handleSendToLexOffice = useCallback(async (items: QuoteItem[], notes: string) => {
    if (!event || !id) return;
    
    setIsSendingToLexOffice(true);
    
    try {
      // First save the quote
      handleSave(items, notes);
      
      // Build LexOffice quotation payload
      const lineItems = items.map(item => ({
        type: 'custom',
        name: item.name,
        description: item.description || '',
        quantity: item.quantity,
        unitName: 'Stück',
        unitPrice: {
          currency: 'EUR',
          netAmount: item.price,
          taxRatePercentage: 7,
        },
      }));

      // Call edge function to create LexOffice quotation
      const { data, error } = await supabase.functions.invoke('create-event-quotation', {
        body: {
          eventId: id,
          event: {
            contact_name: event.contact_name,
            company_name: event.company_name,
            email: event.email,
            phone: event.phone,
            preferred_date: event.preferred_date,
            guest_count: event.guest_count,
            event_type: event.event_type,
          },
          items: lineItems,
          notes,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Angebot an LexOffice gesendet!");
      
      // Update event status
      updateEvent({
        resource: "events",
        id,
        values: {
          status: 'offer_sent',
        },
      });
      
    } catch (err) {
      console.error('LexOffice error:', err);
      toast.error(err instanceof Error ? err.message : "Fehler beim Senden an LexOffice");
    } finally {
      setIsSendingToLexOffice(false);
    }
  }, [event, id, handleSave, updateEvent]);

  if (isLoading) {
    return (
      <AdminLayout activeTab="events">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!event) {
    return (
      <AdminLayout activeTab="events">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Event nicht gefunden</p>
          <Button variant="link" onClick={() => navigate('/admin/events')}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="events">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/events')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Angebot erstellen
            </h1>
            <p className="text-sm text-muted-foreground">
              {event.company_name || event.contact_name} • {event.email}
            </p>
          </div>
        </div>

        {/* Quote Builder */}
        <QuoteBuilder
          event={event}
          onSave={handleSave}
          onPreviewPdf={handlePreviewPdf}
          onSendToLexOffice={handleSendToLexOffice}
        />

        {/* PDF Preview Dialog */}
        <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
          <DialogContent className="max-w-4xl h-[90vh]">
            <DialogHeader>
              <DialogTitle>PDF-Vorschau</DialogTitle>
            </DialogHeader>
            <div className="flex-1 h-full min-h-0">
              <PDFViewer width="100%" height="100%" className="rounded-lg">
                <QuotePDFDocument
                  event={event}
                  items={currentQuoteItems}
                  notes={currentNotes}
                  quoteNumber={`Q-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`}
                />
              </PDFViewer>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};
