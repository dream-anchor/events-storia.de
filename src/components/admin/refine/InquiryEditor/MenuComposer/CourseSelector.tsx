import { useState, useMemo } from "react";
import { Search, Check, ChefHat, Utensils } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CourseConfig, CourseSelection, MenuItem, COURSE_ICONS } from "./types";

interface CourseSelectorProps {
  courseConfig: CourseConfig;
  currentSelection: CourseSelection | null;
  menuItems: MenuItem[];
  onSelect: (selection: CourseSelection) => void;
  onNext: () => void;
}

export const CourseSelector = ({
  courseConfig,
  currentSelection,
  menuItems,
  onSelect,
  onNext,
}: CourseSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSource, setActiveSource] = useState<'all' | 'catering' | 'ristorante'>(
    courseConfig.allowed_sources.length === 1 
      ? courseConfig.allowed_sources[0] 
      : 'all'
  );

  // Filter menu items based on config
  const filteredItems = useMemo(() => {
    let items = menuItems;

    // Filter by allowed sources
    if (courseConfig.allowed_sources.length > 0) {
      items = items.filter(item => courseConfig.allowed_sources.includes(item.source));
    }

    // Filter by allowed categories
    if (courseConfig.allowed_categories.length > 0) {
      items = items.filter(item => 
        courseConfig.allowed_categories.some(cat => 
          item.category_name.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(item.category_name.toLowerCase())
        )
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    }

    // Filter by source tab
    if (activeSource !== 'all') {
      items = items.filter(item => item.source === activeSource);
    }

    return items;
  }, [menuItems, courseConfig, searchQuery, activeSource]);

  // Group by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    filteredItems.forEach(item => {
      if (!grouped[item.category_name]) {
        grouped[item.category_name] = [];
      }
      grouped[item.category_name].push(item);
    });
    return grouped;
  }, [filteredItems]);

  const handleItemSelect = (item: MenuItem) => {
    onSelect({
      courseType: courseConfig.course_type,
      courseLabel: courseConfig.course_label,
      itemId: item.id,
      itemName: item.name,
      itemDescription: item.description,
      itemSource: item.source,
      isCustom: false,
    });
  };

  // If this is a custom item (like Vorspeisenplatte), show it as pre-selected
  if (courseConfig.is_custom_item && courseConfig.custom_item_name) {
    const isAlreadySelected = currentSelection?.isCustom && 
      currentSelection.itemName === courseConfig.custom_item_name;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-xl">{COURSE_ICONS[courseConfig.course_type]}</span>
            {courseConfig.course_label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            onClick={() => {
              onSelect({
                courseType: courseConfig.course_type,
                courseLabel: courseConfig.course_label,
                itemId: null,
                itemName: courseConfig.custom_item_name!,
                itemDescription: courseConfig.custom_item_description,
                itemSource: 'custom',
                isCustom: true,
              });
            }}
            className={cn(
              "p-4 rounded-xl border-2 cursor-pointer transition-all",
              "hover:border-primary/50 hover:shadow-sm",
              isAlreadySelected
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-base">{courseConfig.custom_item_name}</h4>
                {courseConfig.custom_item_description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {courseConfig.custom_item_description}
                  </p>
                )}
              </div>
              {isAlreadySelected && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
            <Badge variant="secondary" className="mt-3">
              Im Paket enthalten
            </Badge>
          </div>

          {isAlreadySelected && (
            <Button onClick={onNext} className="w-full mt-4">
              Weiter zum nächsten Gang
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-xl">{COURSE_ICONS[courseConfig.course_type]}</span>
          {courseConfig.course_label}
          {courseConfig.is_required && (
            <Badge variant="destructive" className="ml-2 text-xs">Pflicht</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Gericht suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {courseConfig.allowed_sources.length > 1 && (
            <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as typeof activeSource)}>
              <TabsList className="h-10">
                <TabsTrigger value="all" className="text-xs">Alle</TabsTrigger>
                <TabsTrigger value="catering" className="text-xs">
                  <ChefHat className="h-3 w-3 mr-1" />
                  Catering
                </TabsTrigger>
                <TabsTrigger value="ristorante" className="text-xs">
                  <Utensils className="h-3 w-3 mr-1" />
                  Restaurant
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* Category Info */}
        {courseConfig.allowed_categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {courseConfig.allowed_categories.map(cat => (
              <Badge key={cat} variant="outline" className="text-xs">
                {cat}
              </Badge>
            ))}
          </div>
        )}

        {/* Items Grid */}
        <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
          {Object.entries(itemsByCategory).map(([category, items]) => (
            <div key={category}>
              <h5 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {category}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map(item => {
                  const isSelected = currentSelection?.itemId === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemSelect(item)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        "hover:border-primary/50 hover:bg-muted/50",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm truncate">{item.name}</h4>
                            {item.source === 'ristorante' && (
                              <Utensils className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                            {item.source === 'catering' && (
                              <ChefHat className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Keine Gerichte gefunden</p>
              {searchQuery && (
                <Button
                  variant="link"
                  onClick={() => setSearchQuery("")}
                  className="text-xs mt-1"
                >
                  Filter zurücksetzen
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Continue Button */}
        {currentSelection?.itemId && (
          <Button onClick={onNext} className="w-full">
            Weiter zum nächsten Gang
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
