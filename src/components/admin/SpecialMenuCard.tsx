import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { FileText, ExternalLink, Calendar, Trash2, Layers, UtensilsCrossed, Pencil, X, Save } from "lucide-react";
import { SpecialMenu, useMenuContent, useSaveMenuContent, ParsedMenu } from "@/hooks/useSpecialMenus";
import MenuUploader from "./MenuUploader";
import MenuPreview from "./MenuPreview";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SpecialMenuCardProps {
  menu: SpecialMenu;
  onDelete: (menuId: string) => void;
  isDeleting: boolean;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const SpecialMenuCard = ({ menu, onDelete, isDeleting }: SpecialMenuCardProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ParsedMenu | null>(null);
  
  const { data: menuContent, isLoading: isLoadingContent } = useMenuContent(
    isEditing ? menu.id : undefined
  );
  const saveMenuContent = useSaveMenuContent();

  const hasContent = menu.category_count > 0 || menu.item_count > 0;

  useEffect(() => {
    if (menuContent && isEditing) {
      setEditData(menuContent);
    }
  }, [menuContent, isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const handleSaveEdit = async () => {
    if (!editData) return;

    try {
      await saveMenuContent.mutateAsync({ menuId: menu.id, data: editData });
      toast({
        title: "Gespeichert",
        description: "Änderungen wurden erfolgreich gespeichert.",
      });
      setIsEditing(false);
      setEditData(null);
    } catch (error) {
      console.error('Error saving menu:', error);
      toast({
        title: "Fehler",
        description: "Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border">
        {/* Header */}
        <div className="p-4 md:p-6 flex items-start sm:items-center justify-between gap-2">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-left min-w-0">
              <h3 className="text-base md:text-lg font-serif font-semibold truncate">
                {menu.title || "Neuer Anlass"}
              </h3>
              {menu.subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground truncate">{menu.subtitle}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {hasContent && !isEditing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStartEdit}
                className="h-10 w-10 touch-manipulation"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            
            <Badge variant={menu.is_published ? "default" : "secondary"} className="text-xs hidden sm:inline-flex">
              {menu.is_published ? "Veröffentlicht" : "Entwurf"}
            </Badge>
            
            {/* Delete Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:text-destructive h-10 w-10 touch-manipulation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 sm:mx-auto max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Anlass-Menü löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Möchten Sie "{menu.title || 'Neuer Anlass'}" wirklich löschen? 
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto h-12 sm:h-10">Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(menu.id)}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto h-12 sm:h-10"
                  >
                    {isDeleting ? "Löschen..." : "Löschen"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Mobile status badge */}
        <div className="px-4 pb-2 sm:hidden">
          <Badge variant={menu.is_published ? "default" : "secondary"} className="text-xs">
            {menu.is_published ? "Veröffentlicht" : "Entwurf"}
          </Badge>
        </div>

        {/* Content */}
        <div className={cn(
          "px-4 md:px-6 pb-4 md:pb-6 pt-2 border-t border-border",
          isEditing && "pb-28 md:pb-24" // Extra padding for floating save bar
        )}>
          {/* Stats - 1 column on mobile, 3 on desktop */}
          {hasContent && !isEditing && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-3 md:p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Kategorien:</p>
                  <p className="font-medium text-sm">{menu.category_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Gerichte:</p>
                  <p className="font-medium text-sm">{menu.item_count}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Aktualisiert:</p>
                  <p className="font-medium text-xs">{formatDate(menu.updated_at)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isEditing && menu.is_published && (
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" asChild className="h-10 touch-manipulation">
                <Link to="/besondere-anlaesse">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Auf Website ansehen
                </Link>
              </Button>
            </div>
          )}

          {/* Edit Mode */}
          {isEditing && (
            <div className="mb-4">
              {isLoadingContent ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : editData ? (
                <MenuPreview data={editData} onUpdate={setEditData} />
              ) : (
                <p className="text-muted-foreground">Keine Daten verfügbar.</p>
              )}
            </div>
          )}

          {/* Uploader */}
          {!isEditing && (
            <MenuUploader 
              menuType="special" 
              menuLabel={menu.title || "Anlass-Menü"} 
              existingMenuId={menu.id}
            />
          )}
        </div>
      </div>
      
      {/* Floating Save Bar - iOS Safe Area aware */}
      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50"
             style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleCancelEdit}
              className="w-full sm:w-auto h-12 sm:h-10 order-2 sm:order-1 touch-manipulation"
            >
              <X className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={saveMenuContent.isPending || !editData}
              className="w-full sm:w-auto h-12 sm:h-10 order-1 sm:order-2 touch-manipulation"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMenuContent.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default SpecialMenuCard;
