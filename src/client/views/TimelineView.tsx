import type { TopicFilter, ZoomLevel } from '../types.js';

type TimelineViewProps = {
  selectedTopic: TopicFilter;
  zoomLevel: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  onSelectPost?: (postId: string) => void;
};

export const TimelineView = ({
  selectedTopic,
  zoomLevel,
  onZoomChange,
}: TimelineViewProps) => {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24">
      {/* Zoom level toggle bar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
          {(['all', 'days', 'months', 'years'] as const).map((z) => (
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

      {/* Grid container placeholder for Task 5.2 */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 sm:gap-2">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-gray-200/80 dark:bg-slate-800/80 animate-pulse flex items-center justify-center text-gray-400 text-xs font-mono"
          >
            Photo {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
};
