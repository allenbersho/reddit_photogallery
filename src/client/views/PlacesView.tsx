type PlacesViewProps = {
  onSelectPlace?: (placeType: string, placeKey: string) => void;
};

export const PlacesView = (_props: PlacesViewProps) => {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 pb-24">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Places
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Browse community images by country, region, and science hubs
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl bg-gray-200/80 dark:bg-slate-800/80 p-3 flex flex-col justify-end animate-pulse"
          >
            <div className="h-4 w-20 bg-gray-300 dark:bg-slate-700 rounded mb-1" />
            <div className="h-3 w-12 bg-gray-300 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};
