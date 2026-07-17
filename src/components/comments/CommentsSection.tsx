import { useComments } from '@/hooks/useComments';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NostrEvent } from '@nostrify/nostrify';
import { CommentForm } from './CommentForm';
import { Comment } from './Comment';

interface CommentsSectionProps {
  root: NostrEvent | URL | `#${string}`;
  emptyStateMessage?: string;
  emptyStateSubtitle?: string;
  className?: string;
  limit?: number;
}

export function CommentsSection({
  root,
  emptyStateMessage = "No comments yet",
  emptyStateSubtitle = "Be the first to share your thoughts!",
  className,
  limit = 500,
}: CommentsSectionProps) {
  const { data: commentsData, isLoading, error } = useComments(root, limit);
  const { user } = useCurrentUser();

  // Only show the current user's own comments
  const myComments = (commentsData?.topLevelComments || [])
    .filter((c) => c.pubkey === user?.pubkey)
    .sort((a, b) => a.created_at - b.created_at); // oldest first for linear sequence

  if (error) {
    return (
      <div className={cn("text-center text-muted-foreground py-6", className)}>
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Failed to load comments</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <CommentForm root={root} />

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : myComments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">Your notes</p>
          <p className="text-sm">This client only shows your comments here. Comments are published to Nostr relays and may be visible elsewhere.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myComments.map((comment) => (
            <Comment
              key={comment.id}
              root={root}
              comment={comment}
              showOnlyOwn
            />
          ))}
        </div>
      )}
    </div>
  );
}
