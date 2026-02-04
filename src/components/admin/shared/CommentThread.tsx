import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { MessageSquare, Reply, Trash2, Pencil, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getAdminDisplayName, getAdminInitials } from "@/lib/adminDisplayNames";
import {
  useInquiryComments,
  ThreadedComment,
} from "@/hooks/useInquiryComments";

interface CommentThreadProps {
  inquiryId: string;
  currentUserEmail?: string;
  className?: string;
}

export function CommentThread({
  inquiryId,
  currentUserEmail,
  className,
}: CommentThreadProps) {
  const {
    threadedComments,
    isLoading,
    addComment,
    updateComment,
    deleteComment,
    isAdding,
  } = useInquiryComments({ inquiryId });

  const [newComment, setNewComment] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    addComment({ content: newComment.trim() });
    setNewComment("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* New Comment Input */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Kommentar hinzufügen..."
          className="min-h-[80px] text-sm resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!newComment.trim() || isAdding}
            className="gap-1.5"
          >
            {isAdding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Senden
          </Button>
        </div>
      </form>

      {/* Comments List */}
      {threadedComments.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Noch keine Kommentare</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threadedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserEmail={currentUserEmail}
              onReply={(parentId, content) =>
                addComment({ content, parentId })
              }
              onUpdate={(commentId, content) =>
                updateComment({ commentId, content })
              }
              onDelete={deleteComment}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: ThreadedComment;
  currentUserEmail?: string;
  onReply: (parentId: string, content: string) => void;
  onUpdate: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  depth: number;
}

function CommentItem({
  comment,
  currentUserEmail,
  onReply,
  onUpdate,
  onDelete,
  depth,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [editContent, setEditContent] = useState(comment.content);

  const isOwner = currentUserEmail === comment.author_email;
  const name = getAdminDisplayName(comment.author_email);
  const initials = getAdminInitials(comment.author_email);

  const handleReply = () => {
    if (!replyContent.trim()) return;
    onReply(comment.id, replyContent.trim());
    setReplyContent("");
    setIsReplying(false);
  };

  const handleUpdate = () => {
    if (!editContent.trim()) return;
    onUpdate(comment.id, editContent.trim());
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "group",
        depth > 0 && "ml-6 pl-4 border-l-2 border-muted"
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: de,
              })}
            </span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-xs text-muted-foreground">(bearbeitet)</span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdate}>
                  Speichern
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {depth < 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => setIsReplying(!isReplying)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Antworten
                </Button>
              )}
              {isOwner && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(comment.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Löschen
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Reply Input */}
          {isReplying && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Antwort schreiben..."
                className="min-h-[60px] text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReply}>
                  <Send className="h-3 w-3 mr-1" />
                  Antworten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsReplying(false);
                    setReplyContent("");
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserEmail={currentUserEmail}
              onReply={onReply}
              onUpdate={onUpdate}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
