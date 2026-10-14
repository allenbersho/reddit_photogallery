import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineSummary } from '../../shared/types.js';

type TimelineSummaryState = {
  summary: TimelineSummary | null;
  loading: boolean;
  error: string | null;
};

export const useTimelineSummary = () => {
  const [state, setState] = useState<TimelineSummaryState>({
    summary: null,
    loading: true,
    error: null,
  });

  const isLoadingRef = useRef(false);

  const fetchSummary = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const res = await fetch('/api/gallery/timeline/summary');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: TimelineSummary = await res.json();
      setState({
        summary: data,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load timeline summary';
      setState({
        summary: null,
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
        void fetchSummary();
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [fetchSummary]);

  return {
    ...state,
    refresh: fetchSummary,
  };
};
