import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DisciplineFilter,
  GalleryItem,
  ImpactFilter,
  TimelinePage,
} from '../../shared/types.js';
import type { TopicFilter } from '../types.js';

type UseTimelineOptions = {
  topic?: TopicFilter | undefined;
  disciplines?: DisciplineFilter[] | DisciplineFilter | undefined;
  impacts?: ImpactFilter[] | ImpactFilter | undefined;
  year?: number | undefined;
  month?: number | undefined;
  placeType?: 'country' | 'region' | 'city' | 'unplaced' | undefined;
  placeKey?: string | undefined;
  limit?: number | undefined;
};

type TimelineState = {
  items: GalleryItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  nextCursor?: string | undefined;
  totalCount: number;
  error: string | null;
};

export const useTimeline = (options: UseTimelineOptions = {}) => {
  const {
    topic = 'all',
    disciplines,
    impacts,
    year,
    month,
    placeType,
    placeKey,
    limit = 30,
  } = options;

  const [state, setState] = useState<TimelineState>({
    items: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    totalCount: 0,
    error: null,
  });

  const nextCursorRef = useRef<string | undefined>(undefined);
  const isLoadingRef = useRef(false);

  const disciplinesKey = Array.isArray(disciplines)
    ? disciplines.join(',')
    : (disciplines ?? '');
  const impactsKey = Array.isArray(impacts)
    ? impacts.join(',')
    : (impacts ?? '');

  const fetchPage = useCallback(
    async (cursor?: string, isInitial = false) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;

      if (isInitial) {
        setState((prev) => ({ ...prev, loading: true, error: null }));
      } else {
        setState((prev) => ({ ...prev, loadingMore: true, error: null }));
      }

      try {
        const params = new URLSearchParams();
        params.set('limit', limit.toString());
        if (cursor) params.set('cursor', cursor);
        if (topic !== 'all') params.set('topic', topic);
        if (disciplinesKey) params.set('disciplines', disciplinesKey);
        if (impactsKey) params.set('impacts', impactsKey);
        if (year !== undefined) params.set('year', year.toString());
        if (month !== undefined) params.set('month', month.toString());
        if (placeType) params.set('placeType', placeType);
        if (placeKey) params.set('placeKey', placeKey);

        const res = await fetch(`/api/gallery/timeline?${params.toString()}`);
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
        const message = err instanceof Error ? err.message : 'Failed to load timeline';
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
    [topic, disciplinesKey, impactsKey, year, month, placeType, placeKey, limit]
  );


  // Reload when filters change
  useEffect(() => {
    let ignore = false;
    nextCursorRef.current = undefined;

    const timer = setTimeout(() => {
      if (!ignore) {
        void fetchPage(undefined, true);
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (state.hasMore && !state.loadingMore && nextCursorRef.current) {
      void fetchPage(nextCursorRef.current, false);
    }
  }, [state.hasMore, state.loadingMore, fetchPage]);

  const refresh = useCallback(() => {
    nextCursorRef.current = undefined;
    void fetchPage(undefined, true);
  }, [fetchPage]);

  return {
    ...state,
    loadMore,
    refresh,
  };
};
