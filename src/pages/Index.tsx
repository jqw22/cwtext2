import { useState, useMemo, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { LoginArea } from '@/components/auth/LoginArea';
import { NoteForm } from '@/components/notes/NoteForm';
import { NoteCard } from '@/components/notes/NoteCard';
import { SearchFilters } from '@/components/notes/SearchFilters';
import { ExportODTButton } from '@/components/notes/ExportODTButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, PenLine, Search, Lock, UserPlus, Pencil } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useStructuredNotes, usePublishNote } from '@/hooks/useStructuredNotes';
import { useUserNotes, usePublishUserNote } from '@/hooks/useUserNotes';
import { useToast } from '@/hooks/useToast';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';

const Index = () => {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [showCuratedForm, setShowCuratedForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserNoteId, setEditingUserNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const hasSearched = search.trim().length > 0 || selectedTags.length > 0;
  const isAppAuthor = user?.pubkey === APP_AUTHOR_PUBKEY;

  // Curated notes — always load for tag browser + search
  const { data: notes, isLoading, error } = useStructuredNotes({
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    search: search.trim() || undefined,
  });

  const { mutateAsync: publishNote, isPending: isPublishing } = usePublishNote();

  // User's private encrypted notes (always loaded when logged in)
  const { data: userNotes, isLoading: userNotesLoading } = useUserNotes();
  const { mutateAsync: publishUserNote, isPending: isPublishingUser } = usePublishUserNote();

  useSeoMeta({
    title: 'cwtext — Structured Notes',
    description: 'Create, search, tag, and export structured text notes on Nostr.',
  });

  // Compute tag counts from loaded notes + persist to localStorage
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();

    // Start with cached counts from localStorage
    try {
      const cached = localStorage.getItem('cwtext:tagCounts');
      if (cached) {
        const parsed = JSON.parse(cached) as [string, number][];
        for (const [tag, count] of parsed) {
          counts.set(tag, count);
        }
      }
    } catch { /* ignore corrupt cache */ }

    // Overlay counts from currently loaded notes
    if (notes) {
      for (const note of notes) {
        for (const tag of note.tags) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
    }

    // Persist to localStorage
    try {
      localStorage.setItem('cwtext:tagCounts', JSON.stringify([...counts]));
    } catch { /* ignore storage full */ }

    return counts;
  }, [notes]);

  // Filter and sort curated notes
  const filteredNotes = useMemo(() => {
    if (!notes || !hasSearched) return [];

    let result = notes;

    if (selectedTags.length > 0) {
      result = result.filter((note) =>
        selectedTags.some((tag) => note.tags.includes(tag)),
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((t) => t.includes(q)),
      );
    }

    result = [...result].sort((a, b) => {
      if (a.order === Infinity && b.order === Infinity) return 0;
      if (a.order === Infinity) return 1;
      if (b.order === Infinity) return -1;
      return a.order - b.order;
    });

    return result;
  }, [notes, selectedTags, search, hasSearched]);

  // Filter and sort user notes (same tag/search logic as curated)
  const filteredUserNotes = useMemo(() => {
    if (!userNotes) return [];

    let result = userNotes;

    if (selectedTags.length > 0) {
      result = result.filter((note) =>
        selectedTags.some((tag) => note.tags.includes(tag)),
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.tags.some((t) => t.includes(q)),
      );
    }

    return result;
  }, [userNotes, selectedTags, search]);

  const handleAddTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);

  const handleRemoveTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleCreateNote = useCallback(
    async (data: { title: string; content: string; tags: string[]; order?: string }) => {
      if (!user) return;
      try {
        await publishNote(data);
        setShowCuratedForm(false);
        toast({ title: 'Note published!', description: `"${data.title}" has been published to Nostr.` });
      } catch (err) {
        toast({ title: 'Failed to publish', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
      }
    },
    [user, publishNote, toast],
  );

  const handleCreateUserNote = useCallback(
    async (data: { title: string; content: string; tags: string[]; order?: string }) => {
      if (!user) return;
      try {
        await publishUserNote({ ...data, dtag: editingUserNoteId ?? undefined });
        setShowUserForm(false);
        setEditingUserNoteId(null);
        toast({ title: editingUserNoteId ? 'Note updated' : 'Note saved', description: editingUserNoteId ? 'Your private note has been updated.' : 'Your private note has been encrypted and saved.' });
      } catch (err) {
        toast({ title: 'Failed to save', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
      }
    },
    [user, publishUserNote, toast, editingUserNoteId],
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

      <main className="container py-6">
        {/* Search & Tags — full width */}
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          selectedTags={selectedTags}
          onRemoveTag={handleRemoveTag}
          availableTags={tagCounts ?? new Map()}
          onAddTag={handleAddTag}
        />

        {/* Split layout: 2/3 curated notes + 1/3 user notes */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — Curated Notes (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Action bar */}
            <div className="flex items-center justify-between pt-2">
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
              {isAppAuthor && (
                <Button
                  onClick={() => setShowCuratedForm(!showCuratedForm)}
                  variant={showCuratedForm ? 'secondary' : 'default'}
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {showCuratedForm ? 'Close Form' : 'New Note'}
                </Button>
              )}
            </div>

            {/* Curated note form */}
            {showCuratedForm && isAppAuthor && (
              <NoteForm
                onSubmit={handleCreateNote}
                onCancel={() => setShowCuratedForm(false)}
                isSubmitting={isPublishing}
                availableTags={tagCounts ?? new Map()}
              />
            )}

            {/* Welcome state */}
            {!hasSearched && !showCuratedForm && (
              <div className="text-center py-24 border-2 border-dashed rounded-xl">
                <Search className="h-16 w-16 mx-auto mb-6 text-muted-foreground/20" />
                <h2 className="text-2xl font-semibold mb-3">Find your notes</h2>
                <p className="text-muted-foreground max-w-md mx-auto text-lg">
                  Search by keyword or click a tag below to browse notes on Nostr.
                </p>
              </div>
            )}

            {/* Loading */}
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

            {/* Error */}
            {hasSearched && error && (
              <div className="text-center py-12">
                <p className="text-destructive text-lg font-medium mb-2">Failed to load notes</p>
                <p className="text-muted-foreground text-sm">Check your relay connections and try again.</p>
              </div>
            )}

            {/* Empty */}
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

            {hasSearched && !isLoading && !error && filteredNotes.length > 0 && (
              <p className="text-center text-xs text-muted-foreground pb-8">
                Powered by Nostr · Vibed with{' '}
                <a href="https://shakespeare.diy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                  Shakespeare
                </a>
              </p>
            )}
          </div>

          {/* Right — User Notes (1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Your Notes</h2>
                <span className="text-xs text-muted-foreground">(encrypted)</span>
              </div>

              {!user ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Log in to create private encrypted notes
                  </p>
                  <LoginArea className="w-auto" />
                </div>
              ) : (
                <>
                  <Button
                    onClick={() => setShowUserForm(!showUserForm)}
                    variant={showUserForm ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {showUserForm ? 'Close Form' : 'New Private Note'}
                  </Button>

                  {showUserForm && (
                    <NoteForm
                      onSubmit={handleCreateUserNote}
                      onCancel={() => { setShowUserForm(false); setEditingUserNoteId(null); }}
                      isSubmitting={isPublishingUser}
                      availableTags={tagCounts ?? new Map()}
                    />
                  )}

                  {/* Edit form for existing note */}
                  {editingUserNoteId && !showUserForm && (() => {
                    const note = userNotes?.find((n) => n.id === editingUserNoteId);
                    if (!note) return null;
                    return (
                      <NoteForm
                        initialTitle={note.title}
                        initialContent={note.content}
                        initialTags={note.tags}
                        initialOrder={note.order !== Infinity ? String(note.order) : ''}
                        onSubmit={handleCreateUserNote}
                        onCancel={() => setEditingUserNoteId(null)}
                        isSubmitting={isPublishingUser}
                        availableTags={tagCounts ?? new Map()}
                      />
                    );
                  })()}

                  {/* User's notes list */}
                  {userNotesLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-2 py-3 border-b border-border/40">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-5/6" />
                        </div>
                      ))}
                    </div>
                  ) : userNotes && userNotes.length > 0 ? (
                    <div className="space-y-1">
                      {filteredUserNotes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => { setEditingUserNoteId(note.id); setShowUserForm(false); }}
                          className="w-full text-left py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/20 rounded px-2 -mx-2 transition-colors group"
                        >
                          <div className="flex items-start gap-2">
                            <h3 className="text-sm font-semibold text-foreground mb-1 flex-1">
                              {note.title}
                            </h3>
                            <Pencil className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5" />
                          </div>
                          <p className="text-xs text-foreground/70 whitespace-pre-line line-clamp-3">
                            {note.content}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No private notes yet. Create your first one above.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
