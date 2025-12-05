import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, Check, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import MenuPreview from "./MenuPreview";
import type { MenuType } from "@/hooks/useMenu";

interface MenuUploaderProps {
  menuType: MenuType;
  menuLabel: string;
  existingMenuId?: string; // For special occasions that already have an ID
}

interface ParsedCategory {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  sort_order: number;
  items: ParsedItem[];
}

interface ParsedItem {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number | null;
  price_display: string;
  sort_order: number;
}

interface ParsedMenu {
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  categories: ParsedCategory[];
}

const MenuUploader = ({ menuType, menuLabel, existingMenuId }: MenuUploaderProps) => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedMenu | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Bitte wählen Sie eine PDF-Datei');
        return;
      }
      setFile(selectedFile);
      setParsedData(null);
      setShowPreview(false);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleParse = async () => {
    if (!file) {
      toast.error('Bitte wählen Sie zuerst eine Datei');
      return;
    }

    setIsParsing(true);
    try {
      // Convert PDF to Base64 for multimodal AI processing
      const pdfBase64 = await convertToBase64(file);

      // Send to edge function for AI parsing
      const { data, error } = await supabase.functions.invoke('parse-menu-pdf', {
        body: { pdfBase64, menuType }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setParsedData(data.data);
      setShowPreview(true);
      toast.success('Menü erfolgreich analysiert! Bitte überprüfen Sie die Daten.');
    } catch (err) {
      console.error('Parse error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler beim Analysieren der PDF');
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpdateParsedData = (updatedData: ParsedMenu) => {
    setParsedData(updatedData);
  };

  const handlePublish = async () => {
    if (!parsedData) return;

    setIsSaving(true);
    try {
      let menuId: string;

      if (existingMenuId) {
        // Use the provided existing menu ID (for special occasions)
        const { error: updateError } = await supabase
          .from('menus')
          .update({
            title: parsedData.title,
            subtitle: parsedData.subtitle,
            is_published: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingMenuId);

        if (updateError) throw updateError;
        menuId = existingMenuId;

        // Delete old categories (cascade deletes items)
        await supabase
          .from('menu_categories')
          .delete()
          .eq('menu_id', menuId);
      } else {
        // Check if menu exists by type (for standard menus)
        const { data: existingMenu } = await supabase
          .from('menus')
          .select('id')
          .eq('menu_type', menuType)
          .maybeSingle();

        if (existingMenu) {
          // Update existing menu
          const { error: updateError } = await supabase
            .from('menus')
            .update({
              title: parsedData.title,
              subtitle: parsedData.subtitle,
              is_published: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingMenu.id);

          if (updateError) throw updateError;
          menuId = existingMenu.id;

          // Delete old categories (cascade deletes items)
          await supabase
            .from('menu_categories')
            .delete()
            .eq('menu_id', menuId);
        } else {
          // Create new menu
          const { data: newMenu, error: insertError } = await supabase
            .from('menus')
            .insert({
              menu_type: menuType,
              title: parsedData.title,
              subtitle: parsedData.subtitle,
              is_published: false,
            })
            .select()
            .single();

          if (insertError) throw insertError;
          menuId = newMenu.id;
        }
      }

      // Insert categories and items
      for (const category of parsedData.categories) {
        const { data: newCat, error: catError } = await supabase
          .from('menu_categories')
          .insert({
            menu_id: menuId,
            name: category.name,
            name_en: category.name_en || null,
            description: category.description || null,
            description_en: category.description_en || null,
            sort_order: Math.floor(category.sort_order),
          })
          .select()
          .single();

        if (catError) throw catError;

        // Insert items
        for (const item of category.items) {
          const { error: itemError } = await supabase
            .from('menu_items')
            .insert({
              category_id: newCat.id,
              name: item.name,
              name_en: item.name_en || null,
              description: item.description || null,
              description_en: item.description_en || null,
              price: item.price,
              price_display: item.price_display,
              sort_order: Math.floor(item.sort_order),
            });

          if (itemError) throw itemError;
        }
      }

      // Publish the menu
      const { error: publishError } = await supabase
        .from('menus')
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .eq('id', menuId);

      if (publishError) throw publishError;

      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['special-menus'] });
      queryClient.invalidateQueries({ queryKey: ['published-special-menus'] });
      queryClient.invalidateQueries({ queryKey: ['admin-menus'] });
      queryClient.invalidateQueries({ queryKey: ['menu', menuType] });
      if (existingMenuId) {
        queryClient.invalidateQueries({ queryKey: ['menu-by-id', existingMenuId] });
      }

      toast.success(`${menuLabel} erfolgreich veröffentlicht!`);
      setFile(null);
      setParsedData(null);
      setShowPreview(false);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Fehler beim Speichern des Menüs');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Upload Section - Stacked on mobile */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="flex-1 h-12 text-base"
        />
        <Button
          onClick={handleParse}
          disabled={!file || isParsing}
          className="w-full sm:w-auto h-12 sm:h-10 touch-manipulation"
        >
          {isParsing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analysieren...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Analysieren
            </>
          )}
        </Button>
      </div>

      {file && (
        <p className="text-xs md:text-sm text-muted-foreground truncate">
          Ausgewählt: {file.name}
        </p>
      )}

      {/* Preview Toggle & Publish - Stacked on mobile */}
      {parsedData && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full sm:w-auto h-12 sm:h-10 touch-manipulation"
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isSaving}
            className="w-full sm:w-auto h-12 sm:h-10 touch-manipulation"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Speichern...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Veröffentlichen
              </>
            )}
          </Button>
        </div>
      )}

      {/* Preview */}
      {showPreview && parsedData && (
        <MenuPreview
          data={parsedData}
          onUpdate={handleUpdateParsedData}
        />
      )}
    </div>
  );
};

export default MenuUploader;
