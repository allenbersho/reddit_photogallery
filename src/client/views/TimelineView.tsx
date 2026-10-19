import { useMemo, useState } from 'react';
import type {
  DisciplineFilter,
  GalleryItem,
  ImpactFilter,
} from '../../shared/types.js';
import { PhotoCard } from '../components/PhotoCard.js';
import { PhotoGrid } from '../components/PhotoGrid.js';
import { TimelineScrubber } from '../components/TimelineScrubber.js';
import { useTimeline } from '../hooks/useTimeline.js';
import { useTimelineSummary } from '../hooks/useTimelineSummary.js';
import type { TopicFilter, ZoomLevel } from '../types.js';
import { getMonthName, groupItemsByDay } from '../utils/date.js';

const ZOOM_LEVELS: readonly ZoomLevel[] = ['all', 'days', 'months', 'years'];

type TimelineViewProps = {
  selectedDisciplines?: DisciplineFilter[] | undefined;
  selectedImpacts?: ImpactFilter[] | undefined;
  selectedTopic?: TopicFilter | undefined;
  zoomLevel: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  onSelectPhoto: (item: GalleryItem) => void;
  favoriteIds?: Set<string> | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
  onResetFilters?: (() => void) | undefined;
};

export const TimelineView = ({
  selectedDisciplines = [],
  selectedImpacts = [],
  selectedTopic = 'all',
  zoomLevel,
  onZoomChange,
  onSelectPhoto,
  favoriteIds,
  onToggleFavorite,
  onResetFilters,
}: TimelineViewProps) => {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);

  const { summary } = useTimelineSummary();

  const { items, loading, loadingMore, hasMore, error, loadMore, refresh } =
    useTimeline({
      disciplines: selectedDisciplines.length > 0 ? selectedDisciplines : undefined,
      impacts: selectedImpacts.length > 0 ? selectedImpacts : undefined,
      topic:
        selectedDisciplines.length === 0 && selectedImpacts.length === 0
          ? selectedTopic
          : undefined,
      year: selectedYear,
      month: selectedMonth,
    });

  const dayGroups = useMemo(() => groupItemsByDay(items), [items]);

  const handleSelectTime = (
    year?: number | undefined,
    month?: number | undefined
  ) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const handleYearCardClick = (year: number) => {
    setSelectedYear(year);
    setSelectedMonth(undefined);
    onZoomChange('months');
  };

  const handleMonthCardClick = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    onZoomChange('days');
  };

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];
    if (selectedDisciplines.length > 0) {
      parts.push(`Disciplines: ${selectedDisciplines.join(', ')}`);
    }
    if (selectedImpacts.length > 0) {
      parts.push(`Impacts: ${selectedImpacts.join(', ')}`);
    }
    if (parts.length === 0 && selectedTopic !== 'all') {
      parts.push(`Topic: ${selectedTopic}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'All community photos';
  }, [selectedDisciplines, selectedImpacts, selectedTopic]);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24">
      {/* Zoom level toggle bar & Active filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="truncate max-w-[280px] sm:max-w-md">
            Showing:{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {filterSummaryText}
            </span>
          </span>
          {(selectedDisciplines.length > 0 || selectedImpacts.length > 0) &&
            onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer shrink-0"
              >
                Clear
              </button>
            )}
        </div>
      </div>

      {/* Timeline Scrubber Bar */}
      {summary && summary.years.length > 0 && (
        <TimelineScrubber
          years={summary.years}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onSelectTime={handleSelectTime}
        />
      )}

      {/* Selected time breadcrumb filter pill if filtered */}
      {(selectedYear !== undefined || selectedMonth !== undefined) && (
        <div className="flex items-center gap-2 mb-3 px-1 text-xs">
          <span className="text-gray-500 dark:text-gray-400">Time window:</span>
          <span className="px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-medium">
            {selectedMonth !== undefined ? `${getMonthName(selectedMonth)} ` : ''}
            {selectedYear}
          </span>
          <button
            type="button"
            onClick={() => handleSelectTime(undefined, undefined)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer underline text-[11px]"
          >
            Clear time filter
          </button>
        </div>
      )}

      {/* ZOOM LEVEL: YEARS */}
      {zoomLevel === 'years' && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {summary.years.map((y) => {
            const yearItem = items.find(
              (i) => new Date(i.createdAt * 1000).getFullYear() === y.year
            );
            return (
              <div
                key={y.year}
                role="button"
                tabIndex={0}
                onClick={() => handleYearCardClick(y.year)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ')
                    handleYearCardClick(y.year);
                }}
                className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-gray-200 dark:bg-slate-800 cursor-pointer shadow-xs hover:shadow-md transition-all transform hover:-translate-y-0.5"
              >
                {yearItem ? (
                  <img
                    src={yearItem.media.previewUrl || yearItem.media.url}
                    alt={String(y.year)}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-amber-500/20 to-orange-600/30 flex items-center justify-center">
                    <span className="text-3xl opacity-50">📅</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3 text-white">
                  <span className="text-2xl font-bold tracking-tight">
                    {y.year}
                  </span>
                  <span className="text-xs text-gray-200">{y.count} photos</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ZOOM LEVEL: MONTHS */}
      {zoomLevel === 'months' && summary && (
        <div className="flex flex-col gap-6">
          {summary.years
            .filter((y) => selectedYear === undefined || y.year === selectedYear)
            .map((y) => (
              <div key={y.year} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1">
                  {y.year}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {y.months.map((m) => {
                    const monthItem = items.find((i) => {
                      const d = new Date(i.createdAt * 1000);
                      return (
                        d.getFullYear() === y.year && d.getMonth() + 1 === m.month
                      );
                    });

                    return (
                      <div
                        key={m.month}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleMonthCardClick(y.year, m.month)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            handleMonthCardClick(y.year, m.month);
                        }}
                        className="group relative aspect-4/3 rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-800 cursor-pointer shadow-xs hover:shadow-md transition-all transform hover:-translate-y-0.5"
                      >
                        {monthItem ? (
                          <img
                            src={
                              monthItem.media.previewUrl || monthItem.media.url
                            }
                            alt={`${getMonthName(m.month)} ${y.year}`}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-linear-to-br from-blue-500/20 to-indigo-600/30 flex items-center justify-center">
                            <span className="text-2xl opacity-50">🗓️</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2.5 text-white">
                          <span className="text-base font-bold">
                            {getMonthName(m.month)}
                          </span>
                          <span className="text-[11px] text-gray-200">
                            {m.count} photos
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ZOOM LEVEL: DAYS */}
      {zoomLevel === 'days' && (
        <div className="flex flex-col gap-6">
          {dayGroups.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
              No photos found for this time range.
            </div>
          )}

          {dayGroups.map((group) => (
            <section key={group.dateKey} className="flex flex-col gap-2">
              <div className="sticky top-14 z-10 py-1 px-2 backdrop-blur-md bg-white/70 dark:bg-slate-900/70 rounded-lg flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {group.label}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {group.items.length}{' '}
                  {group.items.length === 1 ? 'photo' : 'photos'}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
                {group.items.map((item) => (
                  <PhotoCard
                    key={item.id}
                    item={item}
                    onClick={onSelectPhoto}
                    isFavorite={favoriteIds?.has(item.id)}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ZOOM LEVEL: ALL (Default dense photo grid) */}
      {zoomLevel === 'all' && (
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
            selectedDisciplines.length > 0 || selectedImpacts.length > 0
              ? 'No photos matching the selected Chimera filters'
              : 'No photos in the gallery yet'
          }
          emptySubtitle="New community image posts will automatically appear here."
        />
      )}
    </div>
  );
};
