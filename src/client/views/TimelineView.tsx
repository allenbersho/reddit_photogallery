import type { GalleryItem } from '../../shared/types.js';
import { PhotoGrid } from '../components/PhotoGrid.js';
import { useTimeline } from '../hooks/useTimeline.js';
import type { TopicFilter, ZoomLevel } from '../types.js';

const ZOOM_LEVELS: readonly ZoomLevel[] = ['all', 'days', 'months', 'years'];

type TimelineViewProps = {
  selectedTopic: TopicFilter;
  zoomLevel: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  onSelectPhoto: (item: GalleryItem) => void;
  favoriteIds?: Set<string> | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
};

export const TimelineView = ({
  selectedTopic,
  zoomLevel,
  onZoomChange,
  onSelectPhoto,
  favoriteIds,
  onToggleFavorite,
}: TimelineViewProps) => {
  const { items, loading, loadingMore, hasMore, error, loadMore, refresh } =
    useTimeline({ topic: selectedTopic });

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24">
      {/* Zoom level toggle bar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => onZoomChange(z)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                zoomLevel === z
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {z === 'all' ? 'All' : z}
            </button>
          ))}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Filter: <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">{selectedTopic}</span>
        </div>
      </div>

      {/* Virtualized / Paged Photo Grid */}
      <PhotoGrid
        items={items}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        onLoadMore={loadMore}
        onSelectPhoto={onSelectPhoto}
        onRetry={refresh}
        favoriteIds={favoriteIds}
        onToggleFavorite={onToggleFavorite}
        emptyTitle={
          selectedTopic === 'all'
            ? 'No photos in the gallery yet'
            : `No ${selectedTopic} photos yet`
        }
        emptySubtitle="New community image posts will automatically appear here."
      />
    </div>
  );
};
