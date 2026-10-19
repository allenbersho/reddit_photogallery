import { useState } from 'react';
import {
  CHIMERA_DISCIPLINES,
  CHIMERA_IMPACTS,
  DISCIPLINE_COLORS,
  IMPACT_COLORS,
  type Discipline,
  type DisciplineFilter,
  type Impact,
  type ImpactFilter,
  type TaxonomySummary,
} from '../../shared/index.js';
import type { ThemeMode } from '../types.js';

type NavbarProps = {
  subredditName?: string | undefined;
  selectedDisciplines: DisciplineFilter[];
  onToggleDiscipline: (discipline: DisciplineFilter | 'all') => void;
  selectedImpacts: ImpactFilter[];
  onToggleImpact: (impact: ImpactFilter | 'all') => void;
  taxonomySummary?: TaxonomySummary | null | undefined;
  theme: ThemeMode;
  onToggleTheme: () => void;
  totalPhotos?: number | undefined;
  onResetFilters?: (() => void) | undefined;
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

export const Navbar = ({
  subredditName = 'Community',
  selectedDisciplines,
  onToggleDiscipline,
  selectedImpacts,
  onToggleImpact,
  taxonomySummary,
  theme,
  onToggleTheme,
  totalPhotos,
  onResetFilters,
}: NavbarProps) => {
  const [showImpacts, setShowImpacts] = useState(true);

  const hasActiveFilters =
    selectedDisciplines.length > 0 || selectedImpacts.length > 0;

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-gray-200/60 dark:border-slate-800 transition-colors duration-200 backdrop-blur-md bg-white/85 dark:bg-slate-900/85">
      <div className="max-w-5xl mx-auto px-4 pt-3 pb-2.5 flex flex-col gap-2">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3">
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
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-400">
                  Gallery v2
                </span>
              </h1>
              {totalPhotos !== undefined && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {totalPhotos.toLocaleString()} photos • Chimera University taxonomy
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilters && onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors cursor-pointer"
              >
                Reset filters
              </button>
            )}

            {/* Toggle Impact Row Visibility */}
            <button
              type="button"
              onClick={() => setShowImpacts((v) => !v)}
              aria-label={showImpacts ? 'Collapse Impact filters' : 'Expand Impact filters'}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Impacts</span>
              <span className="text-[10px]">{showImpacts ? '▴' : '▾'}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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
        </div>

        {/* Filter Row 1: Disciplines */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-0.5 select-none shrink-0">
            Discipline
          </span>

          {/* All Disciplines Pill */}
          <button
            type="button"
            onClick={() => onToggleDiscipline('all')}
            aria-pressed={selectedDisciplines.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1 min-h-[32px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 ${
              selectedDisciplines.length === 0
                ? 'bg-orange-600 text-white shadow-xs font-semibold'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>✨</span>
            <span>All</span>
          </button>

          {/* 6 Chimera Disciplines */}
          {CHIMERA_DISCIPLINES.map((disc) => {
            const isSelected = selectedDisciplines.includes(disc);
            const count = taxonomySummary?.disciplines?.[disc];
            const colors = DISCIPLINE_COLORS[disc];

            return (
              <button
                key={disc}
                type="button"
                onClick={() => onToggleDiscipline(disc)}
                aria-pressed={isSelected}
                style={
                  isSelected
                    ? {
                        backgroundColor: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      }
                    : undefined
                }
                className={`flex items-center gap-1.5 px-3 py-1 min-h-[32px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'border-current font-bold shadow-xs scale-102'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{DISCIPLINE_ICONS[disc]}</span>
                <span>{disc}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-black/15 text-current'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}

          {/* Untagged Discipline Pill */}
          {(() => {
            const isSelected = selectedDisciplines.includes('untagged');
            const count = taxonomySummary?.untagged?.disciplines;
            return (
              <button
                type="button"
                onClick={() => onToggleDiscipline('untagged')}
                aria-pressed={isSelected}
                className={`flex items-center gap-1.5 px-3 py-1 min-h-[32px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900 border-transparent font-bold shadow-xs'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>🏷️</span>
                <span>Untagged</span>
                {count !== undefined && count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })()}
        </div>

        {/* Filter Row 2: Impacts (Expandable/Collapsible) */}
        {showImpacts && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 border-t border-gray-100 dark:border-slate-800/60 pt-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-0.5 select-none shrink-0">
              Impact
            </span>

            {/* All Impacts Pill */}
            <button
              type="button"
              onClick={() => onToggleImpact('all')}
              aria-pressed={selectedImpacts.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1 min-h-[30px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 ${
                selectedImpacts.length === 0
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>🌐</span>
              <span>All</span>
            </button>

            {/* 4 Chimera Impacts */}
            {CHIMERA_IMPACTS.map((imp) => {
              const isSelected = selectedImpacts.includes(imp);
              const count = taxonomySummary?.impacts?.[imp];
              const colors = IMPACT_COLORS[imp];

              return (
                <button
                  key={imp}
                  type="button"
                  onClick={() => onToggleImpact(imp)}
                  aria-pressed={isSelected}
                  style={
                    isSelected
                      ? {
                          backgroundColor: colors.bg,
                          color: colors.text,
                          borderColor: colors.border,
                        }
                      : undefined
                  }
                  className={`flex items-center gap-1.5 px-3 py-1 min-h-[30px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'border-current font-bold shadow-xs scale-102'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{IMPACT_ICONS[imp]}</span>
                  <span>{imp}</span>
                  {count !== undefined && count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-black/15 text-current'
                          : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {count.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Untagged Impact Pill */}
            {(() => {
              const isSelected = selectedImpacts.includes('untagged');
              const count = taxonomySummary?.untagged?.impacts;
              return (
                <button
                  type="button"
                  onClick={() => onToggleImpact('untagged')}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-1.5 px-3 py-1 min-h-[30px] rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900 border-transparent font-bold shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-transparent hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>🏷️</span>
                  <span>Untagged</span>
                  {count !== undefined && count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20">
                      {count.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })()}
          </div>
        )}
      </div>
    </header>
  );
};
