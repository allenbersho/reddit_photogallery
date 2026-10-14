import { useState, type FormEvent } from 'react';

type SearchViewProps = {
  initialQuery?: string;
  onSearch?: (query: string) => void;
};

export const SearchView = ({ initialQuery = '', onSearch }: SearchViewProps) => {
  const [searchTerm, setSearchTerm] = useState(initialQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchTerm);
    }
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 pb-24">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative flex items-center">
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by keywords (e.g. telescope, nebula, cern)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff4500] transition-all"
          />
        </div>
      </form>

      <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-xs">
        Enter a keyword above to search through titles and subjects.
      </div>
    </div>
  );
};
