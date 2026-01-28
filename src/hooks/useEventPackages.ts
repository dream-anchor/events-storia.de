import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventPackage {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number;
  price_per_person: boolean | null;
  min_guests: number | null;
  max_guests: number | null;
  includes: string[] | null;
  package_type: string;
  is_active: boolean | null;
  sort_order: number | null;
}

export interface EventLocation {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  capacity_seated: number | null;
  capacity_standing: number | null;
  features: string[] | null;
  is_active: boolean | null;
  sort_order: number | null;
}

export const useEventPackages = () => {
  return useQuery({
    queryKey: ["event-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("is_active", true)
        .eq("package_type", "event")
        .order("sort_order");
      
      if (error) throw error;
      
      // Parse includes from JSON
      return (data || []).map(pkg => ({
        ...pkg,
        includes: Array.isArray(pkg.includes) ? pkg.includes : []
      })) as EventPackage[];
    },
  });
};

export const useEventLocations = () => {
  return useQuery({
    queryKey: ["event-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      
      if (error) throw error;
      
      // Parse features from JSON
      return (data || []).map(loc => ({
        ...loc,
        features: Array.isArray(loc.features) ? loc.features : []
      })) as EventLocation[];
    },
  });
};
