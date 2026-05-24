import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Search } from "lucide-react";
import { useCombinedMenuItems, type CombinedMenuItem } from "@/hooks/useCombinedMenuItems";

export interface PickedItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Props {
  onPick: (item: PickedItem) => void;
  triggerLabel?: string;
  includeRistorante?: boolean;
  includeCatering?: boolean;
}

export const MenuItemPicker = ({
  onPick,
  triggerLabel = "Aus Katalog",
  includeRistorante = true,
  includeCatering = true,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { items, isLoading } = useCombinedMenuItems({ includeRistorante, includeCatering });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.category_name || "").toLowerCase().includes(q),
        )
      : items;
    // group by category
    const groups = new Map<string, CombinedMenuItem[]>();
    for (const it of list) {
      const key = `${it.source === "ristorante" ? "Ristorante" : "Catering"} · ${it.category_name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(it);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items, query]);

  const handlePick = (item: CombinedMenuItem) => {
    onPick({
      id: item.id,
      name: item.name,
      quantity: 1,
      price: item.price ?? 0,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Artikel aus Katalog wählen</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen nach Name oder Kategorie…"
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-[60vh] pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Laden…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Keine Treffer
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(([group, list]) => (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      {group}
                    </h4>
                    <Badge variant="secondary" className="text-[10px] h-4">
                      {list.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {list.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlePick(item)}
                        className="w-full text-left rounded-md border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-colors p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-primary shrink-0">
                          {item.price != null
                            ? `${item.price.toFixed(2).replace(".", ",")} €`
                            : "—"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};