import { useState } from "react";
import { ListTodo, Mail, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ClientPreview } from "./ClientPreview";
import { StaffNote } from "./StaffNote";
import { TaskManager } from "@/components/admin/shared/TaskManager";
import { ConversationThread } from "@/components/admin/shared/ConversationThread";
import { PaymentCard } from "./PaymentCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OfferBuilderHandle } from "./OfferBuilder";

interface DetailSidebarProps {
  inquiryId: string;
  inquiry: {
    email?: string | null;
    contact_name?: string | null;
    internal_notes?: string | null;
    current_offer_version?: number | null;
    preferred_date?: string | null;
  };
  currentUserEmail?: string;
  offerTotal: number | null;
  customerResponse: {
    responded_at: string;
    selected_option_id: string | null;
    customer_notes: string | null;
  } | null;
  selectedOptionInfo: { optionLabel: string; packageName: string } | null;
  offerBuilderRef: React.RefObject<OfferBuilderHandle | null>;
  onFieldChange: (field: string, value: unknown) => void;
}

export function DetailSidebar({
  inquiryId,
  inquiry,
  currentUserEmail,
  offerTotal,
  customerResponse,
  selectedOptionInfo,
  offerBuilderRef,
  onFieldChange,
}: DetailSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-6">
      {/* Tasks & Follow-ups — immer sichtbar */}
      <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            Aufgaben & Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskManager
            inquiryId={inquiryId}
            currentUserEmail={currentUserEmail}
          />
          <div className="mt-4 pt-4 border-t border-border/60">
            <StaffNote
              note={inquiry.internal_notes || ''}
              onNoteChange={(note) => onFieldChange('internal_notes', note)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Expand-Button */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="lg:hidden w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border/60 rounded-xl transition-colors"
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        {expanded ? 'Weniger anzeigen' : 'Vorschau, Zahlungen & E-Mails'}
      </button>

      {/* Restliche Cards — auf Mobile hinter Expand, auf Desktop immer sichtbar */}
      <div className={cn("space-y-6", !expanded && "hidden lg:block")}>
        {/* Client Preview */}
        <ClientPreview
          inquiryId={inquiryId}
          version={inquiry.current_offer_version || 1}
        />

        {/* Kundenantwort */}
        {customerResponse && (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                💬 Kundenantwort
                <span className="text-xs text-muted-foreground font-normal">
                  {new Date(customerResponse.responded_at).toLocaleDateString('de-DE')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {customerResponse.selected_option_id && (
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Gewählt: Option{' '}
                  <strong>{selectedOptionInfo?.optionLabel ?? '…'}</strong>
                  {selectedOptionInfo?.packageName && (
                    <span className="text-blue-700 dark:text-blue-300 font-normal">
                      {' '}({selectedOptionInfo.packageName})
                    </span>
                  )}
                </p>
              )}
              {customerResponse.customer_notes && (
                <p className="text-sm italic text-muted-foreground">
                  „{customerResponse.customer_notes}"
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950"
                  onClick={() => offerBuilderRef.current?.scrollToEmail(true)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Antwort per Mail
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => offerBuilderRef.current?.triggerNewVersion()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Neues Angebot
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zahlungen */}
        <div data-payment-card>
          <PaymentCard
            inquiryId={inquiryId}
            preferredDate={inquiry.preferred_date}
            offerTotal={offerTotal}
          />
        </div>

        {/* Konversations-Thread */}
        <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              E-Mail Konversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConversationThread
              inquiryId={inquiryId}
              customerEmail={inquiry.email || undefined}
              onSendReply={async (content) => {
                if (!inquiry?.email) {
                  toast.error('Keine E-Mail-Adresse hinterlegt');
                  return;
                }
                const { data: result } = await supabase.functions.invoke('send-offer-email', {
                  body: {
                    inquiryId,
                    emailContent: content,
                    customerEmail: inquiry.email,
                    customerName: inquiry.contact_name || '',
                    senderEmail: currentUserEmail,
                  },
                });
                if (!result?.emailSent) {
                  throw new Error(result?.error || 'Versand fehlgeschlagen');
                }
                toast.success('Antwort versendet');
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
