import { useState } from 'react';
import type { GalleryItem, PlaceHierarchyNode } from '../../shared/types.js';
import { PhotoGrid } from '../components/PhotoGrid.js';
import { usePlacesSummary } from '../hooks/usePlacesSummary.js';
import { useTimeline } from '../hooks/useTimeline.js';

type PlacesViewProps = {
  onSelectPhoto: (item: GalleryItem) => void;
  favoriteIds?: Set<string> | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
};

export const PlacesView = ({
  onSelectPhoto,
  favoriteIds,
  onToggleFavorite,
}: PlacesViewProps) => {
  const { hierarchy, unplacedCount, loading, error, refresh } = usePlacesSummary();

  const [selectedCountry, setSelectedCountry] = useState<PlaceHierarchyNode | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<PlaceHierarchyNode | null>(null);
  const [selectedCity, setSelectedCity] = useState<PlaceHierarchyNode | null>(null);
  const [isUnplacedSelected, setIsUnplacedSelected] = useState(false);

  // Determine active place query for the photo grid
  let activePlaceType: 'country' | 'region' | 'city' | 'unplaced' | undefined = undefined;
  let activePlaceKey: string | undefined = undefined;

  if (isUnplacedSelected) {
    activePlaceType = 'unplaced';
  } else if (selectedCity) {
    activePlaceType = 'city';
    activePlaceKey = selectedCity.key;
  } else if (selectedRegion) {
    activePlaceType = 'region';
    activePlaceKey = selectedRegion.key;
  } else if (selectedCountry) {
    activePlaceType = 'country';
    activePlaceKey = selectedCountry.key;
  }

  // Load photos for the active drill-down place
  const {
    items: placeItems,
    loading: itemsLoading,
    loadingMore,
    hasMore,
    error: itemsError,
    loadMore,
    refresh: refreshItems,
  } = useTimeline({
    placeType: activePlaceType,
    placeKey: activePlaceKey,
  });

  const handleBackToRoot = () => {
    setSelectedCountry(null);
    setSelectedRegion(null);
    setSelectedCity(null);
    setIsUnplacedSelected(false);
  };

  const handleBackToCountry = () => {
    setSelectedRegion(null);
    setSelectedCity(null);
  };

  const handleBackToRegion = () => {
    setSelectedCity(null);
  };

  if (loading) {
    return (
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 pb-24">
        <div className="h-6 w-32 bg-gray-200 dark:bg-slate-800 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-gray-200 dark:bg-slate-800 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-4/3 rounded-2xl bg-gray-200 dark:bg-slate-800 p-4 flex flex-col justify-end animate-pulse"
            >
              <div className="h-4 w-24 bg-gray-300 dark:bg-slate-700 rounded mb-1" />
              <div className="h-3 w-16 bg-gray-300 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-500 font-medium mb-3">Failed to load places</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="px-4 py-1.5 rounded-xl bg-reddit-orange text-white text-xs font-semibold hover:bg-orange-600 transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  // DRILL-DOWN VIEW (Country, Region, City, or Unplaced)
  if (activePlaceType) {
    return (
      <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24 animate-fade-in">
        {/* Navigation Breadcrumbs / Back button */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={
              selectedCity
                ? handleBackToRegion
                : selectedRegion
                  ? handleBackToCountry
                  : handleBackToRoot
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-xs font-medium text-gray-800 dark:text-gray-200 transition-colors cursor-pointer"
          >
            <span>←</span>
            <span>
              Back to{' '}
              {selectedCity
                ? selectedRegion?.name
                : selectedRegion
                  ? selectedCountry?.name
                  : 'All Places'}
            </span>
          </button>
        </div>

        {/* Place Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>📍</span>
            <span>
              {isUnplacedSelected
                ? 'Unplaced Photos'
                : selectedCity
                  ? `${selectedCity.name}, ${selectedCountry?.name ?? ''}`
                  : selectedRegion
                    ? `${selectedRegion.name}, ${selectedCountry?.name ?? ''}`
                    : selectedCountry?.name}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isUnplacedSelected
              ? `${unplacedCount} photos without location tags`
              : selectedCity
                ? `${selectedCity.count} photos in this city`
                : selectedRegion
                  ? `${selectedRegion.count} photos in this region`
                  : `${selectedCountry?.count ?? 0} photos in this country`}
          </p>
        </div>

        {/* Sub-regions if country selected */}
        {!selectedRegion && selectedCountry && selectedCountry.children && selectedCountry.children.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Regions & Areas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {selectedCountry.children.map((child) => (
                <button
                  key={child.key}
                  type="button"
                  onClick={() => setSelectedRegion(child)}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 hover:bg-orange-50 dark:hover:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 transition-all text-left cursor-pointer group"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-reddit-orange transition-colors truncate">
                    {child.name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {child.count} {child.count === 1 ? 'photo' : 'photos'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-cities if region selected */}
        {!selectedCity && selectedRegion && selectedRegion.children && selectedRegion.children.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Cities & Landmarks
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {selectedRegion.children.map((child) => (
                <button
                  key={child.key}
                  type="button"
                  onClick={() => setSelectedCity(child)}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 hover:bg-orange-50 dark:hover:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 transition-all text-left cursor-pointer group"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-reddit-orange transition-colors truncate">
                    {child.name}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {child.count} {child.count === 1 ? 'photo' : 'photos'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Photos in this place */}
        <PhotoGrid
          items={placeItems}
          loading={itemsLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          error={itemsError}
          onLoadMore={loadMore}
          onSelectPhoto={onSelectPhoto}
          onRetry={refreshItems}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          emptyTitle="No photos found in this place"
          emptySubtitle="Tag photos with this location to see them appear here."
        />
      </div>
    );
  }

  // ROOT PLACES HIERARCHY VIEW
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24 animate-fade-in">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Places
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Explore science, engineering, and art captures around the globe
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {/* Country Cards */}
        {hierarchy.map((country) => {
          const regionCount = country.children ? country.children.length : 0;
          return (
            <div
              key={country.key}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCountry(country)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedCountry(country);
              }}
              className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-4 flex flex-col justify-between border border-gray-200/60 dark:border-slate-700/60 shadow-xs hover:shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">🌍</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/80 dark:bg-slate-700/80 text-gray-700 dark:text-gray-300 shadow-xs">
                  {country.count}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-reddit-orange transition-colors truncate">
                  {country.name}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {regionCount > 0 ? `${regionCount} ${regionCount === 1 ? 'region' : 'regions'}` : `${country.count} photos`}
                </p>
              </div>
            </div>
          );
        })}

        {/* Unplaced Photos Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsUnplacedSelected(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setIsUnplacedSelected(true);
          }}
          className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-linear-to-br from-amber-50 to-orange-50 dark:from-slate-800/80 dark:to-amber-950/30 p-4 flex flex-col justify-between border border-dashed border-amber-300 dark:border-amber-700/60 shadow-xs hover:shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">📍❓</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 shadow-xs">
              {unplacedCount}
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-reddit-orange transition-colors">
              Unplaced
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Photos without locations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
