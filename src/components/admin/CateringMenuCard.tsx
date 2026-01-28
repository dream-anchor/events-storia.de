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
import { ChevronDown, ChevronUp, Trash2, Eye, EyeOff, ExternalLink, ImageIcon } from "lucide-react";
import { CateringMenu, useDeleteCateringMenu, useToggleCateringMenuPublish } from "@/hooks/useCateringMenus";
import { toast } from "sonner";
import { MenuHeaderEditor, AddCategoryButton } from "./MenuHeaderEditor";
import { CategoryEditor, AddItemButton } from "./CategoryEditor";
import MenuItemEditor from "./MenuItemEditor";

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
          <div className="flex flex-col gap-3">
            {/* Row 1: Title and basic info */}
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
                    {menu.subtitle && <span className="italic">{menu.subtitle} • </span>}
                    {menu.categories.length} Kategorien • {totalItems} Gerichte
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Badge variant={menu.is_published ? "default" : "secondary"}>
                  {menu.is_published ? "Veröffentlicht" : "Entwurf"}
                </Badge>
              </div>
            </div>

            {/* Row 2: Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <MenuHeaderEditor menu={menu} />
              <AddCategoryButton menuId={menu.id} />
              
              <div className="flex items-center gap-2 ml-auto">
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
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {menu.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Kategorien vorhanden. Füge eine Kategorie hinzu, um Gerichte anzulegen.
              </p>
            ) : (
              <div className="space-y-4">
                {menu.categories.map((category) => (
                  <div key={category.id} className="border rounded-lg p-4">
                    {/* Category Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{category.name}</h4>
                        {category.description && (
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                        )}
                      </div>
                      <CategoryEditor category={category} />
                    </div>
                    
                    {/* Items */}
                    {category.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground mb-2">
                        Keine Gerichte in dieser Kategorie.
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {category.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 py-2 border-b border-border last:border-0"
                          >
                            {/* Image thumbnail */}
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-12 h-12 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
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
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                              {item.serving_info && (
                                <p className="text-xs text-muted-foreground">
                                  {item.serving_info}
                                </p>
                              )}
                            </div>
                            
                            {/* Price */}
                            <div className="text-right flex-shrink-0">
                              {item.price_display ? (
                                <span className="font-medium text-sm">
                                  {item.price_display}
                                </span>
                              ) : item.price ? (
                                <span className="font-medium text-sm">
                                  {item.price.toFixed(2).replace(".", ",")} €
                                </span>
                              ) : null}
                              {item.min_order && (
                                <p className="text-xs text-muted-foreground">
                                  {item.min_order}
                                </p>
                              )}
                            </div>
                            
                            {/* Edit buttons */}
                            <MenuItemEditor item={item} />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add item button */}
                    <AddItemButton categoryId={category.id} />
                  </div>
                ))}
              </div>
            )}
            
            {menu.additional_info && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Zusatzinformationen</h4>
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
