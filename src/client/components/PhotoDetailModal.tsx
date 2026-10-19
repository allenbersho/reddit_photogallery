import { useEffect, useState, type MouseEvent } from 'react';
import { navigateTo, showToast } from '@devvit/web/client';
import {
  CHIMERA_DISCIPLINES,
  CHIMERA_IMPACTS,
  DISCIPLINE_COLORS,
  IMPACT_COLORS,
  type Discipline,
  type Impact,
  type TagSource,
} from '../../shared/taxonomy.js';
import type { GalleryItem } from '../../shared/types.js';
import { formatEpochDate } from '../utils/date.js';

type PhotoDetailModalProps = {
  item: GalleryItem;
  onClose: () => void;
  isFavorite?: boolean | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
  currentUser?: string | null | undefined;
  isModerator?: boolean | undefined;
  onItemUpdated?: ((updated: GalleryItem) => void) | undefined;
};

const DISCIPLINE_ICONS: Record<Discipline, string> = {
  Electromagnetics: '⚡',
  Mechanics: '⚙️',
  Biology: '🧬',
  Mathematics: '📐',
  Arts: '🎨',
  Materials: '💎',
};

const IMPACT_ICONS: Record<Impact, string> = {
  Self: '👤',
  Home: '🏠',
  Friends: '👥',
  Government: '🏛️',
};

const TAG_SOURCE_STYLES: Record<
  TagSource,
  { label: string; bg: string; text: string; icon: string }
> = {
  'mod-verified': {
    label: 'Mod-verified',
    bg: 'bg-emerald-100 dark:bg-emerald-950/70',
    text: 'text-emerald-800 dark:text-emerald-300',
    icon: '🛡️',
  },
  'poster-tagged': {
    label: 'Poster-tagged',
    bg: 'bg-blue-100 dark:bg-blue-950/70',
    text: 'text-blue-800 dark:text-blue-300',
    icon: '🏷️',
  },
  'auto-suggested': {
    label: 'Auto-suggested',
    bg: 'bg-purple-100 dark:bg-purple-950/70',
    text: 'text-purple-800 dark:text-purple-300',
    icon: '🤖',
  },
  unverified: {
    label: 'Unverified',
    bg: 'bg-gray-100 dark:bg-slate-800',
    text: 'text-gray-600 dark:text-gray-400',
    icon: '⚪',
  },
  untagged: {
    label: 'Untagged',
    bg: 'bg-gray-100 dark:bg-slate-800',
    text: 'text-gray-500 dark:text-gray-400',
    icon: '⚪',
  },
};

export const PhotoDetailModal = ({
  item: initialItem,
  onClose,
  isFavorite = false,
  onToggleFavorite,
  currentUser,
  isModerator = false,
  onItemUpdated,
}: PhotoDetailModalProps) => {
  const [item, setItem] = useState<GalleryItem>(initialItem);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [selectedDisciplines, setSelectedDisciplines] = useState<Discipline[]>(
    initialItem.disciplines ?? []
  );
  const [selectedImpacts, setSelectedImpacts] = useState<Impact[]>(
    initialItem.impacts ?? []
  );
  const [locationInput, setLocationInput] = useState(
    initialItem.place?.city ||
      initialItem.place?.region ||
      initialItem.place?.country ||
      ''
  );
  const [savingTags, setSavingTags] = useState(false);

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingTags) {
          setIsEditingTags(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditingTags]);


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

  const handleOpenOriginalPost = () => {
    if (!item.originalPermalink) return;
    const postUrl = item.originalPermalink.startsWith('http')
      ? item.originalPermalink
      : `https://reddit.com${item.originalPermalink}`;
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

  const toggleDiscipline = (disc: Discipline) => {
    setSelectedDisciplines((prev) =>
      prev.includes(disc) ? prev.filter((d) => d !== disc) : [...prev, disc]
    );
  };

  const toggleImpact = (imp: Impact) => {
    setSelectedImpacts((prev) =>
      prev.includes(imp) ? prev.filter((i) => i !== imp) : [...prev, imp]
    );
  };

  const handleSaveTags = async () => {
    setSavingTags(true);
    try {
      const res = await fetch(`/api/gallery/${item.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplines: selectedDisciplines,
          impacts: selectedImpacts,
          location: locationInput.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          (errorData as { message?: string }).message ||
            `Failed to update tags (HTTP ${res.status})`
        );
      }

      const updatedData: { success: boolean; item?: GalleryItem } =
        await res.json();
      if (updatedData.item) {
        setItem(updatedData.item);
        if (onItemUpdated) {
          onItemUpdated(updatedData.item);
        }
      } else {
        // Fallback optimistic update
        const fallbackUpdated: GalleryItem = {
          ...item,
          disciplines: selectedDisciplines,
          impacts: selectedImpacts,
          disciplinesSource: isModerator ? 'mod-verified' : 'poster-tagged',
          impactsSource: isModerator ? 'mod-verified' : 'poster-tagged',
        };
        setItem(fallbackUpdated);
        if (onItemUpdated) {
          onItemUpdated(fallbackUpdated);
        }
      }

      setIsEditingTags(false);
      showToast('Tags updated successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating tags';
      showToast(msg);
    } finally {
      setSavingTags(false);
    }
  };

  const disciplineTagSource = item.disciplinesSource ?? 'untagged';
  const tagSourceMeta =
    TAG_SOURCE_STYLES[disciplineTagSource] ?? TAG_SOURCE_STYLES.untagged;


  const isAuthor =
    Boolean(currentUser) &&
    (currentUser === item.author ||
      (item.crossposterName && currentUser === item.crossposterName));
  const canEditTags = isAuthor || isModerator;

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

        {/* Metadata Sidebar */}
        <div className="w-full md:w-84 lg:w-96 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-[92vh] bg-white dark:bg-slate-900">
          <div className="flex flex-col gap-3.5">
            {/* Resolution & Tag Source status */}
            <div className="flex items-center justify-between text-xs">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold ${tagSourceMeta.bg} ${tagSourceMeta.text}`}
              >
                <span>{tagSourceMeta.icon}</span>
                <span>{tagSourceMeta.label}</span>
              </span>

              <span className="text-[11px] text-gray-400">
                {item.media.width} × {item.media.height}
              </span>
            </div>

            {/* Crosspost Attribution Banner */}
            {item.isCrosspost && item.originalSubreddit && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 border border-blue-200/60 dark:border-indigo-900/60 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1">
                    <span>🔄</span>
                    <span>Crossposted from r/{item.originalSubreddit}</span>
                  </span>
                  {item.originalPermalink && (
                    <button
                      type="button"
                      onClick={handleOpenOriginalPost}
                      className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Original post ↗
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-gray-600 dark:text-gray-400">
                  <span>Originally by </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-200">
                    u/{item.originalAuthor || 'unknown'}
                  </span>
                  {item.originalCreatedAt && (
                    <span> • {formatEpochDate(item.originalCreatedAt)}</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-blue-200/40 dark:border-slate-700/60">
                  Shared into r/{item.subreddit} by{' '}
                  <span className="font-semibold">
                    u/{item.crossposterName || item.author}
                  </span>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {item.title}
              </h2>
            </div>

            {/* Chimera Tags Section */}
            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Chimera Tags
                </span>
                {canEditTags && !isEditingTags && (
                  <button
                    type="button"
                    onClick={() => setIsEditingTags(true)}
                    className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span>✏️</span>
                    <span>Edit Tags</span>
                  </button>
                )}
              </div>

              {!isEditingTags ? (
                <div className="flex flex-col gap-1.5">
                  {/* Disciplines Chips */}
                  <div className="flex flex-wrap items-center gap-1">
                    {item.disciplines && item.disciplines.length > 0 ? (
                      item.disciplines.map((d) => {
                        const colors = DISCIPLINE_COLORS[d];
                        return (
                          <span
                            key={d}
                            style={{
                              backgroundColor: colors?.bg ?? '#a0d8f1',
                              color: colors?.text ?? '#111827',
                            }}
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs border border-black/10"
                          >
                            <span>{DISCIPLINE_ICONS[d] ?? '🏷️'}</span>
                            <span>{d}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        No discipline tagged
                      </span>
                    )}
                  </div>

                  {/* Impacts Chips */}
                  <div className="flex flex-wrap items-center gap-1">
                    {item.impacts && item.impacts.length > 0 ? (
                      item.impacts.map((imp) => {
                        const colors = IMPACT_COLORS[imp];
                        return (
                          <span
                            key={imp}
                            style={{
                              backgroundColor: colors?.bg ?? '#d4e6f1',
                              color: colors?.text ?? '#111827',
                            }}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs border border-black/10"
                          >
                            <span>{IMPACT_ICONS[imp] ?? '🌐'}</span>
                            <span>{imp}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        No impact tagged
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* In-Modal Direct Tag Editor */
                <div className="flex flex-col gap-2.5 pt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                      Disciplines:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {CHIMERA_DISCIPLINES.map((d) => {
                        const selected = selectedDisciplines.includes(d);
                        const colors = DISCIPLINE_COLORS[d];
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDiscipline(d)}
                            style={
                              selected
                                ? {
                                    backgroundColor: colors.bg,
                                    color: colors.text,
                                    borderColor: colors.border,
                                  }
                                : undefined
                            }
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border cursor-pointer ${
                              selected
                                ? 'shadow-xs border-current font-bold'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {DISCIPLINE_ICONS[d]} {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                      Impacts:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {CHIMERA_IMPACTS.map((imp) => {
                        const selected = selectedImpacts.includes(imp);
                        const colors = IMPACT_COLORS[imp];
                        return (
                          <button
                            key={imp}
                            type="button"
                            onClick={() => toggleImpact(imp)}
                            style={
                              selected
                                ? {
                                    backgroundColor: colors.bg,
                                    color: colors.text,
                                    borderColor: colors.border,
                                  }
                                : undefined
                            }
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border cursor-pointer ${
                              selected
                                ? 'shadow-xs border-current font-bold'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200'
                            }`}
                          >
                            {IMPACT_ICONS[imp]} {imp}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="photo-location-input"
                      className="text-[10px] font-bold text-gray-600 dark:text-gray-300"
                    >
                      Location:
                    </label>
                    <input
                      id="photo-location-input"
                      type="text"
                      placeholder="e.g. Paris, Tokyo, Boston"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={savingTags}
                      onClick={() => setIsEditingTags(false)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingTags}
                      onClick={handleSaveTags}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      {savingTags ? 'Saving...' : 'Save Tags'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Author and Community info */}
            <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-300 pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
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
            <div className="flex flex-col gap-2 text-xs text-gray-600 dark:text-gray-300">
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
          <div className="flex flex-col gap-2 pt-4 mt-3 border-t border-gray-100 dark:border-slate-800">
            {/* View on Reddit Primary Button */}
            <button
              type="button"
              onClick={handleOpenReddit}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
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
