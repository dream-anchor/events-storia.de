import { ReactNode, CSSProperties } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SortableStrategy = "vertical" | "grid";

interface SortableListProps {
  ids: string[];
  onReorder: (newIds: string[]) => void;
  strategy?: SortableStrategy;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

/** Headless wrapper. Children must render <SortableItem id=... /> per id. */
export function SortableList({
  ids,
  onReorder,
  strategy = "vertical",
  disabled = false,
  children,
  className,
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...ids];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next);
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  const sortingStrategy: SortingStrategy =
    strategy === "grid" ? rectSortingStrategy : verticalListSortingStrategy;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={sortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableItemProps {
  id: string;
  disabled?: boolean;
  /** Render-prop receives the drag handle to place where you want. */
  children: (handle: ReactNode, isDragging: boolean) => ReactNode;
  /** Use grid styling (no full-row layout). */
  asGridItem?: boolean;
}

export function SortableItem({ id, disabled, children, asGridItem }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : undefined,
  };

  const handle = disabled ? null : (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Verschieben"
      title="Ziehen zum Sortieren"
      className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/60 hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className={asGridItem ? undefined : "w-full"}>
      {children(handle, isDragging)}
    </div>
  );
}

/** Persist a new sort order to a table by upserting {id, sort_order}. */
export async function persistSortOrder(
  table: "menu_categories" | "menu_items" | "packages" | "locations" | "menus",
  orderedIds: string[]
): Promise<boolean> {
  try {
    const rows = orderedIds.map((id, index) => ({ id, sort_order: index }));
    // Update one-by-one to avoid upsert overwriting required NOT NULL columns.
    const results = await Promise.all(
      rows.map((r) =>
        supabase.from(table).update({ sort_order: r.sort_order }).eq("id", r.id)
      )
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw firstErr;
    return true;
  } catch (e) {
    console.error("persistSortOrder failed", table, e);
    toast.error("Reihenfolge konnte nicht gespeichert werden");
    return false;
  }
}