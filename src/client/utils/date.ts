import type { GalleryItem } from '../../shared/types.js';

const MONTH_NAMES: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_ABBRS: readonly string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAY_NAMES: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const getMonthName = (monthNumber: number): string => {
  const name = MONTH_NAMES[monthNumber - 1];
  return name !== undefined ? name : `Month ${monthNumber}`;
};

export const getMonthAbbr = (monthNumber: number): string => {
  const abbr = MONTH_ABBRS[monthNumber - 1];
  return abbr !== undefined ? abbr : `M${monthNumber}`;
};

export const formatEpochDate = (seconds: number): string => {
  const d = new Date(seconds * 1000);
  return `${getMonthAbbr(d.getMonth() + 1)} ${d.getDate()}, ${d.getFullYear()}`;
};

export const formatDayHeader = (seconds: number): string => {
  const d = new Date(seconds * 1000);
  const weekday = WEEKDAY_NAMES[d.getDay()] ?? '';
  return `${weekday}, ${getMonthName(d.getMonth() + 1)} ${d.getDate()}, ${d.getFullYear()}`;
};

export type DayGroup = {
  dateKey: string;
  label: string;
  items: GalleryItem[];
};

export const groupItemsByDay = (items: GalleryItem[]): DayGroup[] => {
  const groupsMap = new Map<string, DayGroup>();

  for (const item of items) {
    const timestamp = item.takenAt !== undefined ? item.takenAt : item.createdAt;
    const d = new Date(timestamp * 1000);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let group = groupsMap.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        label: formatDayHeader(timestamp),
        items: [],
      };
      groupsMap.set(dateKey, group);
    }
    group.items.push(item);
  }

  return Array.from(groupsMap.values());
};
