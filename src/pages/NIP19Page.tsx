import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { useStructuredNote, usePublishNote } from '@/hooks/useStructuredNotes';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { NoteForm } from '@/components/notes/NoteForm';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, Pencil } from 'lucide-react';
import { CommentsSection } from '@/components/comments/CommentsSection';
import type { NostrEvent } from '@nostrify/nostrify';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';
import NotFound from './NotFound';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  const { type } = decoded;

  // Structured Note (kind 30023 NIP-23) - render full note view
  if (type === 'naddr' && decoded.data.kind === 30023) {
    return <StructuredNoteView id={decoded.data.identifier} />;
  }

  // Regular nevent
  if (type === 'nevent') {
    return <div>Event placeholder</div>;
  }

  switch (type) {
    case 'npub':
    case 'nprofile':
      return <div>Profile placeholder</div>;
    case 'note':
      return <div>Note placeholder</div>;
    case 'naddr':
      return <div>Addressable event placeholder</div>;
    default:
      return <NotFound />;
  }
}

/** Full view for a structured text note (kind 30023 NIP-23) with edit support */
function StructuredNoteView({ id }: { id: string }) {
  const { data: note, isLoading, error } = useStructuredNote(id);
  const author = useAuthor(APP_AUTHOR_PUBKEY);
  const { user } = useCurrentUser();
  const { mutateAsync: publishNote, isPending: isPublishing } = usePublishNote();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const isOwner = user?.pubkey === APP_AUTHOR_PUBKEY;

  useSeoMeta({
    title: note ? `${note.title} — cwtext` : 'Loading... — cwtext',
    description: note?.content.slice(0, 160) ?? 'Structured text note',
  });

  const handleEdit = async (data: { title: string; content: string; tags: string[]; order?: string }) => {
    if (!note) return;
    try {
      await publishNote({ ...data, dtag: note.id });
      setEditing(false);
      toast({ title: 'Note updated', description: 'Tags and content saved to Nostr.' });
    } catch (err) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'An error occurred.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
          <div className="space-y-3 mt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 max-w-3xl mx-auto text-center">
          <p className="text-destructive text-lg">Note not found</p>
          <Button asChild variant="link" className="mt-4">
            <Link to="/">Back to all notes</Link>
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = new Date(note.createdAt * 1000).toLocaleDateString(
    undefined,
    { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  );

  const authorName = author.data?.metadata?.name ?? 'Anonymous';

  // Editing mode — show the form
  if (editing) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container max-w-3xl mx-auto flex items-center h-16">
            <Button asChild variant="ghost" size="sm">
              <Link to="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to notes
              </Link>
            </Button>
          </div>
        </header>
        <div className="container max-w-3xl mx-auto py-8 px-4">
          <NoteForm
            initialTitle={note.title}
            initialContent={note.content}
            initialTags={note.tags}
            initialOrder={note.order !== Infinity ? String(note.order) : ''}
            onSubmit={handleEdit}
            onCancel={() => setEditing(false)}
            isSubmitting={isPublishing}
          />
        </div>
      </div>
    );
  }

  // Viewing mode
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-3xl mx-auto flex items-center justify-between h-16">
          <Button asChild variant="ghost" size="sm">
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to notes
            </Link>
          </Button>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </header>

      <article className="container max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold leading-tight mb-4">
          <span className="text-muted-foreground font-normal">Para. </span>
          {note.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-6">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span>{authorName}</span>
          </div>
          <span className="text-muted-foreground/40">·</span>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <time>{formattedDate}</time>
          </div>
        </div>

        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {note.tags.map((tag) => (
              <Badge key={tag} variant="secondary">#{tag}</Badge>
            ))}
          </div>
        )}

        <div className="mb-12">
          {note.content.split('\n').map((line, i) => (
            <p key={i} className="mb-3 leading-relaxed">{line || '\u00A0'}</p>
          ))}
        </div>

        <section className="border-t pt-8 mt-8">
          <h2 className="text-lg font-semibold mb-6">Comments</h2>
          <CommentsSection root={note.event as NostrEvent} />
        </section>
      </article>
    </div>
  );
}
