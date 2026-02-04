import { useState } from "react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { de } from "date-fns/locale";
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTasks } from "@/hooks/useTasks";
import { QUICK_TASK_PRESETS, TaskWithInquiry, TaskPriority } from "@/types/tasks";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";

interface TaskManagerProps {
  inquiryId: string;
  currentUserEmail?: string;
  className?: string;
}

export function TaskManager({ inquiryId, currentUserEmail, className }: TaskManagerProps) {
  const {
    tasks,
    isLoading,
    createTask,
    completeTask,
    deleteTask,
    createQuickTask,
    isCreating,
  } = useTasks({ inquiryId, includeCompleted: true });

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    createTask({
      inquiry_id: inquiryId,
      title: newTaskTitle.trim(),
      assigned_to: currentUserEmail,
    });
    setNewTaskTitle("");
    setIsAdding(false);
  };

  const handleQuickTask = (preset: typeof QUICK_TASK_PRESETS[0]) => {
    createQuickTask(
      { title: preset.title, dueInDays: preset.dueInDays, priority: preset.priority },
      inquiryId
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Quick Tasks */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TASK_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => handleQuickTask(preset)}
            disabled={isCreating}
            className="h-7 text-xs rounded-lg"
          >
            <Plus className="h-3 w-3 mr-1" />
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Add Custom Task */}
      {isAdding ? (
        <form onSubmit={handleAddTask} className="flex gap-2">
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Aufgabe eingeben..."
            autoFocus
            className="flex-1 h-8 text-sm"
          />
          <Button type="submit" size="sm" disabled={!newTaskTitle.trim() || isCreating}>
            {isCreating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Hinzufügen"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAdding(false);
              setNewTaskTitle("");
            }}
          >
            Abbrechen
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="w-full justify-start text-muted-foreground h-8"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Eigene Aufgabe hinzufügen
        </Button>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="space-y-1">
          {pendingTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onComplete={() => completeTask(task.id)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </div>
      )}

      {/* Completed Tasks (collapsed) */}
      {completedTasks.length > 0 && (
        <details className="text-muted-foreground">
          <summary className="text-xs cursor-pointer hover:text-foreground transition-colors">
            {completedTasks.length} erledigte Aufgabe{completedTasks.length !== 1 ? "n" : ""}
          </summary>
          <div className="mt-1 space-y-1 opacity-60">
            {completedTasks.slice(0, 5).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={() => {}}
                onDelete={() => deleteTask(task.id)}
                completed
              />
            ))}
          </div>
        </details>
      )}

      {/* Empty State */}
      {pendingTasks.length === 0 && completedTasks.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Noch keine Aufgaben
        </p>
      )}
    </div>
  );
}

// Task Item Component
interface TaskItemProps {
  task: TaskWithInquiry;
  onComplete: () => void;
  onDelete: () => void;
  completed?: boolean;
}

function TaskItem({ task, onComplete, onDelete, completed }: TaskItemProps) {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !completed;
  const isDueToday = task.due_date && isToday(new Date(task.due_date));
  const isDueTomorrow = task.due_date && isTomorrow(new Date(task.due_date));

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Heute";
    if (isTomorrow(d)) return "Morgen";
    if (isPast(d)) return formatDistanceToNow(d, { addSuffix: true, locale: de });
    return format(d, "EEE, d. MMM", { locale: de });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg group transition-colors",
        completed ? "opacity-60" : "hover:bg-muted/50",
        isOverdue && "bg-destructive/5"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onComplete}
        disabled={completed}
        className={cn(
          "shrink-0 transition-colors",
          completed
            ? "text-primary"
            : "text-muted-foreground hover:text-primary"
        )}
      >
        {completed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            completed && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span
              className={cn(
                "flex items-center gap-1",
                isOverdue && "text-destructive",
                isDueToday && "text-amber-600",
                isDueTomorrow && "text-blue-600"
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
          {task.priority !== "normal" && (
            <PriorityBadge priority={task.priority} />
          )}
        </div>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Priority Badge
function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "urgent") {
    return (
      <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
        Dringend
      </Badge>
    );
  }
  if (priority === "high") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-700 bg-amber-50"
      >
        Hoch
      </Badge>
    );
  }
  return null;
}
