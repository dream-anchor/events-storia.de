import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InquiryComment {
  id: string;
  inquiry_id: string;
  author_email: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface UseInquiryCommentsOptions {
  inquiryId: string;
}

export function useInquiryComments({ inquiryId }: UseInquiryCommentsOptions) {
  const queryClient = useQueryClient();
  const queryKey = ["inquiry-comments", inquiryId];

  // Fetch comments for an inquiry
  const {
    data: comments = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiry_comments")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as InquiryComment[];
    },
    enabled: !!inquiryId,
  });

  // Add a new comment
  const addComment = useMutation({
    mutationFn: async ({
      content,
      parentId,
    }: {
      content: string;
      parentId?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new Error("Nicht angemeldet");
      }

      const { data, error } = await supabase
        .from("inquiry_comments")
        .insert({
          inquiry_id: inquiryId,
          author_email: user.email,
          content,
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Kommentar hinzugefügt");
    },
    onError: (error) => {
      console.error("Error adding comment:", error);
      toast.error("Fehler beim Hinzufügen des Kommentars");
    },
  });

  // Update a comment
  const updateComment = useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      const { data, error } = await supabase
        .from("inquiry_comments")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Kommentar aktualisiert");
    },
    onError: (error) => {
      console.error("Error updating comment:", error);
      toast.error("Fehler beim Aktualisieren des Kommentars");
    },
  });

  // Delete a comment
  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("inquiry_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Kommentar gelöscht");
    },
    onError: (error) => {
      console.error("Error deleting comment:", error);
      toast.error("Fehler beim Löschen des Kommentars");
    },
  });

  // Build threaded structure
  const threadedComments = buildCommentTree(comments);

  return {
    comments,
    threadedComments,
    isLoading,
    error,
    addComment: addComment.mutate,
    updateComment: updateComment.mutate,
    deleteComment: deleteComment.mutate,
    isAdding: addComment.isPending,
    isUpdating: updateComment.isPending,
    isDeleting: deleteComment.isPending,
  };
}

// Helper to build comment tree structure
export interface ThreadedComment extends InquiryComment {
  replies: ThreadedComment[];
}

function buildCommentTree(comments: InquiryComment[]): ThreadedComment[] {
  const commentMap = new Map<string, ThreadedComment>();
  const roots: ThreadedComment[] = [];

  // First pass: create map with empty replies array
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree
  comments.forEach((comment) => {
    const node = commentMap.get(comment.id)!;
    if (comment.parent_id && commentMap.has(comment.parent_id)) {
      commentMap.get(comment.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}
