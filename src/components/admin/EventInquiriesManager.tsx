import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Search, RefreshCw, ChevronDown, ChevronUp, Phone, Mail, Building2, Users, Calendar, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useEventInquiries, useUpdateInquiryStatus, useUpdateInquiryNotes, useDeleteInquiry, InquiryStatus, EventInquiry } from "@/hooks/useEventInquiries";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const statusConfig: Record<InquiryStatus, { label: string; color: string; bg: string }> = {
  new: { label: "Neu", color: "text-amber-700", bg: "bg-amber-100" },
  contacted: { label: "Kontaktiert", color: "text-blue-700", bg: "bg-blue-100" },
  offer_sent: { label: "Angebot gesendet", color: "text-purple-700", bg: "bg-purple-100" },
  confirmed: { label: "Bestätigt", color: "text-green-700", bg: "bg-green-100" },
  declined: { label: "Abgelehnt", color: "text-muted-foreground", bg: "bg-muted" },
};

const eventTypeLabels: Record<string, string> = {
  firmenfeier: "Firmenfeier",
  weihnachtsfeier: "Weihnachtsfeier",
  geburtstag: "Geburtstagsfeier",
  hochzeit: "Hochzeit",
  sommerfest: "Sommerfest",
  teamevent: "Teamevent",
  konferenz: "Konferenz/Meeting",
  sonstiges: "Sonstiges",
};

const EventInquiriesManager = () => {
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  
  const { data: inquiries, isLoading, refetch } = useEventInquiries(statusFilter);
  const updateStatus = useUpdateInquiryStatus();
  const updateNotes = useUpdateInquiryNotes();
  const deleteInquiry = useDeleteInquiry();

  // Bulk actions
  const handleSelectInquiry = (inquiryId: string, checked: boolean) => {
    const newSelected = new Set(selectedInquiryIds);
    if (checked) {
      newSelected.add(inquiryId);
    } else {
      newSelected.delete(inquiryId);
    }
    setSelectedInquiryIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredInquiries) {
      setSelectedInquiryIds(new Set(filteredInquiries.map(i => i.id)));
    } else {
      setSelectedInquiryIds(new Set());
    }
  };

  const handleBulkStatusChange = async (newStatus: InquiryStatus) => {
    if (selectedInquiryIds.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      for (const inquiryId of selectedInquiryIds) {
        await updateStatus.mutateAsync({ inquiryId, status: newStatus });
      }
      toast({
        title: "Status aktualisiert",
        description: `${selectedInquiryIds.size} Anfrage(n) auf "${statusConfig[newStatus].label}" gesetzt.`
      });
      setSelectedInquiryIds(new Set());
      refetch();
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Einige Anfragen konnten nicht aktualisiert werden.",
        variant: "destructive"
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInquiryIds.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      for (const inquiryId of selectedInquiryIds) {
        await deleteInquiry.mutateAsync(inquiryId);
      }
      toast({
        title: "Anfragen gelöscht",
        description: `${selectedInquiryIds.size} Anfrage(n) wurden gelöscht.`
      });
      setSelectedInquiryIds(new Set());
      setBulkDeleteDialogOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: "Fehler",
        description: "Einige Anfragen konnten nicht gelöscht werden.",
        variant: "destructive"
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const filteredInquiries = useMemo(() => {
    if (!inquiries) return [];
    
    let filtered = inquiries;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inquiry =>
        inquiry.contact_name.toLowerCase().includes(query) ||
        inquiry.email.toLowerCase().includes(query) ||
        inquiry.company_name?.toLowerCase().includes(query) ||
        inquiry.phone?.toLowerCase().includes(query)
      );
    }
    
    // Sort by preferred date (closest first), then by created_at
    return [...filtered].sort((a, b) => {
      const dateA = a.preferred_date ? new Date(a.preferred_date).getTime() : Infinity;
      const dateB = b.preferred_date ? new Date(b.preferred_date).getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [inquiries, searchQuery]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "EEE, dd.MM.yy", { locale: de });
  };

  const formatCreatedAt = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "dd.MM.yy HH:mm", { locale: de });
  };

  const handleExpandInquiry = (inquiryId: string, notes: string | null) => {
    if (expandedInquiryId === inquiryId) {
      setExpandedInquiryId(null);
    } else {
      setExpandedInquiryId(inquiryId);
      setEditingNotes(notes || "");
    }
  };

  const handleSaveNotes = (inquiryId: string) => {
    updateNotes.mutate({ inquiryId, internalNotes: editingNotes });
  };

  const handleStatusChange = (inquiryId: string, newStatus: InquiryStatus) => {
    updateStatus.mutate({ inquiryId, status: newStatus });
  };

  const statusTabs: { value: InquiryStatus | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'Alle', count: inquiries?.length || 0 },
    { value: 'new', label: 'Neu', count: inquiries?.filter(i => i.status === 'new').length || 0 },
    { value: 'contacted', label: 'Kontaktiert', count: inquiries?.filter(i => i.status === 'contacted').length || 0 },
    { value: 'offer_sent', label: 'Angebot', count: inquiries?.filter(i => i.status === 'offer_sent').length || 0 },
    { value: 'confirmed', label: 'Bestätigt', count: inquiries?.filter(i => i.status === 'confirmed').length || 0 },
    { value: 'declined', label: 'Abgelehnt', count: inquiries?.filter(i => i.status === 'declined').length || 0 },
  ];

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Lade Anfragen...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Search & Refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, E-Mail, Firma..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap",
              statusFilter === tab.value
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "ml-1.5 text-xs",
                statusFilter === tab.value ? "text-primary" : "text-muted-foreground"
              )}>
                ({tab.count})
              </span>
            )}
            {statusFilter === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selectedInquiryIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Checkbox
            checked={filteredInquiries.length > 0 && selectedInquiryIds.size === filteredInquiries.length}
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
          />
          <span className="text-sm font-medium">
            {selectedInquiryIds.size} Anfrage(n) ausgewählt
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Select 
              onValueChange={(value) => {
                if (value === 'delete') {
                  setBulkDeleteDialogOpen(true);
                } else {
                  handleBulkStatusChange(value as InquiryStatus);
                }
              }} 
              disabled={isBulkUpdating}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Status ändern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Neu</SelectItem>
                <SelectItem value="contacted">Kontaktiert</SelectItem>
                <SelectItem value="offer_sent">Angebot gesendet</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="declined">Abgelehnt</SelectItem>
                <SelectItem value="delete" className="text-destructive focus:text-destructive">
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-3 w-3" />
                    Löschen
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedInquiryIds(new Set())}
            >
              Abwählen
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anfragen endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedInquiryIds.size} Anfrage(n) werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkUpdating}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={isBulkUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inquiries List */}
      <div className="space-y-2">
        {filteredInquiries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Keine Anfragen gefunden
          </div>
        ) : (
          filteredInquiries.map((inquiry) => {
            const status = statusConfig[inquiry.status as InquiryStatus] || statusConfig.new;
            const isExpanded = expandedInquiryId === inquiry.id;

            return (
              <div
                key={inquiry.id}
                className={cn(
                  "border rounded-lg transition-all",
                  "bg-card",
                  inquiry.status === 'new' && "border-amber-300"
                )}
              >
                {/* Row Header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => handleExpandInquiry(inquiry.id, inquiry.internal_notes)}
                >
                  <Checkbox
                    checked={selectedInquiryIds.has(inquiry.id)}
                    onCheckedChange={(checked) => handleSelectInquiry(inquiry.id, !!checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn(status.bg, status.color, "text-xs font-medium")}>
                        {status.label}
                      </Badge>
                      
                      {/* Date & Time */}
                      <span className="font-semibold text-sm">
                        {formatDate(inquiry.preferred_date)}
                      </span>
                      
                      {/* Contact Name / Company */}
                      <span className="text-sm text-muted-foreground truncate">
                        {inquiry.company_name || inquiry.contact_name}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {inquiry.event_type && (
                        <Badge variant="outline" className="text-xs">
                          {eventTypeLabels[inquiry.event_type] || inquiry.event_type}
                        </Badge>
                      )}
                      {inquiry.guest_count && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {inquiry.guest_count}
                        </span>
                      )}
                      <span>Erstellt: {formatCreatedAt(inquiry.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Expand Icon */}
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t p-4 space-y-4">
                    {/* Contact Info */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Kontakt
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{inquiry.contact_name}</p>
                          {inquiry.company_name && (
                            <p className="text-muted-foreground">{inquiry.company_name}</p>
                          )}
                          <p className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${inquiry.email}`} className="text-primary hover:underline">
                              {inquiry.email}
                            </a>
                          </p>
                          {inquiry.phone && (
                            <p className="flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${inquiry.phone}`} className="text-primary hover:underline">
                                {inquiry.phone}
                              </a>
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Event-Details
                        </h4>
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">Typ: </span>
                            {eventTypeLabels[inquiry.event_type || ''] || inquiry.event_type || '-'}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Gäste: </span>
                            {inquiry.guest_count || '-'}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Wunschtermin: </span>
                            {inquiry.preferred_date ? format(parseISO(inquiry.preferred_date), "EEEE, dd. MMMM yyyy", { locale: de }) : '-'}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Quelle: </span>
                            {inquiry.source || 'Website'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    {inquiry.message && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Nachricht
                        </h4>
                        <div className="bg-muted/50 p-3 rounded text-sm whitespace-pre-wrap">
                          {inquiry.message}
                        </div>
                      </div>
                    )}

                    {/* Status & Notes */}
                    <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Status</label>
                        <Select 
                          value={inquiry.status || 'new'} 
                          onValueChange={(value) => handleStatusChange(inquiry.id, value as InquiryStatus)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                {config.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Interne Notizen</label>
                        <div className="flex gap-2">
                          <Textarea
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            placeholder="Notizen hinzufügen..."
                            className="min-h-[80px]"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => handleSaveNotes(inquiry.id)}
                          disabled={updateNotes.isPending}
                        >
                          {updateNotes.isPending ? "Speichern..." : "Notizen speichern"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default EventInquiriesManager;
