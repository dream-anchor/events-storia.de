import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, GripVertical } from "lucide-react";

interface MenuItem {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number | null;
  price_display: string;
  sort_order: number;
}

interface MenuCategory {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  sort_order: number;
  items: MenuItem[];
}

interface ParsedMenu {
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  categories: MenuCategory[];
}

interface MenuPreviewProps {
  data: ParsedMenu;
  onUpdate: (data: ParsedMenu) => void;
}

const MenuPreview = ({ data, onUpdate }: MenuPreviewProps) => {
  const updateTitle = (value: string) => {
    onUpdate({ ...data, title: value });
  };

  const updateTitleEn = (value: string) => {
    onUpdate({ ...data, title_en: value });
  };

  const updateSubtitle = (value: string) => {
    onUpdate({ ...data, subtitle: value });
  };

  const updateSubtitleEn = (value: string) => {
    onUpdate({ ...data, subtitle_en: value });
  };

  const updateCategory = (catIndex: number, field: keyof MenuCategory, value: string) => {
    const newCategories = [...data.categories];
    newCategories[catIndex] = { ...newCategories[catIndex], [field]: value };
    onUpdate({ ...data, categories: newCategories });
  };

  const updateItem = (catIndex: number, itemIndex: number, field: keyof MenuItem, value: string | number | null) => {
    const newCategories = [...data.categories];
    const newItems = [...newCategories[catIndex].items];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    newCategories[catIndex] = { ...newCategories[catIndex], items: newItems };
    onUpdate({ ...data, categories: newCategories });
  };

  const deleteItem = (catIndex: number, itemIndex: number) => {
    const newCategories = [...data.categories];
    const newItems = newCategories[catIndex].items.filter((_, i) => i !== itemIndex);
    newCategories[catIndex] = { ...newCategories[catIndex], items: newItems };
    onUpdate({ ...data, categories: newCategories });
  };

  const addItem = (catIndex: number) => {
    const newCategories = [...data.categories];
    const newItem: MenuItem = {
      name: 'Neues Gericht',
      name_en: '',
      description: '',
      description_en: '',
      price: 0,
      price_display: '€0,00',
      sort_order: newCategories[catIndex].items.length,
    };
    newCategories[catIndex] = {
      ...newCategories[catIndex],
      items: [...newCategories[catIndex].items, newItem],
    };
    onUpdate({ ...data, categories: newCategories });
  };

  const deleteCategory = (catIndex: number) => {
    const newCategories = data.categories.filter((_, i) => i !== catIndex);
    onUpdate({ ...data, categories: newCategories });
  };

  const addCategory = () => {
    const newCategory: MenuCategory = {
      name: 'Neue Kategorie',
      name_en: '',
      description: '',
      description_en: '',
      sort_order: data.categories.length,
      items: [],
    };
    onUpdate({ ...data, categories: [...data.categories, newCategory] });
  };

  return (
    <div className="border border-border rounded-lg p-4 md:p-6 space-y-6 bg-secondary/30">
      <div className="space-y-4">
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Vorschau & Bearbeitung
        </h4>

        {/* Title & Subtitle - German */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs md:text-sm font-medium mb-1 block">Titel (Deutsch)</label>
            <Textarea
              value={data.title || ''}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="Menü-Titel"
              className="min-h-[60px] md:min-h-[80px] resize-y text-base"
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs md:text-sm font-medium mb-1 block">Titel (English)</label>
            <Textarea
              value={data.title_en || ''}
              onChange={(e) => updateTitleEn(e.target.value)}
              placeholder="Menu Title"
              className="min-h-[60px] md:min-h-[80px] resize-y text-base"
              rows={2}
            />
          </div>
        </div>

        {/* Subtitle - German & English */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-xs md:text-sm font-medium mb-1 block">Untertitel (Deutsch)</label>
            <Textarea
              value={data.subtitle || ''}
              onChange={(e) => updateSubtitle(e.target.value)}
              placeholder="Zusätzliche Info"
              className="min-h-[60px] md:min-h-[80px] resize-y text-base"
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs md:text-sm font-medium mb-1 block">Untertitel (English)</label>
            <Textarea
              value={data.subtitle_en || ''}
              onChange={(e) => updateSubtitleEn(e.target.value)}
              placeholder="Additional Info"
              className="min-h-[60px] md:min-h-[80px] resize-y text-base"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {data.categories.map((category, catIndex) => (
          <div key={catIndex} className="border border-border rounded-lg p-3 md:p-4 bg-background">
            {/* Category Header - Touch optimized */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="pt-2 touch-manipulation cursor-grab flex-shrink-0">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Kategorie</label>
                  <Textarea
                    value={category.name}
                    onChange={(e) => updateCategory(catIndex, 'name', e.target.value)}
                    className="font-semibold min-h-[60px] resize-y text-base"
                    placeholder="Kategoriename"
                    rows={2}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteCategory(catIndex)}
                className="text-destructive hover:text-destructive h-10 w-10 mt-6 touch-manipulation flex-shrink-0"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>

            {/* Items - Touch optimized */}
            <div className="space-y-4 ml-0 sm:ml-6">
              {category.items.map((item, itemIndex) => (
                <div 
                  key={itemIndex} 
                  className="flex flex-col gap-3 p-3 md:p-4 bg-secondary/50 rounded-lg relative"
                >
                  {/* Delete button - Top right, larger for touch */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteItem(catIndex, itemIndex)}
                    className="absolute top-2 right-2 h-10 w-10 text-destructive hover:text-destructive touch-manipulation"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  
                  {/* Fields - Stacked on mobile */}
                  <div className="pr-12">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Gericht</label>
                    <Textarea
                      value={item.name}
                      onChange={(e) => updateItem(catIndex, itemIndex, 'name', e.target.value)}
                      placeholder="Gericht"
                      className="min-h-[60px] resize-y text-base"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Preis</label>
                    <Input
                      value={item.price_display}
                      onChange={(e) => updateItem(catIndex, itemIndex, 'price_display', e.target.value)}
                      placeholder="Preis"
                      className="text-base h-12"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Beschreibung (optional)</label>
                    <Textarea
                      value={item.description || ''}
                      onChange={(e) => updateItem(catIndex, itemIndex, 'description', e.target.value)}
                      placeholder="Beschreibung"
                      className="min-h-[60px] resize-y text-base"
                      rows={2}
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => addItem(catIndex)}
                className="w-full h-12 sm:h-10 touch-manipulation"
              >
                <Plus className="h-4 w-4 mr-2" />
                Gericht hinzufügen
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          onClick={addCategory}
          className="w-full h-12 sm:h-10 touch-manipulation"
        >
          <Plus className="h-4 w-4 mr-2" />
          Kategorie hinzufügen
        </Button>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground border-t border-border pt-4">
        {data.categories.length} Kategorien, {data.categories.reduce((sum, cat) => sum + cat.items.length, 0)} Gerichte
      </div>
    </div>
  );
};

export default MenuPreview;
