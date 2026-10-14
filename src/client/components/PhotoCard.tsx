import { useState, type MouseEvent } from 'react';
import type { GalleryItem } from '../../shared/types.js';

type PhotoCardProps = {
  item: GalleryItem;
  onClick: (item: GalleryItem) => void;
  isFavorite?: boolean | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
};

const TOPIC_BADGES: Record<string, { label: string; icon: string; bg: string }> = {
  science: { label: 'Science', icon: '🔬', bg: 'bg-emerald-500/80' },
  engineering: { label: 'Eng', icon: '⚙️', bg: 'bg-blue-500/80' },
  art: { label: 'Art', icon: '🎨', bg: 'bg-purple-500/80' },
  other: { label: 'General', icon: '📷', bg: 'bg-gray-500/80' },
};

export const PhotoCard = ({
  item,
  onClick,
  isFavorite = false,
  onToggleFavorite,
}: PhotoCardProps) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const topicInfo = TOPIC_BADGES[item.topic] ?? TOPIC_BADGES.other;

  const handleFavoriteClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(item.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.title} by u/${item.author}`}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
      className="group relative aspect-square rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-800 cursor-pointer select-none transition-transform duration-200 active:scale-97 shadow-xs hover:shadow-md"
    >
      {/* Loading skeleton placeholder */}
      {!loaded && !failed && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-slate-800 dark:via-slate-700/60 dark:to-slate-800 animate-pulse" />
      )}

      {/* Image with smooth fade-in */}
      {!failed ? (
        <img
          src={item.media.url}
          alt={item.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-900">
          <svg className="w-6 h-6 mb-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] line-clamp-1">{item.title}</span>
        </div>
      )}

      {/* Subtle overlay vignette on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

      {/* Top overlay badges: Topic + Favorite */}
      <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
        {/* Topic pill */}
        <span
          className={`text-[9px] font-semibold text-white px-1.5 py-0.5 rounded-full backdrop-blur-md shadow-xs flex items-center gap-1 ${
            topicInfo?.bg ?? 'bg-black/60'
          }`}
        >
          <span>{topicInfo?.icon}</span>
          <span className="hidden sm:inline">{topicInfo?.label}</span>
        </span>

        {/* Favorite heart button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFavorite ? `Remove ${item.title} from favorites` : `Add ${item.title} to favorites`}
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md text-white transition-all pointer-events-auto cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 ${
                isFavorite
                  ? 'fill-rose-500 text-rose-500 scale-110'
                  : 'fill-none text-white hover:text-rose-400'
              } transition-transform`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom overlay details on hover/active */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <p className="text-[11px] font-medium leading-tight truncate drop-shadow-sm">
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-300 drop-shadow-sm">
          {item.place && (
            <span className="truncate flex items-center gap-0.5">
              <span>📍</span>
              {item.place.city || item.place.region || item.place.country}
            </span>
          )}
          <span className="ml-auto opacity-75">u/{item.author}</span>
        </div>
      </div>
    </div>
  );
};
