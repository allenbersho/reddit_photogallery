import { useEffect, useRef } from 'react';
import type { GalleryItem } from '../../shared/types.js';
import { PhotoCard } from './PhotoCard.js';

type PhotoGridProps = {
  items: GalleryItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onSelectPhoto: (item: GalleryItem) => void;
  onRetry?: (() => void) | undefined;
  favoriteIds?: Set<string> | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
  emptyTitle?: string | undefined;
  emptySubtitle?: string | undefined;
};

export const PhotoGrid = ({
  items,
  loading,
  loadingMore,
  hasMore,
  error,
  onLoadMore,
  onSelectPhoto,
  onRetry,
  favoriteIds,
  onToggleFavorite,
  emptyTitle = 'No photos found',
  emptySubtitle = 'Try selecting another topic filter or checking back later.',
}: PhotoGridProps) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Setup infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingMore, loading, onLoadMore]);

  // Initial loading state: 15 skeleton cards
  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2 animate-fade-in">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-slate-800 dark:via-slate-700/60 dark:to-slate-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-3">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          Unable to load gallery
        </h3>
        <p className="text-xs text-gray-500 max-w-xs mb-4">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff5722] text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  // Empty state
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center mb-3 text-2xl">
          📷
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
          {emptyTitle}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
          {emptySubtitle}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
        {items.map((item) => (
          <PhotoCard
            key={item.id}
            item={item}
            onClick={onSelectPhoto}
            isFavorite={favoriteIds?.has(item.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {/* Loading more skeletons */}
      {loadingMore && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-gray-200 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Sentinel trigger for infinite scrolling */}
      <div ref={sentinelRef} className="h-10 w-full pointer-events-none" />
    </div>
  );
};
