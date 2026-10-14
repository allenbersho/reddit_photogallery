import { useMemo, useState, type FormEvent } from 'react';
import type { GalleryItem } from '../../shared/types.js';
import { PhotoGrid } from '../components/PhotoGrid.js';
import { useSearch } from '../hooks/useSearch.js';
import type { TopicFilter } from '../types.js';

type SearchViewProps = {
  onSelectPhoto: (item: GalleryItem) => void;
  favoriteIds?: Set<string> | undefined;
  onToggleFavorite?: ((postId: string) => void) | undefined;
};

const SUGGESTED_TAGS: readonly string[] = [
  'telescope',
  'galaxy',
  'mars',
  'quantum',
  'robot',
  'circuit',
  'sculpture',
  'painting',
  'cern',
];

const SEARCH_TOPICS: readonly { id: TopicFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'science', label: 'Science' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'art', label: 'Art' },
];

export const SearchView = ({
  onSelectPhoto,
  favoriteIds,
  onToggleFavorite,
}: SearchViewProps) => {
  const [query, setQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicFilter>('all');

  const { items, loading, loadingMore, hasMore, totalCount, error, loadMore } = useSearch({
    query,
  });

  const filteredItems = useMemo(() => {
    if (selectedTopic === 'all') return items;
    return items.filter((item) => item.topic === selectedTopic);
  }, [items, selectedTopic]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  const handleClear = () => {
    setQuery('');
  };

  const handleSuggestionClick = (tag: string) => {
    setQuery(tag);
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 pb-24 animate-fade-in">
      {/* Search Header and Bar */}
      <div className="mb-4">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <svg
            className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles & keywords (e.g. telescope, robot, painting)..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff4500] transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer text-xs"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </form>

        {/* Topic filter pills for search results */}
        {query.trim().length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
            {SEARCH_TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTopic(t.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  selectedTopic === t.id
                    ? 'bg-reddit-orange text-white shadow-xs font-semibold'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}

            <span className="ml-auto text-xs text-gray-400 shrink-0">
              {totalCount} {totalCount === 1 ? 'match' : 'matches'}
            </span>
          </div>
        )}
      </div>

      {/* Suggested keywords when search is empty */}
      {query.trim().length === 0 ? (
        <div className="py-8 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-reddit-orange mx-auto flex items-center justify-center text-xl mb-3">
            🔍
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
            Search Community Gallery
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Search across post titles, research themes, and artistic topics.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleSuggestionClick(tag)}
                className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-gray-700 dark:text-gray-300 hover:text-reddit-orange text-xs transition-colors cursor-pointer"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <PhotoGrid
          items={filteredItems}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          error={error}
          onLoadMore={loadMore}
          onSelectPhoto={onSelectPhoto}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          emptyTitle={`No photos matching "${query}"`}
          emptySubtitle="Try searching for another keyword or removing the topic filter."
        />
      )}
    </div>
  );
};
