import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaceHierarchyNode, PlacesSummary } from '../../shared/types.js';

type PlacesState = {
  hierarchy: PlaceHierarchyNode[];
  unplacedCount: number;
  loading: boolean;
  error: string | null;
};

export const usePlacesSummary = () => {
  const [state, setState] = useState<PlacesState>({
    hierarchy: [],
    unplacedCount: 0,
    loading: true,
    error: null,
  });

  const isLoadingRef = useRef(false);

  const fetchPlaces = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const res = await fetch('/api/gallery/places');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: PlacesSummary = await res.json();
      setState({
        hierarchy: data.hierarchy,
        unplacedCount: data.unplacedCount,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load places';
      setState({
        hierarchy: [],
        unplacedCount: 0,
        loading: false,
        error: message,
      });
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      if (!ignore) {
        void fetchPlaces();
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchPlaces]);

  return {
    ...state,
    refresh: fetchPlaces,
  };
};
