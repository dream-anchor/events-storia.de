import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRistoranteMenus } from "./useRistoranteMenus";

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

/** Parst "14,50 €" oder "14.50€" → 14.50 */
function parsePriceDisplay(priceDisplay: string | null | undefined): number | null {
  if (!priceDisplay) return null;
  const cleaned = priceDisplay.replace(/[€\s]/g, '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

interface UseCombinedMenuItemsOptions {
  includeRistorante?: boolean;
  includeCatering?: boolean;
}

interface CateringRow {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  serving_info: string | null;
  image_url: string | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  menu_categories: {
    name: string;
  } | null;
}

export const useCombinedMenuItems = (options: UseCombinedMenuItemsOptions = {}) => {
  const {
    includeRistorante = true,
    includeCatering = true
  } = options;

  // Direct Supabase query for catering items with proper joins
  const [cateringItems, setCateringItems] = useState<CombinedMenuItem[]>([]);
  const [cateringLoading, setCateringLoading] = useState(true);
  const [cateringError, setCateringError] = useState(false);

  useEffect(() => {
    if (!includeCatering) {
      setCateringItems([]);
      setCateringLoading(false);
      return;
    }

    const fetchCateringItems = async () => {
      setCateringLoading(true);
      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id, name, description, price, serving_info, image_url, is_vegetarian, is_vegan, menu_categories!inner(name)")
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .limit(500);

        if (error) throw error;

        const items: CombinedMenuItem[] = (data || []).map((row: CateringRow) => ({
          id: `catering_${row.id}`,
          name: row.name,
          description: row.description,
          price: row.price,
          serving_info: row.serving_info,
          image_url: row.image_url,
          category_name: row.menu_categories?.name || 'Catering',
          source: 'catering' as const,
          is_vegetarian: row.is_vegetarian ?? undefined,
          is_vegan: row.is_vegan ?? undefined,
        }));

        setCateringItems(items);
      } catch (err) {
        console.error("Error fetching catering menu items:", err);
        setCateringError(true);
      } finally {
        setCateringLoading(false);
      }
    };

    fetchCateringItems();
  }, [includeCatering]);

  // Fetch restaurant menu items (food & drinks)
  const ristoranteQuery = useRistoranteMenus({
    menuTypes: ['food', 'drinks', 'lunch'],
    enabled: includeRistorante
  });

  const isLoading = cateringLoading || ristoranteQuery.isLoading;
  const isError = cateringError || ristoranteQuery.isError;

  // Combine both sources into unified format
  const combinedItems = useMemo((): CombinedMenuItem[] => {
    const items: CombinedMenuItem[] = [...cateringItems];

    // Add ristorante items (price_display als Fallback wenn price null)
    if (includeRistorante && ristoranteQuery.data?.items) {
      for (const item of ristoranteQuery.data.items) {
        items.push({
          id: `ristorante_${item.id}`,
          name: item.name,
          description: item.description,
          price: item.price ?? parsePriceDisplay(item.price_display),
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
  }, [cateringItems, includeRistorante, ristoranteQuery.data?.items]);

  // Group by source for display
  const groupedItems = useMemo(() => {
    const catering = combinedItems.filter(i => i.source === 'catering');
    const ristoranteItems = combinedItems.filter(i => i.source === 'ristorante');

    // Further group ristorante by menu type
    const ristoranteFood = ristoranteItems.filter(i => i.menu_type === 'food' || i.menu_type === 'lunch');
    const ristoranteDrinks = ristoranteItems.filter(i => i.menu_type === 'drinks');

    return {
      catering,
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
