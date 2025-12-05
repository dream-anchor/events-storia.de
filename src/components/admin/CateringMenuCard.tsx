import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { CateringMenu, useDeleteCateringMenu, useToggleCateringMenuPublish } from "@/hooks/useCateringMenus";
import { toast } from "sonner";

interface CateringMenuCardProps {
  menu: CateringMenu;
}

const CateringMenuCard = ({ menu }: CateringMenuCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const deleteMutation = useDeleteCateringMenu();
  const togglePublishMutation = useToggleCateringMenuPublish();

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(menu.id);
      toast.success("Catering-Menü gelöscht");
    } catch (error) {
      toast.error("Fehler beim Löschen");
    }
  };

  const handleTogglePublish = async () => {
    try {
      await togglePublishMutation.mutateAsync({
        menuId: menu.id,
        isPublished: !menu.is_published,
      });
      toast.success(
        menu.is_published ? "Menü deaktiviert" : "Menü veröffentlicht"
      );
    } catch (error) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const totalItems = menu.categories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  );

  return (
    <Card className="border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1 h-auto">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div>
                <CardTitle className="text-lg">{menu.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  /{menu.slug} • {menu.categories.length} Kategorien • {totalItems} Gerichte
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={menu.is_published ? "default" : "secondary"}>
                {menu.is_published ? "Veröffentlicht" : "Entwurf"}
              </Badge>
              <div className="flex items-center gap-2">
                {menu.is_published ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                  checked={menu.is_published}
                  onCheckedChange={handleTogglePublish}
                  disabled={togglePublishMutation.isPending}
                />
              </div>
              {menu.slug && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/catering/${menu.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Menü löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Das Catering-Menü "{menu.title}" wird unwiderruflich gelöscht, 
                      einschließlich aller Kategorien und Gerichte.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {menu.subtitle && (
              <p className="text-sm text-muted-foreground mb-4 italic">
                {menu.subtitle}
              </p>
            )}
            {menu.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Kategorien vorhanden.
              </p>
            ) : (
              <div className="space-y-4">
                {menu.categories.map((category) => (
                  <div key={category.id} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">{category.name}</h4>
                    {category.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Keine Gerichte in dieser Kategorie.
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {category.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-start py-2 border-b border-border last:border-0"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.name}</span>
                                {item.is_vegetarian && (
                                  <Badge variant="outline" className="text-xs">
                                    V
                                  </Badge>
                                )}
                                {item.is_vegan && (
                                  <Badge variant="outline" className="text-xs">
                                    VG
                                  </Badge>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                              {item.serving_info && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.serving_info}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              {item.price_display ? (
                                <span className="font-medium">
                                  {item.price_display}
                                </span>
                              ) : item.price ? (
                                <span className="font-medium">
                                  {item.price.toFixed(2).replace(".", ",")} €
                                </span>
                              ) : null}
                              {item.min_order && (
                                <p className="text-xs text-muted-foreground">
                                  {item.min_order}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {menu.additional_info && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Zusatzleistungen</h4>
                <p className="text-sm whitespace-pre-line">
                  {menu.additional_info}
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default CateringMenuCard;
