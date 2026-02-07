import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  MessageSquare, Calendar, Users, Building2, Mail, Phone,
  ChevronDown, ChevronUp, StickyNote, Pencil, Check, X, UserCircle, Flag, ListTodo,
  Receipt, FileText, ExternalLink, Loader2
} from "lucide-react";
import { useDownloadLexOfficeDocument } from "@/hooks/useLexOfficeVouchers";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExtendedInquiry } from "./types";
import { AssigneeSelector } from "@/components/admin/shared/AssigneeSelector";
import { PrioritySelector } from "@/components/admin/shared/PrioritySelector";
import { TaskManager } from "@/components/admin/shared/TaskManager";
import { InquiryPriority } from "@/types/refine";
import { supabase } from "@/integrations/supabase/client";

interface InquiryDetailsPanelProps {
  inquiry: ExtendedInquiry;
  onInternalNotesChange?: (notes: string) => void;
  onAssigneeChange?: (email: string | null) => void;
  onPriorityChange?: (priority: InquiryPriority) => void;
  className?: string;
}

export const InquiryDetailsPanel = ({
  inquiry,
  onInternalNotesChange,
  onAssigneeChange,
  onPriorityChange,
  className
}: InquiryDetailsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(inquiry.internal_notes || "");
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();
  const downloadDocument = useDownloadLexOfficeDocument();
  const [isDownloading, setIsDownloading] = useState(false);

  // Check for LexOffice document (either invoice_id or quotation_id)
  const lexofficeDocId = (inquiry as any).lexoffice_invoice_id || inquiry.lexoffice_quotation_id;
  const lexofficeDocType = (inquiry as any).lexoffice_document_type ||
    (inquiry.lexoffice_quotation_id ? 'quotation' : null);

  const handleDownloadDocument = async () => {
    if (!lexofficeDocId || !lexofficeDocType) return;
    setIsDownloading(true);
    try {
      const result = await downloadDocument.mutateAsync({
        voucherId: lexofficeDocId,
        voucherType: lexofficeDocType
      });
      if (result?.pdfUrl) {
        window.open(result.pdfUrl, '_blank');
      } else {
        toast.error("PDF konnte nicht geladen werden");
      }
    } catch (error) {
      toast.error("Fehler beim Laden des Dokuments");
    } finally {
      setIsDownloading(false);
    }
  };

  // Get current user email for "Mir zuweisen" feature
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email || undefined);
    });
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Nicht angegeben";
    try {
      return format(parseISO(dateStr), "EEEE, d. MMMM yyyy", { locale: de });
    } catch {
      return dateStr;
    }
  };

  const handleSaveNotes = () => {
    onInternalNotesChange?.(localNotes);
    setIsEditingNotes(false);
  };

  const handleCancelNotes = () => {
    setLocalNotes(inquiry.internal_notes || "");
    setIsEditingNotes(false);
  };

  return (
    <Card className={cn("rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Anfrage-Details
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Original Message - Most Important */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Originale Nachricht des Kunden
            </label>
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-3 border border-amber-200/50 dark:border-amber-800/30">
              {inquiry.message ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {inquiry.message}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Keine Nachricht vorhanden
                </p>
              )}
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Event Date */}
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Wunschtermin</p>
                <p className="text-sm font-medium">{formatDate(inquiry.preferred_date)}</p>
              </div>
            </div>

            {/* Guest Count */}
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Gäste</p>
                <p className="text-sm font-medium">{inquiry.guest_count || "?"} Personen</p>
              </div>
            </div>

            {/* Company */}
            {inquiry.company_name && (
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Firma</p>
                  <p className="text-sm font-medium">{inquiry.company_name}</p>
                </div>
              </div>
            )}

            {/* Event Type */}
            {inquiry.event_type && (
              <div className="flex items-start gap-2 col-span-2">
                <Badge variant="secondary" className="mt-0.5">
                  {inquiry.event_type}
                </Badge>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
            <a
              href={`mailto:${inquiry.email}`}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              {inquiry.email}
            </a>
            {inquiry.phone && (
              <a
                href={`tel:${inquiry.phone}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                {inquiry.phone}
              </a>
            )}
          </div>

          {/* Assignment & Priority Section */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
            {/* Assignee */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserCircle className="h-3.5 w-3.5" />
                Zugewiesen an
              </label>
              <AssigneeSelector
                value={inquiry.assigned_to || null}
                onChange={(email) => onAssigneeChange?.(email)}
                currentUserEmail={currentUserEmail}
                disabled={!onAssigneeChange}
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                Priorität
              </label>
              <PrioritySelector
                value={inquiry.priority || 'normal'}
                onChange={(priority) => onPriorityChange?.(priority)}
                disabled={!onPriorityChange}
              />
            </div>
          </div>

          {/* Internal Notes */}
          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                Interne Notizen
              </label>
              {!isEditingNotes && onInternalNotesChange && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingNotes(true)}
                  className="h-6 px-2 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Bearbeiten
                </Button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Interne Notizen hinzufügen..."
                  className="min-h-[80px] text-sm"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelNotes}
                    className="h-7"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    className="h-7"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Speichern
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-2.5 min-h-[40px]">
                {inquiry.internal_notes ? (
                  <p className="text-sm whitespace-pre-wrap">{inquiry.internal_notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Keine Notizen</p>
                )}
              </div>
            )}
          </div>

          {/* Tasks / Follow-ups */}
          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ListTodo className="h-3.5 w-3.5" />
              Aufgaben & Follow-ups
            </label>
            <TaskManager
              inquiryId={inquiry.id}
              currentUserEmail={currentUserEmail}
            />
          </div>

          {/* LexOffice Document - Show if linked */}
          {lexofficeDocId && (
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                {lexofficeDocType === 'invoice' ? (
                  <Receipt className="h-3.5 w-3.5" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                LexOffice {lexofficeDocType === 'invoice' ? 'Rechnung' : 'Angebot'}
              </label>
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 rounded-lg p-2.5 border border-green-200/50 dark:border-green-800/30">
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                  {lexofficeDocType === 'invoice' ? 'Rechnung' : 'Angebot'} erstellt
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadDocument}
                  disabled={isDownloading}
                  className="h-7 px-2 text-xs ml-auto"
                >
                  {isDownloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  )}
                  PDF öffnen
                </Button>
              </div>
            </div>
          )}

          {/* Inquiry Received Date */}
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            Anfrage eingegangen: {inquiry.created_at ? format(parseISO(inquiry.created_at), "d. MMM yyyy 'um' HH:mm 'Uhr'", { locale: de }) : "Unbekannt"}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
