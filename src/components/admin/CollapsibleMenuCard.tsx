import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Pencil, Save, X } from "lucide-react";
import { useMenuContent, useSaveMenuContent, ParsedMenu } from "@/hooks/useSpecialMenus";
import MenuPreview from "./MenuPreview";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CollapsibleMenuCardProps {
  title: string;
  menuId?: string;
  isPublished?: boolean;
  children: React.ReactNode;
}

const CollapsibleMenuCard = ({
  title,
  menuId,
  isPublished,
  children,
}: CollapsibleMenuCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ParsedMenu | null>(null);

  const { data: menuContent, isLoading } = useMenuContent(isEditing ? menuId : undefined);
  const saveMenuContent = useSaveMenuContent();

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
    if (!editData || !menuId) return;
    
    try {
      await saveMenuContent.mutateAsync({ menuId, data: editData });
      toast.success("Änderungen gespeichert");
      setIsEditing(false);
      setEditData(null);
    } catch (error) {
      toast.error("Fehler beim Speichern");
    }
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 md:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="text-base md:text-lg font-serif font-semibold truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {menuId && !isEditing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStartEdit}
                className="h-10 w-10 touch-manipulation"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isPublished !== undefined && (
              <Badge variant={isPublished ? "default" : "secondary"} className="text-xs">
                {isPublished ? "Veröffentlicht" : "Entwurf"}
              </Badge>
            )}
          </div>
        </div>
        <div className={cn(
          "px-4 md:px-6 pb-4 md:pb-6 pt-2 border-t border-border",
          isEditing && "pb-28 md:pb-24" // Extra padding for floating save bar
        )}>
          {isEditing ? (
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : editData ? (
                <MenuPreview data={editData} onUpdate={setEditData} />
              ) : (
                <p className="text-muted-foreground">Keine Daten vorhanden</p>
              )}
            </div>
          ) : (
            children
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

export default CollapsibleMenuCard;
