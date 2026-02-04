import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, isPast, isToday, subHours } from "date-fns";
import { de } from "date-fns/locale";

export type NotificationType =
  | "new_inquiry"
  | "inquiry_assigned"
  | "comment_added"
  | "task_due"
  | "task_overdue";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  createdAt: Date;
  read: boolean;
  metadata?: {
    inquiryId?: string;
    taskId?: string;
    commentId?: string;
    assignedBy?: string;
  };
}

// Local storage key for read notifications
const READ_NOTIFICATIONS_KEY = "storia_read_notifications";
const LAST_SEEN_KEY = "storia_notifications_last_seen";

function getReadNotifications(): Set<string> {
  try {
    const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadNotifications(ids: Set<string>) {
  localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...ids]));
}

function getLastSeenTime(): Date {
  try {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    return stored ? new Date(stored) : subHours(new Date(), 24);
  } catch {
    return subHours(new Date(), 24);
  }
}

function saveLastSeenTime(date: Date) {
  localStorage.setItem(LAST_SEEN_KEY, date.toISOString());
}

interface UseNotificationsOptions {
  userEmail?: string;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { userEmail } = options;
  const queryClient = useQueryClient();
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadNotifications());
  const [lastSeen, setLastSeen] = useState<Date>(() => getLastSeenTime());

  // Fetch notifications data
  const { data: notificationsData = [], isLoading } = useQuery({
    queryKey: ["notifications", userEmail],
    queryFn: async () => {
      if (!userEmail) return [];

      const notifications: Notification[] = [];
      const since = subHours(new Date(), 48).toISOString(); // Last 48 hours

      // 1. New inquiries (last 24 hours)
      const { data: newInquiries } = await supabase
        .from("event_inquiries")
        .select("id, contact_name, company_name, created_at")
        .eq("status", "new")
        .gte("created_at", subHours(new Date(), 24).toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      newInquiries?.forEach((inquiry) => {
        notifications.push({
          id: `new_inquiry_${inquiry.id}`,
          type: "new_inquiry",
          title: "Neue Anfrage",
          message: inquiry.company_name || inquiry.contact_name || "Neue Event-Anfrage",
          link: `/admin/events/${inquiry.id}/edit`,
          createdAt: new Date(inquiry.created_at!),
          read: readIds.has(`new_inquiry_${inquiry.id}`),
          metadata: { inquiryId: inquiry.id },
        });
      });

      // 2. Inquiries assigned to me (recent)
      const { data: assignedInquiries } = await supabase
        .from("event_inquiries")
        .select("id, contact_name, company_name, assigned_at, assigned_by")
        .eq("assigned_to", userEmail)
        .gte("assigned_at", since)
        .neq("assigned_by", userEmail) // Not self-assigned
        .order("assigned_at", { ascending: false })
        .limit(10);

      assignedInquiries?.forEach((inquiry) => {
        if (inquiry.assigned_at) {
          notifications.push({
            id: `assigned_${inquiry.id}_${inquiry.assigned_at}`,
            type: "inquiry_assigned",
            title: "Anfrage zugewiesen",
            message: `${inquiry.company_name || inquiry.contact_name} wurde dir zugewiesen`,
            link: `/admin/events/${inquiry.id}/edit`,
            createdAt: new Date(inquiry.assigned_at),
            read: readIds.has(`assigned_${inquiry.id}_${inquiry.assigned_at}`),
            metadata: { inquiryId: inquiry.id, assignedBy: inquiry.assigned_by || undefined },
          });
        }
      });

      // 3. Comments on my inquiries
      const { data: comments } = await supabase
        .from("inquiry_comments")
        .select(`
          id,
          content,
          author_email,
          created_at,
          inquiry:event_inquiries!inner(id, contact_name, company_name, assigned_to)
        `)
        .gte("created_at", since)
        .neq("author_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(20);

      comments?.forEach((comment) => {
        // Only show if I'm assigned to the inquiry
        if (comment.inquiry?.assigned_to === userEmail) {
          notifications.push({
            id: `comment_${comment.id}`,
            type: "comment_added",
            title: "Neuer Kommentar",
            message: `Kommentar zu ${comment.inquiry.company_name || comment.inquiry.contact_name}: "${comment.content.slice(0, 50)}${comment.content.length > 50 ? '...' : ''}"`,
            link: `/admin/events/${comment.inquiry.id}/edit`,
            createdAt: new Date(comment.created_at),
            read: readIds.has(`comment_${comment.id}`),
            metadata: { inquiryId: comment.inquiry.id, commentId: comment.id },
          });
        }
      });

      // 4. Tasks due today or overdue
      const { data: dueTasks } = await supabase
        .from("inquiry_tasks")
        .select(`
          id,
          title,
          due_date,
          inquiry:event_inquiries(id, contact_name, company_name)
        `)
        .eq("assigned_to", userEmail)
        .eq("status", "pending")
        .not("due_date", "is", null)
        .lte("due_date", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()) // Due within 24h or overdue
        .order("due_date", { ascending: true })
        .limit(10);

      dueTasks?.forEach((task) => {
        if (task.due_date) {
          const isOverdue = isPast(new Date(task.due_date));
          const isDueToday = isToday(new Date(task.due_date));

          if (isOverdue || isDueToday) {
            notifications.push({
              id: `task_${task.id}_${isOverdue ? 'overdue' : 'due'}`,
              type: isOverdue ? "task_overdue" : "task_due",
              title: isOverdue ? "Aufgabe überfällig" : "Aufgabe fällig",
              message: task.title + (task.inquiry ? ` (${task.inquiry.company_name || task.inquiry.contact_name})` : ""),
              link: task.inquiry ? `/admin/events/${task.inquiry.id}/edit` : undefined,
              createdAt: new Date(task.due_date),
              read: readIds.has(`task_${task.id}_${isOverdue ? 'overdue' : 'due'}`),
              metadata: { taskId: task.id, inquiryId: task.inquiry?.id },
            });
          }
        }
      });

      // Sort by date, newest first
      return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: !!userEmail,
  });

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notificationsData.filter((n) => !n.read && n.createdAt > lastSeen).length;
  }, [notificationsData, lastSeen]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setReadIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(notificationId);
      saveReadNotifications(newSet);
      return newSet;
    });
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const newSet = new Set(prev);
      notificationsData.forEach((n) => newSet.add(n.id));
      saveReadNotifications(newSet);
      return newSet;
    });
    setLastSeen(new Date());
    saveLastSeenTime(new Date());
  }, [notificationsData]);

  // Update notifications with read state
  const notifications = useMemo(() => {
    return notificationsData.map((n) => ({
      ...n,
      read: readIds.has(n.id),
    }));
  }, [notificationsData, readIds]);

  // Refresh notifications
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
