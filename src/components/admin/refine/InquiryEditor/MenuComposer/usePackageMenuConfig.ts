import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CourseConfig, DrinkConfig, DrinkOption } from './types';

interface UsePackageMenuConfigResult {
  courseConfigs: CourseConfig[];
  drinkConfigs: DrinkConfig[];
  isLoading: boolean;
  error: string | null;
}

export const usePackageMenuConfig = (packageId: string | null): UsePackageMenuConfigResult => {
  const [courseConfigs, setCourseConfigs] = useState<CourseConfig[]>([]);
  const [drinkConfigs, setDrinkConfigs] = useState<DrinkConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!packageId) {
      setCourseConfigs([]);
      setDrinkConfigs([]);
      return;
    }

    const fetchConfigs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [courseRes, drinkRes] = await Promise.all([
          supabase
            .from('package_course_config')
            .select('*')
            .eq('package_id', packageId)
            .order('sort_order'),
          supabase
            .from('package_drink_config')
            .select('*')
            .eq('package_id', packageId)
            .order('sort_order'),
        ]);

        if (courseRes.error) throw courseRes.error;
        if (drinkRes.error) throw drinkRes.error;

        // Transform course configs
        const transformedCourses: CourseConfig[] = (courseRes.data || []).map(row => ({
          id: row.id,
          package_id: row.package_id,
          course_type: row.course_type as CourseConfig['course_type'],
          course_label: row.course_label,
          course_label_en: row.course_label_en,
          course_label_it: (row as Record<string, unknown>).course_label_it as string | null ?? null,
          course_label_fr: (row as Record<string, unknown>).course_label_fr as string | null ?? null,
          is_required: row.is_required ?? true,
          allowed_sources: (row.allowed_sources || []) as CourseConfig['allowed_sources'],
          allowed_categories: (row.allowed_categories || []) as string[],
          is_custom_item: row.is_custom_item ?? false,
          custom_item_name: row.custom_item_name,
          custom_item_name_en: row.custom_item_name_en,
          custom_item_name_it: (row as Record<string, unknown>).custom_item_name_it as string | null ?? null,
          custom_item_name_fr: (row as Record<string, unknown>).custom_item_name_fr as string | null ?? null,
          custom_item_description: row.custom_item_description,
          custom_item_description_en: (row as Record<string, unknown>).custom_item_description_en as string | null ?? null,
          custom_item_description_it: (row as Record<string, unknown>).custom_item_description_it as string | null ?? null,
          custom_item_description_fr: (row as Record<string, unknown>).custom_item_description_fr as string | null ?? null,
          sort_order: row.sort_order ?? 0,
        }));

        // Transform drink configs
        const transformedDrinks: DrinkConfig[] = (drinkRes.data || []).map(row => {
          // Parse options - could be array of strings or array of objects
          let parsedOptions: DrinkOption[] | string[] = [];
          if (row.options) {
            if (Array.isArray(row.options)) {
              // Cast the JSON array to our expected types
              parsedOptions = row.options as unknown as DrinkOption[] | string[];
            } else if (typeof row.options === 'string') {
              try {
                parsedOptions = JSON.parse(row.options);
              } catch {
                parsedOptions = [];
              }
            }
          }

          return {
            id: row.id,
            package_id: row.package_id,
            drink_group: row.drink_group as DrinkConfig['drink_group'],
            drink_label: row.drink_label,
            drink_label_en: row.drink_label_en,
            drink_label_it: (row as Record<string, unknown>).drink_label_it as string | null ?? null,
            drink_label_fr: (row as Record<string, unknown>).drink_label_fr as string | null ?? null,
            options: parsedOptions,
            options_translations:
              ((row as Record<string, unknown>).options_translations as
                | Partial<Record<'en' | 'it' | 'fr', string[]>>
                | null) ?? null,
            quantity_per_person: row.quantity_per_person,
            quantity_label: row.quantity_label,
            quantity_label_en: row.quantity_label_en,
            quantity_label_it: (row as Record<string, unknown>).quantity_label_it as string | null ?? null,
            quantity_label_fr: (row as Record<string, unknown>).quantity_label_fr as string | null ?? null,
            is_choice: row.is_choice ?? false,
            is_included: row.is_included ?? true,
            sort_order: row.sort_order ?? 0,
          };
        });

        setCourseConfigs(transformedCourses);
        setDrinkConfigs(transformedDrinks);
      } catch (err) {
        console.error('Error fetching package menu config:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Konfiguration');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfigs();
  }, [packageId]);

  return useMemo(() => ({
    courseConfigs,
    drinkConfigs,
    isLoading,
    error,
  }), [courseConfigs, drinkConfigs, isLoading, error]);
};
