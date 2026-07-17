import { useState, useMemo, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { LoginArea } from '@/components/auth/LoginArea';
import { NoteForm } from '@/components/notes/NoteForm';
import { NoteCard } from '@/components/notes/NoteCard';
import { SearchFilters } from '@/components/notes/SearchFilters';
import { ExportODTButton } from '@/components/notes/ExportODTButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, PenLine, Search } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useStructuredNotes, usePublishNote } from '@/hooks/useStructuredNotes';
import { useToast } from '@/hooks/useToast';

const Index = () => {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // A search is "initiated" when the user has typed something or selected a tag
  const hasSearched = search.trim().length > 0 || selectedTags.length > 0;

  // Only fetch notes after a search has been initiated
  const { data: notes, isLoading, error } = useStructuredNotes({
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    search: search.trim() || undefined,
    enabled: hasSearched,
  });

  const { mutateAsync: publishNote, isPending: isPublishing } = usePublishNote();

  useSeoMeta({
    title: 'cwtext — Structured Notes',
    description:
      'Create, search, tag, comment, and export structured text notes on Nostr.',
  });

  // Extract tags from loaded notes for the tag browser
  const tagCounts = useMemo(() => {
    if (!notes) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return counts;
  }, [notes]);

  // Filter and sort notes for display
  const filteredNotes = useMemo(() => {
    if (!notes || !hasSearched) return [];

    let result = notes;

    // Tag filtering already done at relay level, but double-check
    if (selectedTags.length > 0) {
      result = result.filter((note) =>
        selectedTags.some((tag) => note.tags.includes(tag)),
      );
    }

    // Search filter (title, content, tags) — client-side
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((t) => t.includes(q)),
      );
    }

    // Sort by order ascending (notes without order go to end)
    result = [...result].sort((a, b) => {
      if (a.order === Infinity && b.order === Infinity) return 0;
      if (a.order === Infinity) return 1;
      if (b.order === Infinity) return -1;
      return a.order - b.order;
    });

    return result;
  }, [notes, selectedTags, search, hasSearched]);

  const handleAddTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev : [...prev, tag],
    );
  }, []);

  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleCreateNote = useCallback(
    async (data: { title: string; content: string; tags: string[]; order?: string }) => {
      if (!user) {
        toast({
          title: 'Login required',
          description: 'You need to be logged in to publish notes.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await publishNote(data);
        setShowForm(false);
        toast({
          title: 'Note published!',
          description: `"${data.title}" has been published to Nostr.`,
        });
      } catch (err) {
        toast({
          title: 'Failed to publish',
          description: err instanceof Error ? err.message : 'An error occurred.',
          variant: 'destructive',
        });
      }
    },
    [user, publishNote, toast],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <PenLine className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">cwtext</h1>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              — Structured Text Notes on Nostr
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ExportODTButton notes={filteredNotes} title="cwtext_export" filterTags={selectedTags} />
            <LoginArea className="w-auto" />
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Search & Tags */}
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          selectedTags={selectedTags}
          onRemoveTag={handleRemoveTag}
          availableTags={tagCounts}
          onAddTag={handleAddTag}
        />

        {/* Action bar */}
        <div className="flex items-center justify-between">
          {hasSearched ? (
            <p className="text-sm text-muted-foreground">
              {filteredNotes.length > 0
                ? `Showing ${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}`
                : 'No notes found'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Use the search bar above or click a tag to find notes
            </p>
          )}
          {user && (
            <Button
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? 'secondary' : 'default'}
            >
              <Plus className="mr-2 h-4 w-4" />
              {showForm ? 'Close Form' : 'New Note'}
            </Button>
          )}
        </div>

        {/* Note form (when expanded) */}
        {showForm && user && (
          <NoteForm
            onSubmit={handleCreateNote}
            onCancel={() => setShowForm(false)}
            isSubmitting={isPublishing}
            availableTags={tagCounts}
          />
        )}

        {/* Welcome state — no search yet */}
        {!hasSearched && !showForm && (
          <div className="text-center py-24 border-2 border-dashed rounded-xl">
            <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
            <h2 className="text-2xl font-semibold mb-3">Find your notes</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-lg">
              Search by keyword or click a tag below to browse notes on Nostr.
            </p>
            <p className="text-muted-foreground/60 text-sm mt-8 max-w-sm mx-auto">
              New here? Click "New Note" to create your first entry. It gets published to Nostr and becomes searchable by everyone.
            </p>
          </div>
        )}

        {/* Loading state */}
        {hasSearched && isLoading && (
          <div className="space-y-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2 py-4 border-b border-border/40">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {hasSearched && error && (
          <div className="text-center py-12">
            <p className="text-destructive text-lg font-medium mb-2">
              Failed to load notes
            </p>
            <p className="text-muted-foreground text-sm">
              Check your relay connections and try again.
            </p>
          </div>
        )}

        {/* Empty results state */}
        {hasSearched && !isLoading && !error && filteredNotes.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <PenLine className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold mb-2">No results</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        )}

        {/* Notes list */}
        {hasSearched && !isLoading && filteredNotes.length > 0 && (
          <div className="max-w-none">
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}

        {/* Footer note */}
        {hasSearched && !isLoading && !error && filteredNotes.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pb-8">
            Powered by Nostr · Vibed with{' '}
            <a
              href="https://shakespeare.diy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Shakespeare
            </a>
          </p>
        )}
      </main>
    </div>
  );
};

export default Index;
