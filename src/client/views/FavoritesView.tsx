type FavoritesViewProps = {
  username?: string | null;
};

export const FavoritesView = ({ username }: FavoritesViewProps) => {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 pb-24">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span>Favorites</span>
          <span className="text-sm font-normal text-rose-500">❤️</span>
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {username ? `Saved photos for ${username}` : 'Your bookmarked community photos'}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400">
        <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-3 text-xl">
          ❤️
        </div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          No favorites yet
        </p>
        <p className="text-xs mt-1 max-w-xs text-gray-500">
          Tap the heart on any photo to save it to your personal favorites collection.
        </p>
      </div>
    </div>
  );
};
