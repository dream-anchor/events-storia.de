import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InquiryTask, TaskWithInquiry, TaskStatus, TaskPriority } from "@/types/tasks";
import { toast } from "sonner";

interface UseTasksOptions {
  inquiryId?: string;
  assignedTo?: string;
  status?: TaskStatus;
  includeCompleted?: boolean;
}

interface CreateTaskInput {
  inquiry_id?: string | null;
  title: string;
  description?: string;
  due_date?: string | null;
  assigned_to?: string | null;
  priority?: TaskPriority;
}

interface UpdateTaskInput {
  taskId: string;
  title?: string;
  description?: string;
  due_date?: string | null;
  assigned_to?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
}

export function useTasks(options: UseTasksOptions = {}) {
  const queryClient = useQueryClient();
  const { inquiryId, assignedTo, status, includeCompleted = false } = options;

  // Build query key
  const queryKey = ["tasks", { inquiryId, assignedTo, status, includeCompleted }];

  // Fetch tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("inquiry_tasks")
        .select(`
          *,
          inquiry:event_inquiries(id, contact_name, company_name, event_type)
        `)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (inquiryId) {
        query = query.eq("inquiry_id", inquiryId);
      }

      if (assignedTo) {
        query = query.eq("assigned_to", assignedTo);
      }

      if (status) {
        query = query.eq("status", status);
      } else if (!includeCompleted) {
        query = query.eq("status", "pending");
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as TaskWithInquiry[];
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("inquiry_tasks")
        .insert({
          ...input,
          created_by: user.email,
        })
        .select()
        .single();

      if (error) throw error;
      return data as InquiryTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Aufgabe erstellt");
    },
    onError: (error) => {
      console.error("Create task error:", error);
      toast.error("Fehler beim Erstellen der Aufgabe");
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, ...updates }: UpdateTaskInput) => {
      const { data, error } = await supabase
        .from("inquiry_tasks")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return data as InquiryTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => {
      console.error("Update task error:", error);
      toast.error("Fehler beim Aktualisieren der Aufgabe");
    },
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("inquiry_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user?.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return data as InquiryTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Aufgabe erledigt");
    },
    onError: (error) => {
      console.error("Complete task error:", error);
      toast.error("Fehler beim Abschließen der Aufgabe");
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("inquiry_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Aufgabe gelöscht");
    },
    onError: (error) => {
      console.error("Delete task error:", error);
      toast.error("Fehler beim Löschen der Aufgabe");
    },
  });

  // Helper function to create task with quick preset
  const createQuickTask = (
    preset: { title: string; dueInDays: number; priority: TaskPriority },
    inquiryId?: string
  ) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + preset.dueInDays);

    return createTaskMutation.mutate({
      inquiry_id: inquiryId,
      title: preset.title,
      due_date: dueDate.toISOString(),
      priority: preset.priority,
    });
  };

  return {
    tasks,
    isLoading,
    error,
    createTask: createTaskMutation.mutate,
    updateTask: updateTaskMutation.mutate,
    completeTask: completeTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    createQuickTask,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
  };
}

// Hook for fetching upcoming tasks across all inquiries
export function useUpcomingTasks(options: { assignedTo?: string; limit?: number } = {}) {
  const { assignedTo, limit = 10 } = options;

  return useQuery({
    queryKey: ["tasks", "upcoming", { assignedTo, limit }],
    queryFn: async () => {
      let query = supabase
        .from("inquiry_tasks")
        .select(`
          *,
          inquiry:event_inquiries(id, contact_name, company_name, event_type)
        `)
        .eq("status", "pending")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(limit);

      if (assignedTo) {
        query = query.eq("assigned_to", assignedTo);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as TaskWithInquiry[];
    },
  });
}

// Hook for getting overdue tasks count
export function useOverdueTasks(assignedTo?: string) {
  return useQuery({
    queryKey: ["tasks", "overdue", assignedTo],
    queryFn: async () => {
      let query = supabase
        .from("inquiry_tasks")
        .select("id", { count: "exact" })
        .eq("status", "pending")
        .lt("due_date", new Date().toISOString());

      if (assignedTo) {
        query = query.eq("assigned_to", assignedTo);
      }

      const { count, error } = await query;

      if (error) throw error;

      return count || 0;
    },
  });
}
