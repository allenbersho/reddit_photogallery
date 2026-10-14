import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryItem, TimelinePage } from '../../shared/types.js';

type UseSearchOptions = {
  query: string;
  limit?: number | undefined;
};

type SearchState = {
  items: GalleryItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  nextCursor?: string | undefined;
  totalCount: number;
  error: string | null;
};

export const useSearch = ({ query, limit = 30 }: UseSearchOptions) => {
  const [state, setState] = useState<SearchState>({
    items: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    totalCount: 0,
    error: null,
  });

  const nextCursorRef = useRef<string | undefined>(undefined);
  const isLoadingRef = useRef(false);

  const executeSearch = useCallback(
    async (searchQuery: string, cursor?: string, isInitial = false) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setState({
          items: [],
          loading: false,
          loadingMore: false,
          hasMore: false,
          totalCount: 0,
          error: null,
        });
        return;
      }

      if (isLoadingRef.current) return;
      isLoadingRef.current = true;

      if (isInitial) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      } else {
        setState((prev) => ({ ...prev, loadingMore: true, error: null }));
      }

      try {
        const params = new URLSearchParams();
        params.set('q', trimmed);
        params.set('limit', limit.toString());
        if (cursor) params.set('cursor', cursor);

        const res = await fetch(`/api/gallery/search?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: TimelinePage = await res.json();
        nextCursorRef.current = data.nextCursor;

        setState((prev) => {
          const newItems = isInitial
            ? data.items
            : [
                ...prev.items,
                ...data.items.filter(
                  (newItem) => !prev.items.some((existing) => existing.id === newItem.id)
                ),
              ];

          return {
            items: newItems,
            loading: false,
            loadingMore: false,
            hasMore: data.hasMore,
            nextCursor: data.nextCursor,
            totalCount: data.totalCount,
            error: null,
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: message,
        }));
      } finally {
        isLoadingRef.current = false;
      }
    },
    [limit]
  );

  // Debounced search on query change
  useEffect(() => {
    let ignore = false;
    const trimmed = query.trim();

    if (!trimmed) {
      // Clear results without synchronous setState in effect
      const timer = setTimeout(() => {
        if (!ignore) {
          setState({
            items: [],
            loading: false,
            loadingMore: false,
            hasMore: false,
            totalCount: 0,
            error: null,
          });
        }
      }, 0);
      return () => {
        ignore = true;
        clearTimeout(timer);
      };
    }

    const timer = setTimeout(() => {
      if (!ignore) {
        nextCursorRef.current = undefined;
        void executeSearch(trimmed, undefined, true);
      }
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [query, executeSearch]);

  const loadMore = useCallback(() => {
    if (state.hasMore && !state.loadingMore && nextCursorRef.current) {
      void executeSearch(query.trim(), nextCursorRef.current, false);
    }
  }, [state.hasMore, state.loadingMore, query, executeSearch]);

  return {
    ...state,
    loadMore,
  };
};
