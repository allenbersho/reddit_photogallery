import type { GalleryItem } from '../../shared/types.js';
import { PhotoGrid } from '../components/PhotoGrid.js';
import { useFavorites } from '../hooks/useFavorites.js';

type FavoritesViewProps = {
  username?: string | null | undefined;
  onSelectPhoto: (item: GalleryItem) => void;
  favoriteIds?: Set<string> | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
};

export const FavoritesView = ({
  username = null,
  onSelectPhoto,
  favoriteIds,
  onToggleFavorite,
}: FavoritesViewProps) => {
  const { items, loading, loadingMore, hasMore, error, loadMore, refresh, removeFavoriteLocally } =
    useFavorites(username);

  const handleToggle = (postId: string) => {
    if (onToggleFavorite) {
      onToggleFavorite(postId);
    }
    removeFavoriteLocally(postId);
  };

  if (!username) {
    return (
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center mb-4 text-2xl shadow-xs">
          ❤️
        </div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
          Save Your Favorite Photos
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
          Log in with your Reddit account to bookmark photos and view your personal favorites across devices.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>Favorites</span>
            <span className="text-sm font-normal text-rose-500">❤️</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Saved photos for u/{username}
          </p>
        </div>

        {items.length > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            {items.length} {items.length === 1 ? 'photo' : 'photos'}
          </span>
        )}
      </div>

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
        onToggleFavorite={handleToggle}
        emptyTitle="No favorites saved yet"
        emptySubtitle="Tap the heart icon on any photo in the Timeline or Places view to add it to your personal favorites collection."
      />
    </div>
  );
};
