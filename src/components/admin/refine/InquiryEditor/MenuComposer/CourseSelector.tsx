import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Check, ChefHat, Utensils, Globe, Sparkles, Plus, Command, ChevronRight, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { CourseConfig, CourseSelection, MenuItem, COURSE_ICONS } from "./types";
import { GlobalItemSearch } from "./GlobalItemSearch";
import { CustomItemInput } from "./CustomItemInput";
import { CombinedMenuItem } from "@/hooks/useCombinedMenuItems";
import { toast } from "sonner";

interface CourseSelectorProps {
  courseConfig: CourseConfig;
  currentSelections: CourseSelection[];
  menuItems: MenuItem[];
  allMenuItems?: MenuItem[]; // For global search
  onSelect: (selection: CourseSelection) => void;
  onNext: () => void;
  isLastCourse?: boolean;
}

export const CourseSelector = ({
  courseConfig,
  currentSelections,
  menuItems,
  allMenuItems = [],
  onSelect,
  onNext,
  isLastCourse = false,
}: CourseSelectorProps) => {
  // Compat: first selection for custom-item display
  const currentSelection = currentSelections[0] || null;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<'recommended' | 'global'>('recommended');
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeSource, setActiveSource] = useState<'all' | 'catering' | 'ristorante'>(
    courseConfig.allowed_sources.length === 1 
      ? courseConfig.allowed_sources[0] 
      : 'all'
  );
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cleanup auto-advance timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
      }
    };
  }, []);

  // Items to display based on mode
  const displayItems = useMemo(() => {
    const baseItems = searchMode === 'global' ? allMenuItems : menuItems;
    let items = [...baseItems];

    // In recommended mode, apply category/source filters
    if (searchMode === 'recommended') {
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
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        item.category_name.toLowerCase().includes(query)
      );
    }

    // Filter by source tab
    if (activeSource !== 'all') {
      items = items.filter(item => item.source === activeSource);
    }

    return items;
  }, [menuItems, allMenuItems, courseConfig, searchQuery, activeSource, searchMode]);

  // Group by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    displayItems.forEach(item => {
      if (!grouped[item.category_name]) {
        grouped[item.category_name] = [];
      }
      grouped[item.category_name].push(item);
    });
    return grouped;
  }, [displayItems]);

  const handleItemSelect = (item: MenuItem) => {
    const alreadySelected = isItemSelected(item.id);

    onSelect({
      courseType: courseConfig.course_type,
      courseLabel: courseConfig.course_label,
      itemId: item.id,
      itemName: item.name,
      itemDescription: item.description,
      itemSource: item.source,
      isCustom: false,
    });

    toast.success(
      alreadySelected ? `${item.name} entfernt` : `${item.name} hinzugefügt`,
      { duration: 1500 }
    );
  };

  const handleGlobalSelect = (item: CombinedMenuItem) => {
    const alreadySelected = isItemSelected(item.id);

    onSelect({
      courseType: courseConfig.course_type,
      courseLabel: courseConfig.course_label,
      itemId: item.id,
      itemName: item.name,
      itemDescription: item.description,
      itemSource: item.source,
      isCustom: false,
    });

    toast.success(
      alreadySelected ? `${item.name} entfernt` : `${item.name} hinzugefügt`,
      { duration: 1500 }
    );
  };

  const handleCustomItem = (item: { name: string; description: string | null }) => {
    onSelect({
      courseType: courseConfig.course_type,
      courseLabel: courseConfig.course_label,
      itemId: null,
      itemName: item.name,
      itemDescription: item.description,
      itemSource: 'manual',
      isCustom: true,
    });

    // Show success toast
    toast.success(`${item.name} hinzugefügt`, { duration: 1500 });
  };

  // Helper: check if an item is selected (by itemId)
  const isItemSelected = (itemId: string) =>
    currentSelections.some(s => s.itemId === itemId);

  const hasSelection = currentSelections.length > 0;
  const selectionCount = currentSelections.length;

  // Custom item courses (like Vorspeisenplatte) — with multi-select support
  if (courseConfig.is_custom_item && courseConfig.custom_item_name) {
    const isDefaultSelected = currentSelections.some(
      s => s.isCustom && s.itemSource === 'custom' && s.itemName === courseConfig.custom_item_name
    );

    // All non-default selections (alternatives from menu or manual entries)
    const alternativeSelections = currentSelections.filter(
      s => !(s.isCustom && s.itemSource === 'custom' && s.itemName === courseConfig.custom_item_name)
    );

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-xl">{COURSE_ICONS[courseConfig.course_type]}</span>
            {courseConfig.course_label}
            {selectionCount > 1 && (
              <Badge variant="secondary" className="text-xs">{selectionCount} Optionen</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Default custom item — toggle on/off */}
          <motion.div
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
              toast.success(
                isDefaultSelected
                  ? `${courseConfig.custom_item_name} entfernt`
                  : `${courseConfig.custom_item_name} hinzugefügt`,
                { duration: 1500 }
              );
            }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "p-4 rounded-xl border-2 cursor-pointer transition-all",
              "hover:border-primary/50 hover:shadow-sm",
              isDefaultSelected
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
              {isDefaultSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                >
                  <Check className="h-3 w-3 text-primary-foreground" />
                </motion.div>
              )}
            </div>
            <Badge variant="secondary" className="mt-3">
              Im Paket enthalten
            </Badge>
          </motion.div>

          {/* Show all alternative selections */}
          {alternativeSelections.length > 0 && (
            <div className="space-y-2">
              {alternativeSelections.map((sel, idx) => (
                <motion.div
                  key={sel.itemId || sel.itemName + idx}
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-3 rounded-xl border-2 border-primary bg-primary/5 cursor-pointer hover:bg-primary/10 transition-all"
                  onClick={() => {
                    onSelect(sel);
                    toast.success(`${sel.itemName} entfernt`, { duration: 1500 });
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{sel.itemName}</h4>
                        {sel.itemSource === 'ristorante' && <Utensils className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        {sel.itemSource === 'catering' && <ChefHat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        {sel.isCustom && sel.itemSource === 'manual' && (
                          <Badge variant="outline" className="text-[10px] px-1">Manuell</Badge>
                        )}
                      </div>
                      {sel.itemDescription && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{sel.itemDescription}</p>
                      )}
                    </div>
                    <motion.div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Add more items from menu */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowGlobalSearch(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {hasSelection ? 'Weitere Gerichte hinzufügen' : 'Gericht aus Karte wählen'}
          </Button>

          {/* Free-form item */}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setShowCustomInput(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Freie Position hinzufügen
          </Button>
        </CardContent>

        <GlobalItemSearch
          open={showGlobalSearch}
          onOpenChange={setShowGlobalSearch}
          onSelect={handleGlobalSelect}
          onCustomItem={() => setShowCustomInput(true)}
          filterType="food"
        />

        <CustomItemInput
          open={showCustomInput}
          onOpenChange={setShowCustomInput}
          onSubmit={handleCustomItem}
        />

        {/* Inline Action Bar */}
        <AnimatePresence>
          {hasSelection && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="mt-6 flex justify-start"
            >
              <Button
                onClick={onNext}
                size="lg"
                className="px-6 h-12 rounded-2xl shadow-lg text-base gap-2"
              >
                {isLastCourse ? "Weiter zu Getränke" : "Nächster Gang"}
                <ChevronRight className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
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
        {/* Current Selections Summary - always visible */}
        <AnimatePresence mode="wait">
          {hasSelection && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-4 rounded-xl border-2 border-primary bg-primary/5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {selectionCount === 1 ? 'Auswahl' : `${selectionCount} Optionen für Gäste`}
                </p>
                <Badge variant="secondary" className="text-xs">{selectionCount}</Badge>
              </div>
              {currentSelections.map((sel, idx) => (
                <div key={sel.itemId || sel.itemName + idx} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{sel.itemName}</span>
                  {sel.itemSource === 'ristorante' && <Utensils className="h-3 w-3 text-muted-foreground shrink-0" />}
                  {sel.itemSource === 'catering' && <ChefHat className="h-3 w-3 text-muted-foreground shrink-0" />}
                  {sel.isCustom && <Badge variant="outline" className="text-[10px] px-1">Manuell</Badge>}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact Search + Filter Toggle (Progressive Disclosure) */}
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "shrink-0 h-11 w-11",
              showFilters && "bg-muted"
            )}
            title="Filter anzeigen"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Gericht suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowGlobalSearch(true)}
            className="shrink-0 h-11 w-11"
            title="Schnellsuche (⌘K)"
          >
            <Command className="h-4 w-4" />
          </Button>
        </div>

        {/* Collapsible Filters (Progressive Disclosure) */}
        <Collapsible open={showFilters}>
          <CollapsibleContent className="space-y-3 pt-2">
            {/* Search Mode Toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-full">
              <button
                onClick={() => setSearchMode('recommended')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px]",
                  searchMode === 'recommended'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="h-4 w-4" />
                Empfohlen
              </button>
              <button
                onClick={() => setSearchMode('global')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px]",
                  searchMode === 'global'
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Globe className="h-4 w-4" />
                Alle Speisen
              </button>
            </div>

            {/* Source Filter - only in global mode */}
            {searchMode === 'global' && (
              <Tabs value={activeSource} onValueChange={(v) => setActiveSource(v as typeof activeSource)}>
                <TabsList className="h-11 w-full">
                  <TabsTrigger value="all" className="text-xs flex-1 min-h-[44px]">Alle</TabsTrigger>
                  <TabsTrigger value="catering" className="text-xs flex-1 min-h-[44px]">
                    <ChefHat className="h-3 w-3 mr-1" />
                    Catering
                  </TabsTrigger>
                  <TabsTrigger value="ristorante" className="text-xs flex-1 min-h-[44px]">
                    <Utensils className="h-3 w-3 mr-1" />
                    Restaurant
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Category Info - only in recommended mode */}
            {searchMode === 'recommended' && courseConfig.allowed_categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {courseConfig.allowed_categories.map(cat => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Items Grid */}
        <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2 pb-20">
          {Object.entries(itemsByCategory).map(([category, items]) => (
            <div key={category}>
              <h5 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {category}
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map(item => {
                  const isSelected = isItemSelected(item.id);
                  
                  return (
                    <motion.div
                      key={item.id}
                      onClick={() => handleItemSelect(item)}
                      whileTap={{ scale: 0.97 }}
                      animate={isSelected ? { scale: [1, 1.02, 1] } : {}}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "p-3 rounded-xl border cursor-pointer transition-all",
                        "hover:border-primary/50 hover:bg-muted/50",
                        isSelected 
                          ? "border-primary bg-primary/5 shadow-sm" 
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
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                              className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                            >
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}

          {displayItems.length === 0 && (
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

        {/* Add Custom Item Button */}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => setShowCustomInput(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Freie Position hinzufügen
        </Button>
      </CardContent>

      {/* Global Search Dialog */}
      <GlobalItemSearch
        open={showGlobalSearch}
        onOpenChange={setShowGlobalSearch}
        onSelect={handleGlobalSelect}
        onCustomItem={() => setShowCustomInput(true)}
        filterType="food"
      />

      {/* Custom Item Dialog */}
      <CustomItemInput
        open={showCustomInput}
        onOpenChange={setShowCustomInput}
        onSubmit={handleCustomItem}
      />

      {/* Inline Action Bar - unten links */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="mt-6 flex justify-start"
          >
            <Button 
              onClick={onNext} 
              size="lg"
              className="px-6 h-12 rounded-2xl shadow-lg text-base gap-2"
            >
              {isLastCourse ? "Weiter zu Getränke" : "Nächster Gang"}
              <ChevronRight className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};
