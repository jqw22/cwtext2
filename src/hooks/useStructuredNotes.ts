import { type NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { APP_AUTHOR_PUBKEY } from '@/lib/appAuthor';

const NOTE_KIND = 30023;
const PAGE_SIZE = 50;

/** Data extracted from a kind 30023 (NIP-23) long-form content note */
export interface StructuredNote {
  /** The Nostr event */
  event: NostrEvent;
  /** Para. label from the `title` tag */
  title: string;
  /** Main text body from `content` */
  content: string;
  /** Category tags from `t` tags */
  tags: string[];
  /** Original publish timestamp */
  publishedAt?: number;
  /** The `d` tag identifier */
  id: string;
  /** Author pubkey */
  pubkey: string;
  /** Event created_at */
  createdAt: number;
  /** Numeric order for sequencing (from `order` tag) */
  order: number;
}

/** Parse a NostrEvent into a StructuredNote */
function parseNote(event: NostrEvent): StructuredNote {
  const getTag = (name: string): string | undefined =>
    event.tags.find(([n]) => n === name)?.[1];

  const getAllTags = (name: string): string[] =>
    event.tags.filter(([n]) => n === name).map(([, v]) => v);

  const publishedAtTag = getTag('published_at');

  return {
    event,
    title: getTag('title') ?? 'Untitled',
    content: event.content ?? '',
    tags: getAllTags('t'),
    publishedAt: publishedAtTag ? Number(publishedAtTag) : undefined,
    id: getTag('d') ?? event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    order: getTag('order') ? Number(getTag('order')) : Infinity,
  };
}

interface UseNotesOptions {
  /** Filter by category tags */
  tags?: string[];
  /** Search text in title/content */
  search?: string;
  /** Page size for pagination */
  limit?: number;
  /** Only fetch when true (defaults to true) */
  enabled?: boolean;
}

/**
 * Fetch structured text notes with paginated infinite scroll.
 * Always scoped to the app author. Use `enabled` to gate the query.
 */
export function useStructuredNotes(options: UseNotesOptions = {}) {
  const { nostr } = useNostr();
  const { tags, search, limit = PAGE_SIZE, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: ['nostr', 'notes', APP_AUTHOR_PUBKEY, tags, search, limit],
    queryFn: async ({ pageParam }) => {
      const filter: Record<string, unknown> = {
        kinds: [NOTE_KIND],
        authors: [APP_AUTHOR_PUBKEY],
        limit,
      };

      if (pageParam !== undefined) {
        filter.until = pageParam;
      }

      if (tags && tags.length > 0) {
        filter['#t'] = tags;
      }

      const events = await nostr.query([filter], {
        signal: AbortSignal.timeout(8000),
      });

      let notes = events.map(parseNote);

      // Client-side search filter (relays don't support full-text)
      if (search) {
        const q = search.toLowerCase();
        notes = notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q)),
        );
      }

      return notes;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < limit) return undefined;
      return lastPage[lastPage.length - 1].createdAt - 1;
    },
    initialPageParam: undefined as number | undefined,
    enabled,
  });
}

/** Fetch a single structured note by its d-tag identifier (always scoped to the app author) */
export function useStructuredNote(id: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nostr', 'note', APP_AUTHOR_PUBKEY, id],
    queryFn: async () => {
      const filter: Record<string, unknown> = {
        kinds: [NOTE_KIND],
        authors: [APP_AUTHOR_PUBKEY],
        '#d': [id],
        limit: 1,
      };

      const events = await nostr.query([filter], {
        signal: AbortSignal.timeout(5000),
      });

      if (events.length === 0) return null;
      return parseNote(events[0]);
    },
    enabled: !!id,
  });
}

interface CreateNoteParams {
  title: string;
  content: string;
  tags?: string[];
  /** Numeric order for sequencing (to 1dp) */
  order?: string;
  /** Optional d-tag for editing an existing note */
  dtag?: string;
}

/** Create or update a structured text note */
export function usePublishNote() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateNoteParams) => {
      const { title, content, tags = [], order, dtag } = params;
      const noteTags: string[][] = [];

      // d-tag (unique identifier)
      noteTags.push(['d', dtag ?? crypto.randomUUID()]);

      // Para. label
      noteTags.push(['title', title]);

      // Category tags
      for (const tag of tags) {
        if (tag.trim()) {
          noteTags.push(['t', tag.trim().toLowerCase()]);
        }
      }

      // Order for sequencing (optional)
      if (order) {
        noteTags.push(['order', order]);
      }

      // Published at
      noteTags.push(['published_at', String(Math.floor(Date.now() / 1000))]);

      // NIP-31 alt tag
      noteTags.push(['alt', 'Long-form Content']);

      const event = await publishEvent({
        kind: NOTE_KIND,
        content,
        tags: noteTags,
      });

      return parseNote(event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nostr', 'notes'] });
    },
  });
}
