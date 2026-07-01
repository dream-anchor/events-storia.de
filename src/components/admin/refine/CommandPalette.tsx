import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useList } from "@refinedev/core";
import { 
  LayoutDashboard, CalendarDays, FileText, Package, 
  UtensilsCrossed, Plus, ArrowRight, Inbox, Building2,
  Users, Search, Clock, CheckCircle2, Loader2
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 150);
    return () => clearTimeout(t);
  }, [search]);

  const q = debouncedSearch;
  const qLower = q.toLowerCase();
  const isSearching = q.length >= 2;

  // Fetch recent events for smart search
  const recentEventsQuery = useList({
    resource: "event_inquiries",
    pagination: { pageSize: 5 },
    sorters: [{ field: "created_at", order: "desc" }],
    filters: isSearching ? [
      {
        operator: "or",
        value: [
          { field: "contact_name", operator: "contains", value: q },
          { field: "company_name", operator: "contains", value: q },
          { field: "email", operator: "contains", value: q },
        ]
      }
    ] : [],
  });

  // Fetch recent orders for smart search
  const recentOrdersQuery = useList({
    resource: "catering_orders",
    pagination: { pageSize: 5 },
    sorters: [{ field: "created_at", order: "desc" }],
    filters: isSearching ? [
      {
        operator: "or",
        value: [
          { field: "customer_name", operator: "contains", value: q },
          { field: "company_name", operator: "contains", value: q },
          { field: "order_number", operator: "contains", value: q },
        ]
      }
    ] : [],
  });

  const events = recentEventsQuery.result?.data || [];
  const orders = recentOrdersQuery.result?.data || [];
  const isFetching =
    isSearching && (recentEventsQuery.query.isFetching || recentOrdersQuery.query.isFetching);

  const handleSelect = (path: string) => {
    navigate(path);
    onOpenChange(false);
    setSearch("");
  };

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const navItems = useMemo(() => [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, shortcut: '⌘D' },
    { path: '/admin/inbox', label: 'Inbox', icon: Inbox, shortcut: '⌘I' },
    { path: '/admin/inquiries', label: 'Event-Anfragen', icon: CalendarDays, shortcut: '⌘E' },
    { path: '/admin/bookings', label: 'Buchungen', icon: CheckCircle2 },
    { path: '/admin/orders', label: 'Catering-Bestellungen', icon: FileText, shortcut: '⌘O' },
    { path: '/admin/packages', label: 'Pakete', icon: Package, shortcut: '⌘P' },
    { path: '/admin/menu', label: 'Speisen & Getränke', icon: UtensilsCrossed, shortcut: '⌘M' },
  ], []);

  const quickItems = useMemo(() => [
    { path: '/admin/inquiries/create', label: 'Neue Event-Anfrage erstellen', shortcut: '⇧⌘N' },
    { path: '/admin/packages/create', label: 'Neues Paket erstellen' },
  ], []);

  const filteredNav = isSearching
    ? navItems.filter((i) => i.label.toLowerCase().includes(qLower))
    : navItems;
  const filteredQuick = isSearching
    ? quickItems.filter((i) => i.label.toLowerCase().includes(qLower))
    : quickItems;

  const hasResults = events.length > 0 || orders.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput 
        placeholder="Suche nach Events, Bestellungen, Kunden..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        {isSearching && !hasResults && !isFetching && filteredNav.length === 0 && filteredQuick.length === 0 && (
          <CommandEmpty>Keine Ergebnisse für „{q}".</CommandEmpty>
        )}

        {isSearching && isFetching && !hasResults && (
          <CommandGroup heading="Suche läuft …">
            <CommandItem disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Treffer werden geladen…</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Dynamic search results — always on top when searching */}
        {isSearching && hasResults && (
          <>
            {events.length > 0 && (
              <CommandGroup heading="Event-Anfragen">
                {events.map((event: any) => (
                  <CommandItem 
                    key={event.id} 
                    value={`inq-${event.id}`}
                    onSelect={() => handleSelect(`/admin/inquiries/${event.id}/edit`)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        {(() => {
                          const c = cleanDisplayText(event.company_name);
                          const p = cleanDisplayText(event.contact_name);
                          return (
                            <>
                              <p className="font-medium">{c ?? p ?? 'Ohne Name'}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {c && p && <span>{p}</span>}
                          {event.preferred_date && (
                            <span>{format(parseISO(event.preferred_date), "dd.MM.yy", { locale: de })}</span>
                          )}
                          {event.guest_count && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.guest_count}
                            </span>
                          )}
                          {event.email && (
                            <span className="truncate max-w-[200px]">{event.email}</span>
                          )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Anfrage</Badge>
                      <Badge variant="outline" className="text-xs">
                        {event.status === 'new' ? 'Neu' : event.status === 'offer_sent' ? 'Angebot' : event.status}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {orders.length > 0 && (
              <CommandGroup heading="Catering-Bestellungen">
                {orders.map((order: any) => (
                  <CommandItem 
                    key={order.id} 
                    value={`ord-${order.id}`}
                    onSelect={() => handleSelect(`/admin/orders/${order.id}/edit`)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        {(() => {
                          const c = cleanDisplayText(order.company_name);
                          const p = cleanDisplayText(order.customer_name);
                          return (
                            <>
                              <p className="font-medium">{c ?? p ?? 'Ohne Name'}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {c && p && <span>{p}</span>}
                          <span className="font-mono">{order.order_number}</span>
                          {order.desired_date && (
                            <span>{format(parseISO(order.desired_date), "dd.MM.yy", { locale: de })}</span>
                          )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Bestellung</Badge>
                      <span className="text-sm font-medium">
                        {order.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        {filteredNav.length > 0 && (
          <CommandGroup heading="Navigation">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.path} value={`nav-${item.path}`} onSelect={() => handleSelect(item.path)}>
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {filteredQuick.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Schnellaktionen">
              {filteredQuick.map((item) => (
                <CommandItem key={item.path} value={`quick-${item.path}`} onSelect={() => handleSelect(item.path)}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!isSearching && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Extern">
              <CommandItem value="ext-website" onSelect={() => window.open('/', '_blank')}>
                <ArrowRight className="mr-2 h-4 w-4" />
                <span>Webseite öffnen</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

// Hook for global keyboard shortcut
export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      // Global navigation shortcuts (Cmd+Key without Shift)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === 'd') {
          e.preventDefault();
          window.location.href = '/admin';
        }
        if (e.key === 'i') {
          e.preventDefault();
          window.location.href = '/admin/inbox';
        }
        if (e.key === 'e') {
          e.preventDefault();
          window.location.href = '/admin/inquiries';
        }
        if (e.key === 'o') {
          e.preventDefault();
          window.location.href = '/admin/orders';
        }
        if (e.key === 'p') {
          e.preventDefault();
          window.location.href = '/admin/packages';
        }
        if (e.key === 'm') {
          e.preventDefault();
          window.location.href = '/admin/menu';
        }
      }
      // Schnellaktion: Cmd+Shift+N für neue Anfrage
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        window.location.href = '/admin/inquiries/create';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
};

/**
 * Hook for editor-specific keyboard shortcuts
 * Use in SmartInquiryEditor for context-aware shortcuts
 */
export interface EditorShortcutHandlers {
  onGenerateEmail?: () => void;
  onSendOffer?: () => void;
  onSave?: () => void;
  onNextInquiry?: () => void;
  onPreviousInquiry?: () => void;
}

export const useEditorShortcuts = (handlers: EditorShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' ||
                       target.tagName === 'TEXTAREA' ||
                       target.isContentEditable;

      // Cmd+Shift+E - Generate Email
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        handlers.onGenerateEmail?.();
      }

      // Cmd+Enter - Send Offer (works even in text fields)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handlers.onSendOffer?.();
      }

      // Cmd+S - Force Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handlers.onSave?.();
      }

      // Navigation shortcuts only when not typing
      if (!isTyping) {
        // Arrow Up/Down or J/K for vim-style navigation
        if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          handlers.onPreviousInquiry?.();
        }
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          handlers.onNextInquiry?.();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};
