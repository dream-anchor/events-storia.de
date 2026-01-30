import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useList } from "@refinedev/core";
import { 
  LayoutDashboard, CalendarDays, FileText, Package, 
  UtensilsCrossed, Plus, ArrowRight, Inbox, Building2,
  Users, Search, Clock, CheckCircle2
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

  // Fetch recent events for smart search
  const recentEventsQuery = useList({
    resource: "event_inquiries",
    pagination: { pageSize: 5 },
    sorters: [{ field: "created_at", order: "desc" }],
    filters: search.length >= 2 ? [
      {
        operator: "or",
        value: [
          { field: "contact_name", operator: "contains", value: search },
          { field: "company_name", operator: "contains", value: search },
          { field: "email", operator: "contains", value: search },
        ]
      }
    ] : [],
  });

  // Fetch recent orders for smart search
  const recentOrdersQuery = useList({
    resource: "catering_orders",
    pagination: { pageSize: 5 },
    sorters: [{ field: "created_at", order: "desc" }],
    filters: search.length >= 2 ? [
      {
        operator: "or",
        value: [
          { field: "customer_name", operator: "contains", value: search },
          { field: "company_name", operator: "contains", value: search },
          { field: "order_number", operator: "contains", value: search },
        ]
      }
    ] : [],
  });

  const events = recentEventsQuery.result?.data || [];
  const orders = recentOrdersQuery.result?.data || [];

  const handleSelect = (path: string) => {
    navigate(path);
    onOpenChange(false);
    setSearch("");
  };

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Suche nach Events, Bestellungen, Kunden..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        
        {/* Dynamic search results */}
        {search.length >= 2 && (events.length > 0 || orders.length > 0) && (
          <>
            {events.length > 0 && (
              <CommandGroup heading="Event-Anfragen">
                {events.map((event: any) => (
                  <CommandItem 
                    key={event.id} 
                    onSelect={() => handleSelect(`/admin/events/${event.id}/edit`)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium">{event.company_name || event.contact_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {event.preferred_date && (
                            <span>{format(parseISO(event.preferred_date), "dd.MM.yy", { locale: de })}</span>
                          )}
                          {event.guest_count && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.guest_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {event.status === 'new' ? 'Neu' : event.status === 'offer_sent' ? 'Angebot' : event.status}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {orders.length > 0 && (
              <CommandGroup heading="Catering-Bestellungen">
                {orders.map((order: any) => (
                  <CommandItem 
                    key={order.id} 
                    onSelect={() => handleSelect(`/admin/orders/${order.id}/edit`)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium">{order.customer_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{order.order_number}</span>
                          {order.desired_date && (
                            <span>{format(parseISO(order.desired_date), "dd.MM.yy", { locale: de })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-medium">
                      {order.total_amount?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect('/admin')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/inbox')}>
            <Inbox className="mr-2 h-4 w-4" />
            <span>Inbox</span>
            <CommandShortcut>⌘I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/events')}>
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>Event-Anfragen</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/bookings')}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            <span>Buchungen</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/orders')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Catering-Bestellungen</span>
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/packages')}>
            <Package className="mr-2 h-4 w-4" />
            <span>Pakete</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/menu')}>
            <UtensilsCrossed className="mr-2 h-4 w-4" />
            <span>Speisen & Getränke</span>
            <CommandShortcut>⌘M</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Schnellaktionen">
          <CommandItem onSelect={() => handleSelect('/admin/events/create')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Neue Event-Anfrage erstellen</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect('/admin/packages/create')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Neues Paket erstellen</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Extern">
          <CommandItem onSelect={() => window.open('/', '_blank')}>
            <ArrowRight className="mr-2 h-4 w-4" />
            <span>Webseite öffnen</span>
          </CommandItem>
        </CommandGroup>
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
      // Additional shortcuts
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
          window.location.href = '/admin/events';
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
};
