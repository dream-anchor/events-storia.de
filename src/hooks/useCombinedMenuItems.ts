import { useMemo } from "react";
import { useList } from "@refinedev/core";
import { useRistoranteMenus, RistoranteMenuItem } from "./useRistoranteMenus";

export interface CombinedMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  serving_info: string | null;
  image_url: string | null;
  category_name: string;
  source: 'catering' | 'ristorante';
  menu_type?: string;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
}

interface UseCombinedMenuItemsOptions {
  includeRistorante?: boolean;
  includeCatering?: boolean;
}

export const useCombinedMenuItems = (options: UseCombinedMenuItemsOptions = {}) => {
  const { 
    includeRistorante = true, 
    includeCatering = true 
  } = options;

  // Fetch local catering menu items
  const cateringQuery = useList({
    resource: "menu_items",
    pagination: { pageSize: 200 },
    sorters: [{ field: "sort_order", order: "asc" }],
    meta: {
      select: "*, menu_categories!inner(name, menu_id, menus!inner(menu_type))",
    },
  });

  // Fetch restaurant menu items (food & drinks)
  const ristoranteQuery = useRistoranteMenus({ 
    menuTypes: ['food', 'drinks', 'lunch'],
    enabled: includeRistorante 
  });

  const isLoading = cateringQuery.query.isLoading || ristoranteQuery.isLoading;
  const isError = cateringQuery.query.isError || ristoranteQuery.isError;

  // Combine both sources into unified format
  const combinedItems = useMemo((): CombinedMenuItem[] => {
    const items: CombinedMenuItem[] = [];

    // Add catering items
    if (includeCatering && cateringQuery.result?.data) {
      for (const item of cateringQuery.result.data) {
        const menuItem = item as Record<string, unknown>;
        const category = menuItem.menu_categories as { name?: string } | undefined;
        
        items.push({
          id: `catering_${menuItem.id}`,
          name: menuItem.name as string,
          description: menuItem.description as string | null,
          price: menuItem.price as number | null,
          serving_info: menuItem.serving_info as string | null,
          image_url: menuItem.image_url as string | null,
          category_name: category?.name || 'Catering',
          source: 'catering',
          is_vegetarian: menuItem.is_vegetarian as boolean,
          is_vegan: menuItem.is_vegan as boolean,
        });
      }
    }

    // Add ristorante items
    if (includeRistorante && ristoranteQuery.data?.items) {
      for (const item of ristoranteQuery.data.items) {
        items.push({
          id: `ristorante_${item.id}`,
          name: item.name,
          description: item.description,
          price: item.price,
          serving_info: item.serving_info || null,
          image_url: item.image_url,
          category_name: item.category_name || 'Restaurant',
          source: 'ristorante',
          menu_type: item.menu_type,
          is_vegetarian: item.is_vegetarian,
          is_vegan: item.is_vegan,
        });
      }
    }

    return items;
  }, [includeCatering, includeRistorante, cateringQuery.result?.data, ristoranteQuery.data?.items]);

  // Group by source for display
  const groupedItems = useMemo(() => {
    const cateringItems = combinedItems.filter(i => i.source === 'catering');
    const ristoranteItems = combinedItems.filter(i => i.source === 'ristorante');
    
    // Further group ristorante by menu type
    const ristoranteFood = ristoranteItems.filter(i => i.menu_type === 'food' || i.menu_type === 'lunch');
    const ristoranteDrinks = ristoranteItems.filter(i => i.menu_type === 'drinks');

    return {
      catering: cateringItems,
      ristoranteFood,
      ristoranteDrinks,
      all: combinedItems,
    };
  }, [combinedItems]);

  return {
    items: combinedItems,
    groupedItems,
    isLoading,
    isError,
    cateringCount: groupedItems.catering.length,
    ristoranteCount: groupedItems.ristoranteFood.length + groupedItems.ristoranteDrinks.length,
    totalCount: combinedItems.length,
  };
};
