import { describe, expect, it } from 'vitest';
import type { GalleryItem } from '../../shared/types.js';
import {
  formatDayHeader,
  formatEpochDate,
  getMonthAbbr,
  getMonthName,
  groupItemsByDay,
} from './date.js';

describe('client date utils', () => {
  it('formats month names and abbreviations correctly', () => {
    expect(getMonthName(1)).toBe('January');
    expect(getMonthName(10)).toBe('October');
    expect(getMonthName(12)).toBe('December');
    expect(getMonthName(99)).toBe('Month 99');

    expect(getMonthAbbr(1)).toBe('Jan');
    expect(getMonthAbbr(10)).toBe('Oct');
    expect(getMonthAbbr(12)).toBe('Dec');
    expect(getMonthAbbr(99)).toBe('M99');
  });

  it('formats epoch dates correctly', () => {
    // 1700000000 = Nov 14, 2023 UTC
    const formatted = formatEpochDate(1700000000);
    expect(formatted).toContain('2023');
    expect(formatted).toContain('Nov');
  });

  it('formats day headers with weekday, month, day, year', () => {
    const header = formatDayHeader(1700000000);
    expect(header).toContain('2023');
    expect(header).toContain('November');
  });

  it('groups gallery items by day', () => {
    const item1: GalleryItem = {
      id: 't3_1',
      permalink: '/r/science/1',
      title: 'First item',
      author: 'alice',
      subreddit: 'science',
      createdAt: 1700000000,
      media: { url: 'https://i.redd.it/1.jpg', width: 800, height: 600 },
      disciplines: ['Biology'],
      disciplinesSource: 'poster-tagged',
      impacts: ['Home'],
      impactsSource: 'poster-tagged',
      isCrosspost: false,
      topic: 'science',
      topicSource: 'default',
      isModHidden: false,
      isNsfw: false,
      isRemoved: false,
      capturedAt: 1700000000000,
      lastVerifiedAt: 1700000000000,
    };

    const item2: GalleryItem = {
      ...item1,
      id: 't3_2',
      title: 'Second item same day',
      createdAt: 1700001000,
    };

    const item3: GalleryItem = {
      ...item1,
      id: 't3_3',
      title: 'Third item different day',
      createdAt: 1700500000,
    };

    const groups = groupItemsByDay([item1, item2, item3]);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups[0]?.items).toHaveLength(2);
    expect(groups[1]?.items).toHaveLength(1);
  });
});
