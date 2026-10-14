import type { Topic } from '../../shared/types.js';
import type { ThemeMode, TopicFilter } from '../types.js';

type NavbarProps = {
  subredditName?: string | undefined;
  selectedTopic: TopicFilter;
  onSelectTopic: (topic: TopicFilter) => void;
  topicCounts?: Record<Topic, number> | undefined;
  theme: ThemeMode;
  onToggleTheme: () => void;
  totalPhotos?: number | undefined;
};

const TOPICS: Array<{ key: TopicFilter; label: string; icon: string }> = [
  { key: 'all', label: 'All Photos', icon: '✨' },
  { key: 'science', label: 'Science', icon: '🔬' },
  { key: 'engineering', label: 'Engineering', icon: '⚙️' },
  { key: 'art', label: 'Art', icon: '🎨' },
];

export const Navbar = ({
  subredditName = 'Community',
  selectedTopic,
  onSelectTopic,
  topicCounts,
  theme,
  onToggleTheme,
  totalPhotos,
}: NavbarProps) => {
  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 pt-3 pb-2.5">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#ff4500] to-[#ff8700] flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate tracking-tight flex items-center gap-1.5">
                r/{subredditName}
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                  Gallery
                </span>
              </h1>
              {totalPhotos !== undefined && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {totalPhotos.toLocaleString()} community photos
                </p>
              )}
            </div>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-slate-800/80 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>

        {/* Topic Filter Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {TOPICS.map((topic) => {
            const isSelected = selectedTopic === topic.key;
            let count: number | undefined;
            if (topicCounts) {
              if (topic.key === 'science') count = topicCounts.science;
              if (topic.key === 'engineering') count = topicCounts.engineering;
              if (topic.key === 'art') count = topicCounts.art;
              if (topic.key === 'all' && totalPhotos !== undefined) count = totalPhotos;
            }

            return (
              <button
                key={topic.key}
                type="button"
                onClick={() => onSelectTopic(topic.key)}
                aria-pressed={isSelected}
                aria-label={`Filter by ${topic.label}`}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-[#ff4500] text-white shadow-sm font-semibold'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{topic.icon}</span>
                <span>{topic.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-black/20 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
