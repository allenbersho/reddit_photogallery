import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryItem, TimelinePage } from '../../shared/types.js';

type FavoritesState = {
  items: GalleryItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  nextCursor?: string | undefined;
  totalCount: number;
  error: string | null;
};

export const useFavorites = (username: string | null) => {
  const [state, setState] = useState<FavoritesState>({
    items: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    totalCount: 0,
    error: null,
  });

  const nextCursorRef = useRef<string | undefined>(undefined);
  const isLoadingRef = useRef(false);

  const fetchFavorites = useCallback(
    async (cursor?: string, isInitial = false) => {
      if (!username) {
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
        params.set('limit', '30');
        if (cursor) params.set('cursor', cursor);

        const res = await fetch(`/api/gallery/favorites?${params.toString()}`);
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
        const message = err instanceof Error ? err.message : 'Failed to load favorites';
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
    [username]
  );

  useEffect(() => {
    let ignore = false;
    nextCursorRef.current = undefined;

    const timer = setTimeout(() => {
      if (!ignore) {
        void fetchFavorites(undefined, true);
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchFavorites]);

  const loadMore = useCallback(() => {
    if (state.hasMore && !state.loadingMore && nextCursorRef.current) {
      void fetchFavorites(nextCursorRef.current, false);
    }
  }, [state.hasMore, state.loadingMore, fetchFavorites]);

  const removeFavoriteLocally = useCallback((postId: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== postId),
      totalCount: Math.max(0, prev.totalCount - 1),
    }));
  }, []);

  return {
    ...state,
    loadMore,
    refresh: () => fetchFavorites(undefined, true),
    removeFavoriteLocally,
  };
};
