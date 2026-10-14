import type { YearSummary } from '../../shared/types.js';
import { getMonthAbbr } from '../utils/date.js';

type TimelineScrubberProps = {
  years: YearSummary[];
  selectedYear?: number | undefined;
  selectedMonth?: number | undefined;
  onSelectTime: (year?: number | undefined, month?: number | undefined) => void;
};

export const TimelineScrubber = ({
  years,
  selectedYear,
  selectedMonth,
  onSelectTime,
}: TimelineScrubberProps) => {
  if (years.length === 0) {
    return null;
  }

  // Find currently selected year's months if any
  const currentYearData = selectedYear !== undefined ? years.find((y) => y.year === selectedYear) : undefined;

  return (
    <div className="w-full flex flex-col gap-2 mb-4">
      {/* Years bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
        <button
          type="button"
          onClick={() => onSelectTime(undefined, undefined)}
          className={`shrink-0 px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
            selectedYear === undefined
              ? 'bg-reddit-orange text-white shadow-xs font-semibold'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
          }`}
        >
          All Time
        </button>

        {years.map((y) => {
          const isSelected = selectedYear === y.year && selectedMonth === undefined;
          const isYearActive = selectedYear === y.year;

          return (
            <button
              key={y.year}
              type="button"
              onClick={() => onSelectTime(y.year, undefined)}
              className={`shrink-0 px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-reddit-orange text-white shadow-xs font-semibold'
                  : isYearActive
                    ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{y.year}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected
                    ? 'bg-white/25 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {y.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Months bar if a year is selected */}
      {currentYearData && currentYearData.months.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pl-2 text-xs border-l-2 border-orange-400/40">
          <button
            type="button"
            onClick={() => onSelectTime(selectedYear, undefined)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              selectedMonth === undefined
                ? 'bg-slate-700 text-white font-semibold'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            All {selectedYear}
          </button>

          {currentYearData.months.map((m) => {
            const isMonthSelected = selectedMonth === m.month;
            return (
              <button
                key={m.month}
                type="button"
                onClick={() => onSelectTime(selectedYear, m.month)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  isMonthSelected
                    ? 'bg-reddit-orange text-white font-semibold shadow-xs'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{getMonthAbbr(m.month)}</span>
                <span className="text-[9px] opacity-75">({m.count})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
