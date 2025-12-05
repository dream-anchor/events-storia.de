import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Plus } from "lucide-react";
import { useSpecialMenus, useCreateSpecialMenu, useDeleteSpecialMenu } from "@/hooks/useSpecialMenus";
import { useUpdateMenuOrder } from "@/hooks/useUpdateMenuOrder";
import SpecialMenuCard from "./SpecialMenuCard";
import SortableMenuCard from "./SortableMenuCard";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

const SpecialOccasionsManager = () => {
  const { data: specialMenus, isLoading } = useSpecialMenus();
  const createMutation = useCreateSpecialMenu();
  const deleteMutation = useDeleteSpecialMenu();
  const updateOrderMutation = useUpdateMenuOrder();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddNew = async () => {
    try {
      await createMutation.mutateAsync();
      toast.success("Neuer Anlass erstellt");
    } catch (error) {
      toast.error("Fehler beim Erstellen");
      console.error(error);
    }
  };

  const handleDelete = async (menuId: string) => {
    try {
      await deleteMutation.mutateAsync(menuId);
      toast.success("Anlass-Menü gelöscht");
    } catch (error) {
      toast.error("Fehler beim Löschen");
      console.error(error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && specialMenus) {
      const oldIndex = specialMenus.findIndex((m) => m.id === active.id);
      const newIndex = specialMenus.findIndex((m) => m.id === over.id);

      const reorderedMenus = arrayMove(specialMenus, oldIndex, newIndex);
      
      // Start sort_order at 100 to separate from standard menus
      const updates = reorderedMenus.map((menu, index) => ({
        id: menu.id,
        sort_order: index + 100,
      }));

      try {
        await updateOrderMutation.mutateAsync(updates);
        toast.success("Reihenfolge gespeichert");
      } catch (error) {
        toast.error("Fehler beim Speichern der Reihenfolge");
        console.error(error);
      }
    }
  };

  return (
    <div className="mt-8 md:mt-12">
      {/* Header - Mobile responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Gift className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            <h2 className="text-xl md:text-2xl font-serif font-semibold">Besondere Anlässe</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Fügen Sie beliebig viele Anlass-Menüs hinzu.
            <span className="block text-xs mt-1">Halten und ziehen zum Sortieren.</span>
          </p>
        </div>
        <Button 
          onClick={handleAddNew} 
          disabled={createMutation.isPending}
          className="w-full sm:w-auto h-12 sm:h-10 touch-manipulation"
        >
          <Plus className="h-4 w-4 mr-2" />
          {createMutation.isPending ? "Erstellen..." : "Hinzufügen"}
        </Button>
      </div>

      {/* Menu Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : specialMenus && specialMenus.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={specialMenus.map((m) => m.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              {specialMenus.map((menu) => (
                <SortableMenuCard key={menu.id} id={menu.id}>
                  <SpecialMenuCard
                    menu={menu}
                    onDelete={handleDelete}
                    isDeleting={deleteMutation.isPending}
                  />
                </SortableMenuCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="bg-card rounded-lg border border-border p-6 md:p-8 text-center">
          <Gift className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-serif font-semibold mb-2">Keine Anlässe vorhanden</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Klicken Sie auf "Hinzufügen", um Ihr erstes Anlass-Menü zu erstellen.
          </p>
          <Button 
            onClick={handleAddNew} 
            disabled={createMutation.isPending}
            className="h-12 sm:h-10 touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ersten Anlass erstellen
          </Button>
        </div>
      )}
    </div>
  );
};

export default SpecialOccasionsManager;
