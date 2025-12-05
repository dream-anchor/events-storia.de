import { useCateringMenus } from "@/hooks/useCateringMenus";
import CateringMenuCard from "./CateringMenuCard";
import { Skeleton } from "@/components/ui/skeleton";

const CateringMenusManager = () => {
  const { data: menus, isLoading, error } = useCateringMenus();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Fehler beim Laden der Catering-Menüs.
      </div>
    );
  }

  if (!menus || menus.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Keine Catering-Menüs vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {menus.map((menu) => (
        <CateringMenuCard key={menu.id} menu={menu} />
      ))}
    </div>
  );
};

export default CateringMenusManager;
