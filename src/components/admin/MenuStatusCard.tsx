import { useAdminMenuByType } from "@/hooks/useAdminMenus";
import { MenuType } from "@/hooks/useMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Layers, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MenuStatusCardProps {
  menuType: MenuType;
  menuLabel: string;
  viewPath: string;
}

const menuTypeLabels: Record<MenuType, string> = {
  lunch: "Mittagsmenü",
  food: "Speisekarte",
  drinks: "Getränkekarte",
  christmas: "Weihnachtsmenü",
  valentines: "Valentinstag-Menü",
  special: "Besondere Anlässe",
};

const MenuStatusCard = ({ menuType, menuLabel, viewPath }: MenuStatusCardProps) => {
  const { data: menu, isLoading } = useAdminMenuByType(menuType);

  if (isLoading) {
    return (
      <div className="bg-secondary/30 rounded-md p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="bg-secondary/30 rounded-md p-4 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Noch kein {menuLabel} erstellt
          </span>
          <Badge variant="secondary" className="text-xs">
            Nicht vorhanden
          </Badge>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-secondary/30 rounded-md p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {menu.title ? (
            <span className="font-medium">{menu.title}</span>
          ) : (
            <span className="text-muted-foreground italic">Kein Titel</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {menu.is_published ? (
            <Badge className="bg-green-600 hover:bg-green-700 text-xs">
              Veröffentlicht
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Entwurf
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => window.open(viewPath, '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          <span>{menu.category_count} Kategorien</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          <span>{menu.item_count} Gerichte</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>Aktualisiert: {formatDate(menu.updated_at)}</span>
        </div>
      </div>
    </div>
  );
};

export default MenuStatusCard;
