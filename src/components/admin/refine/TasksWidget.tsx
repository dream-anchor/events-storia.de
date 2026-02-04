import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { de } from "date-fns/locale";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Loader2,
  ListTodo,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUpcomingTasks, useOverdueTasks, useTasks } from "@/hooks/useTasks";
import { TaskWithInquiry, TaskPriority } from "@/types/tasks";
import { supabase } from "@/integrations/supabase/client";

interface TasksWidgetProps {
  className?: string;
}

export function TasksWidget({ className }: TasksWidgetProps) {
  const navigate = useNavigate();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email || undefined);
    });
  }, []);

  const { data: upcomingTasks = [], isLoading } = useUpcomingTasks({
    assignedTo: currentUserEmail,
    limit: 8,
  });

  const { data: overdueCount = 0 } = useOverdueTasks(currentUserEmail);
  const { completeTask } = useTasks();

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Heute";
    if (isTomorrow(d)) return "Morgen";
    if (isPast(d)) return formatDistanceToNow(d, { addSuffix: true, locale: de });
    return format(d, "EEE, d. MMM", { locale: de });
  };

  const handleTaskClick = (task: TaskWithInquiry) => {
    if (task.inquiry_id) {
      navigate(`/admin/events/${task.inquiry_id}/edit`);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Meine Aufgaben
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Meine Aufgaben
            {overdueCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {overdueCount} überfällig
              </Badge>
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {upcomingTasks.length} offen
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {upcomingTasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Keine offenen Aufgaben</p>
          </div>
        ) : (
          <div className="space-y-1">
            {upcomingTasks.map((task) => {
              const isOverdue = task.due_date && isPast(new Date(task.due_date));
              const isDueToday = task.due_date && isToday(new Date(task.due_date));

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg group transition-colors hover:bg-muted/50 cursor-pointer",
                    isOverdue && "bg-destructive/5"
                  )}
                  onClick={() => handleTaskClick(task)}
                >
                  {/* Complete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      completeTask(task.id);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Circle className="h-4 w-4" />
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {task.inquiry && (
                        <span className="flex items-center gap-1 truncate max-w-[140px]">
                          {task.inquiry.company_name ? (
                            <>
                              <Building2 className="h-3 w-3 shrink-0" />
                              {task.inquiry.company_name}
                            </>
                          ) : (
                            task.inquiry.contact_name
                          )}
                        </span>
                      )}
                      {task.due_date && (
                        <span
                          className={cn(
                            "flex items-center gap-1 shrink-0",
                            isOverdue && "text-destructive",
                            isDueToday && !isOverdue && "text-amber-600"
                          )}
                        >
                          {isOverdue ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {formatDueDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Priority & Arrow */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.priority === "urgent" && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                        !
                      </Badge>
                    )}
                    {task.priority === "high" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-700 bg-amber-50"
                      >
                        !
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
