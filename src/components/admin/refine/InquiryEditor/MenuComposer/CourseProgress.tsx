import { Check, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseConfig, CourseSelection, COURSE_ICONS } from "./types";

interface CourseProgressProps {
  courseConfigs: CourseConfig[];
  courseSelections: CourseSelection[];
  activeCourseIndex: number;
  onCourseClick: (index: number) => void;
}

export const CourseProgress = ({
  courseConfigs,
  courseSelections,
  activeCourseIndex,
  onCourseClick,
}: CourseProgressProps) => {
  const getCourseStatus = (courseType: string): 'completed' | 'active' | 'pending' => {
    const selection = courseSelections.find(s => s.courseType === courseType);
    if (selection && (selection.itemId || selection.isCustom)) {
      return 'completed';
    }
    const configIndex = courseConfigs.findIndex(c => c.course_type === courseType);
    if (configIndex === activeCourseIndex) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="flex items-center justify-center gap-2 p-4 bg-muted/30 rounded-lg mb-6">
      {courseConfigs.map((config, index) => {
        const status = getCourseStatus(config.course_type);
        const icon = COURSE_ICONS[config.course_type] || '🍽️';
        
        return (
          <div key={config.id} className="flex items-center">
            <button
              onClick={() => onCourseClick(index)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                "hover:bg-background/80",
                status === 'completed' && "bg-green-100 text-green-800",
                status === 'active' && "bg-primary text-primary-foreground shadow-sm",
                status === 'pending' && "bg-muted text-muted-foreground"
              )}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-medium hidden md:inline">
                {config.course_label}
              </span>
              {status === 'completed' && (
                <Check className="h-4 w-4" />
              )}
              {status === 'active' && (
                <Circle className="h-4 w-4 fill-current" />
              )}
              {status === 'pending' && config.is_required && (
                <AlertCircle className="h-3.5 w-3.5 opacity-50" />
              )}
            </button>
            
            {/* Connector line */}
            {index < courseConfigs.length - 1 && (
              <div 
                className={cn(
                  "w-4 h-0.5 mx-1",
                  getCourseStatus(courseConfigs[index + 1].course_type) !== 'pending' ||
                  status === 'completed'
                    ? "bg-primary/50"
                    : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
