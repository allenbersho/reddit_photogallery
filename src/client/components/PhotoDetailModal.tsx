import { useEffect, type MouseEvent } from 'react';
import { navigateTo, showToast } from '@devvit/web/client';
import type { GalleryItem } from '../../shared/types.js';
import { formatEpochDate } from '../utils/date.js';

type PhotoDetailModalProps = {
  item: GalleryItem;
  onClose: () => void;
  isFavorite?: boolean | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
};

type BadgeInfo = { label: string; icon: string; bg: string };

const DEFAULT_BADGE: BadgeInfo = {
  label: 'General',
  icon: '📷',
  bg: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30',
};

const TOPIC_BADGES: Record<string, BadgeInfo> = {
  science: { label: 'Science', icon: '🔬', bg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  engineering: { label: 'Engineering', icon: '⚙️', bg: 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  art: { label: 'Art', icon: '🎨', bg: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  other: DEFAULT_BADGE,
};

const getBadge = (topic: string): BadgeInfo => {
  const badge = TOPIC_BADGES[topic];
  return badge !== undefined ? badge : DEFAULT_BADGE;
};

export const PhotoDetailModal = ({
  item,
  onClose,
  isFavorite = false,
  onToggleFavorite,
}: PhotoDetailModalProps) => {
  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const topicBadge = getBadge(item.topic);

  const handleOpenReddit = () => {
    const postUrl = item.permalink.startsWith('http')
      ? item.permalink
      : `https://reddit.com${item.permalink}`;
    try {
      navigateTo(postUrl);
    } catch {
      window.open(postUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyLink = async () => {
    const postUrl = item.permalink.startsWith('http')
      ? item.permalink
      : `https://reddit.com${item.permalink}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(postUrl);
        showToast('Reddit post link copied to clipboard!');
      } else {
        showToast(postUrl);
      }
    } catch {
      showToast('Could not copy link to clipboard');
    }
  };

  const handleFavoriteClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(item.id);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in"
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col md:flex-row bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-200/40 dark:border-slate-800"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo details"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer text-sm shadow-md"
          title="Close (Esc)"
        >
          ✕
        </button>

        {/* Media Preview Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] max-h-[55vh] md:max-h-[92vh] overflow-hidden select-none">
          <img
            src={item.media.url}
            alt={item.title}
            className="w-full h-full object-contain max-h-[55vh] md:max-h-[92vh]"
          />
        </div>

        {/* Metadata Sidebar / Bottom Sheet */}
        <div className="w-full md:w-80 lg:w-96 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto max-h-[40vh] md:max-h-[92vh] bg-white dark:bg-slate-900">
          <div className="flex flex-col gap-4">
            {/* Topic pill + Resolution */}
            <div className="flex items-center justify-between text-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold border ${topicBadge.bg}`}
              >
                <span>{topicBadge.icon}</span>
                <span>{topicBadge.label}</span>
              </span>

              <span className="text-[11px] text-gray-400">
                {item.media.width} × {item.media.height}
              </span>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {item.title}
              </h2>
            </div>

            {/* Author and Subreddit */}
            <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300 pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-orange-400 to-red-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                {item.author.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  u/{item.author}
                </span>
                <span className="text-[11px] text-gray-400">
                  in r/{item.subreddit}
                </span>
              </div>
            </div>

            {/* Date & Location metadata details */}
            <div className="flex flex-col gap-2.5 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">📅</span>
                <span>Posted {formatEpochDate(item.createdAt)}</span>
                {item.takenAt !== undefined && (
                  <span className="text-gray-400 text-[11px]">
                    (Captured {formatEpochDate(item.takenAt)})
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2">
                <span className="text-gray-400">📍</span>
                {item.place ? (
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {[item.place.city, item.place.region, item.place.country]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 capitalize">
                      {item.place.status.replace('-', ' ')}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400 italic">No location tagged</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-6 mt-4 border-t border-gray-100 dark:border-slate-800">
            {/* View on Reddit Primary Button */}
            <button
              type="button"
              onClick={handleOpenReddit}
              className="w-full py-2.5 px-4 rounded-xl bg-reddit-orange hover:bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <span>View on Reddit</span>
              <span>↗</span>
            </button>

            {/* Secondary actions: Favorite & Copy Link */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleFavoriteClick}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  isFavorite
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-semibold'
                    : 'bg-gray-100 dark:bg-slate-800 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{isFavorite ? '❤️' : '🤍'}</span>
                <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="py-2 px-3 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>📋</span>
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
