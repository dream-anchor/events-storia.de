import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PackageCourseConfig {
  id: string;
  package_id: string;
  course_type: string;
  course_label: string;
  is_required: boolean;
  sort_order: number;
}

/**
 * Loads course configurations for ALL packages at once.
 * Used to check menu completeness without lazy-loading per package.
 */
export const useAllPackageCourseConfigs = (packageIds: string[]) => {
  return useQuery({
    queryKey: ["all-package-course-configs", packageIds.sort().join(",")],
    queryFn: async () => {
      if (packageIds.length === 0) return {};

      const { data, error } = await supabase
        .from("package_course_config")
        .select("id, package_id, course_type, course_label, is_required, sort_order")
        .in("package_id", packageIds)
        .order("sort_order");

      if (error) throw error;

      // Group by package_id for easy lookup
      const byPackage: Record<string, PackageCourseConfig[]> = {};
      for (const row of data || []) {
        if (!byPackage[row.package_id]) {
          byPackage[row.package_id] = [];
        }
        byPackage[row.package_id].push({
          id: row.id,
          package_id: row.package_id,
          course_type: row.course_type,
          course_label: row.course_label,
          is_required: row.is_required ?? true,
          sort_order: row.sort_order ?? 0,
        });
      }

      return byPackage;
    },
    enabled: packageIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
