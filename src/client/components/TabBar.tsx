import type { ReactNode } from 'react';
import type { TabType } from '../types.js';

type TabBarProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  favoritesCount?: number | undefined;
};

const TABS: Array<{
  id: TabType;
  label: string;
  icon: (active: boolean) => ReactNode;
}> = [
  {
    id: 'timeline',
    label: 'Photos',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 1.5 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    id: 'places',
    label: 'Places',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 1.5 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    id: 'favorites',
    label: 'Favorites',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 1.5 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Search',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 2.5 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
];

export const TabBar = ({
  activeTab,
  onTabChange,
  favoritesCount,
}: TabBarProps) => {
  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 glass-panel border-t transition-colors duration-200"
    >
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5 safe-area-pb">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-150 relative cursor-pointer ${
                isActive
                  ? 'text-[#ff4500] font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <div className="relative">
                {tab.icon(isActive)}
                {tab.id === 'favorites' &&
                  favoritesCount !== undefined &&
                  favoritesCount > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#ff4500] text-white text-[10px] font-bold flex items-center justify-center">
                      {favoritesCount > 99 ? '99+' : favoritesCount}
                    </span>
                  )}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 w-6 h-0.5 rounded-full bg-[#ff4500]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
