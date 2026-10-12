import { beforeEach, describe, expect, it } from 'vitest';
import type { GalleryItem } from '../../shared/types.js';
import {
  getGalleryItem,
  getGalleryItems,
  getJobState,
  getTimelinePage,
  getTimelineSummary,
  REDIS_KEYS,
  removeGalleryItem,
  saveGalleryItem,
  setGalleryItemModHidden,
  setJobState,
  type RedisClientContract,
} from './galleryStore.js';

// In-memory mock implementing RedisClientContract for unit testing
const createMockRedis = (): RedisClientContract => {
  const strings = new Map<string, string>();
  const zsets = new Map<string, Map<string, number>>();
  const hashes = new Map<string, Map<string, string>>();

  return {
    async get(key: string): Promise<string | undefined> {
      return strings.get(key);
    },
    async set(key: string, value: string): Promise<string> {
      strings.set(key, value);
      return 'OK';
    },
    async del(...keys: string[]): Promise<void> {
      for (const k of keys) {
        strings.delete(k);
        zsets.delete(k);
        hashes.delete(k);
      }
    },
    async mGet(keys: string[]): Promise<(string | null)[]> {
      return keys.map((k) => strings.get(k) ?? null);
    },
    async zAdd(
      key: string,
      ...members: { member: string; score: number }[]
    ): Promise<number> {
      let zmap = zsets.get(key);
      if (!zmap) {
        zmap = new Map<string, number>();
        zsets.set(key, zmap);
      }
      let added = 0;
      for (const m of members) {
        if (!zmap.has(m.member)) {
          added += 1;
        }
        zmap.set(m.member, m.score);
      }
      return added;
    },
    async zRange(
      key: string,
      start: number | string,
      stop: number | string,
      options?: {
        reverse?: boolean;
        by: 'score' | 'lex' | 'rank';
        limit?: { offset: number; count: number };
      }
    ): Promise<{ member: string; score: number }[]> {
      const zmap = zsets.get(key);
      if (!zmap) {
        return [];
      }
      const sorted = Array.from(zmap.entries()).map(([member, score]) => ({
        member,
        score,
      }));

      // Sort by score
      sorted.sort((a, b) => {
        if (options?.reverse) {
          return b.score - a.score;
        }
        return a.score - b.score;
      });

      const offset = typeof start === 'number' ? start : 0;
      const count =
        typeof stop === 'number' ? stop - offset + 1 : sorted.length;
      return sorted.slice(offset, offset + count);
    },
    async zRem(key: string, members: string[]): Promise<number> {
      const zmap = zsets.get(key);
      if (!zmap) {
        return 0;
      }
      let removed = 0;
      for (const m of members) {
        if (zmap.delete(m)) {
          removed += 1;
        }
      }
      return removed;
    },
    async zCard(key: string): Promise<number> {
      return zsets.get(key)?.size ?? 0;
    },
    async hGet(key: string, field: string): Promise<string | undefined> {
      return hashes.get(key)?.get(field);
    },
    async hSet(
      key: string,
      fieldValues: Record<string, string>
    ): Promise<number> {
      let hmap = hashes.get(key);
      if (!hmap) {
        hmap = new Map<string, string>();
        hashes.set(key, hmap);
      }
      let count = 0;
      for (const [k, v] of Object.entries(fieldValues)) {
        if (!hmap.has(k)) {
          count += 1;
        }
        hmap.set(k, v);
      }
      return count;
    },
    async hIncrBy(key: string, field: string, value: number): Promise<number> {
      let hmap = hashes.get(key);
      if (!hmap) {
        hmap = new Map<string, string>();
        hashes.set(key, hmap);
      }
      const current = Number.parseInt(hmap.get(field) ?? '0', 10);
      const next = (Number.isNaN(current) ? 0 : current) + value;
      hmap.set(field, next.toString());
      return next;
    },
    async hGetAll(key: string): Promise<Record<string, string>> {
      const hmap = hashes.get(key);
      if (!hmap) {
        return {};
      }
      const result: Record<string, string> = {};
      for (const [k, v] of hmap.entries()) {
        result[k] = v;
      }
      return result;
    },
    async hDel(key: string, fields: string[]): Promise<number> {
      const hmap = hashes.get(key);
      if (!hmap) {
        return 0;
      }
      let deleted = 0;
      for (const f of fields) {
        if (hmap.delete(f)) {
          deleted += 1;
        }
      }
      return deleted;
    },
  };
};

const createSampleItem = (override?: Partial<GalleryItem>): GalleryItem => ({
  id: 't3_item1',
  permalink: '/r/science/comments/item1',
  title: 'Sample Science Photo',
  author: 'science_photographer',
  subreddit: 'science',
  createdAt: 1700000000, // 2023-11-14
  media: {
    url: 'https://i.redd.it/sample.jpg',
    width: 1920,
    height: 1080,
  },
  topic: 'science',
  topicSource: 'flair',
  place: {
    raw: 'Geneva, Switzerland',
    country: 'CH',
    region: 'Geneva',
    city: 'Geneva',
    status: 'poster-tagged',
  },
  isModHidden: false,
  isNsfw: false,
  isRemoved: false,
  capturedAt: 1700000010000,
  lastVerifiedAt: 1700000010000,
  ...override,
});

describe('GalleryStore', () => {
  let mockRedis: RedisClientContract;

  beforeEach(() => {
    mockRedis = createMockRedis();
  });

  describe('saveGalleryItem and getGalleryItem', () => {
    it('saves and retrieves an item correctly', async () => {
      const item = createSampleItem();
      await saveGalleryItem(item, mockRedis);

      const retrieved = await getGalleryItem('t3_item1', mockRedis);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('t3_item1');
      expect(retrieved?.title).toBe('Sample Science Photo');
      expect(retrieved?.place?.country).toBe('CH');
    });

    it('indexes item in time and topic sorted sets', async () => {
      const item = createSampleItem();
      await saveGalleryItem(item, mockRedis);

      const timeCount = await mockRedis.zCard(REDIS_KEYS.idxTime());
      const topicCount = await mockRedis.zCard(REDIS_KEYS.idxTopic('science'));
      expect(timeCount).toBe(1);
      expect(topicCount).toBe(1);
    });

    it('indexes item in country, region, and city sorted sets', async () => {
      const item = createSampleItem();
      await saveGalleryItem(item, mockRedis);

      const countryCount = await mockRedis.zCard(REDIS_KEYS.idxCountry('CH'));
      const cityCount = await mockRedis.zCard(
        REDIS_KEYS.idxCity('CH', 'Geneva', 'Geneva')
      );
      expect(countryCount).toBe(1);
      expect(cityCount).toBe(1);
    });

    it('indexes unplaced item when place is missing', async () => {
      const item = createSampleItem({ id: 't3_unplaced1', place: undefined });
      await saveGalleryItem(item, mockRedis);

      const unplacedCount = await mockRedis.zCard(REDIS_KEYS.idxUnplaced());
      expect(unplacedCount).toBe(1);
    });

    it('updates timeline summary counters for year and month', async () => {
      const item = createSampleItem({ createdAt: 1700000000 }); // 2023-11
      await saveGalleryItem(item, mockRedis);

      const summary = await getTimelineSummary(mockRedis);
      expect(summary.totalCount).toBe(1);
      expect(summary.years[0]?.year).toBe(2023);
      expect(summary.years[0]?.months[0]?.month).toBe(11);
    });
  });

  describe('getGalleryItems batch fetching', () => {
    it('fetches multiple items in order', async () => {
      const item1 = createSampleItem({ id: 't3_1', title: 'Post 1' });
      const item2 = createSampleItem({ id: 't3_2', title: 'Post 2' });
      await saveGalleryItem(item1, mockRedis);
      await saveGalleryItem(item2, mockRedis);

      const items = await getGalleryItems(
        ['t3_1', 't3_2', 't3_missing'],
        mockRedis
      );
      expect(items).toHaveLength(2);
      expect(items[0]?.id).toBe('t3_1');
      expect(items[1]?.id).toBe('t3_2');
    });
  });

  describe('removeGalleryItem', () => {
    it('removes item and all associated index entries and counters', async () => {
      const item = createSampleItem();
      await saveGalleryItem(item, mockRedis);

      const removed = await removeGalleryItem('t3_item1', mockRedis);
      expect(removed).toBe(true);

      const retrieved = await getGalleryItem('t3_item1', mockRedis);
      expect(retrieved).toBeNull();

      expect(await mockRedis.zCard(REDIS_KEYS.idxTime())).toBe(0);
      expect(await mockRedis.zCard(REDIS_KEYS.idxTopic('science'))).toBe(0);
      expect(await mockRedis.zCard(REDIS_KEYS.idxCountry('CH'))).toBe(0);

      const summary = await getTimelineSummary(mockRedis);
      expect(summary.totalCount).toBe(0);
    });

    it('returns false when attempting to remove non-existent item', async () => {
      const result = await removeGalleryItem('t3_nonexistent', mockRedis);
      expect(result).toBe(false);
    });
  });

  describe('setGalleryItemModHidden', () => {
    it('updates mod hidden status', async () => {
      const item = createSampleItem();
      await saveGalleryItem(item, mockRedis);

      const updated = await setGalleryItemModHidden(
        't3_item1',
        true,
        mockRedis
      );
      expect(updated).toBe(true);

      const itemAfter = await getGalleryItem('t3_item1', mockRedis);
      expect(itemAfter?.isModHidden).toBe(true);
    });
  });

  describe('getTimelinePage', () => {
    it('returns items ordered newest first with pagination cursor', async () => {
      const item1 = createSampleItem({ id: 't3_1', createdAt: 1000 });
      const item2 = createSampleItem({ id: 't3_2', createdAt: 2000 });
      const item3 = createSampleItem({ id: 't3_3', createdAt: 3000 });

      await saveGalleryItem(item1, mockRedis);
      await saveGalleryItem(item2, mockRedis);
      await saveGalleryItem(item3, mockRedis);

      const page1 = await getTimelinePage({ limit: 2 }, mockRedis);
      expect(page1.items).toHaveLength(2);
      expect(page1.items[0]?.id).toBe('t3_3'); // newest
      expect(page1.items[1]?.id).toBe('t3_2');
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await getTimelinePage(
        { limit: 2, cursor: page1.nextCursor },
        mockRedis
      );
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.id).toBe('t3_1');
      expect(page2.hasMore).toBe(false);
    });

    it('filters out mod hidden and NSFW items from timeline', async () => {
      const normalItem = createSampleItem({ id: 't3_ok', createdAt: 2000 });
      const hiddenItem = createSampleItem({
        id: 't3_hidden',
        createdAt: 3000,
        isModHidden: true,
      });
      const nsfwItem = createSampleItem({
        id: 't3_nsfw',
        createdAt: 4000,
        isNsfw: true,
      });

      await saveGalleryItem(normalItem, mockRedis);
      await saveGalleryItem(hiddenItem, mockRedis);
      await saveGalleryItem(nsfwItem, mockRedis);

      const page = await getTimelinePage({ limit: 10 }, mockRedis);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_ok');
    });

    it('filters timeline by topic', async () => {
      const scienceItem = createSampleItem({ id: 't3_sci', topic: 'science' });
      const artItem = createSampleItem({ id: 't3_art', topic: 'art' });

      await saveGalleryItem(scienceItem, mockRedis);
      await saveGalleryItem(artItem, mockRedis);

      const sciPage = await getTimelinePage({ topic: 'science' }, mockRedis);
      expect(sciPage.items).toHaveLength(1);
      expect(sciPage.items[0]?.id).toBe('t3_sci');

      const artPage = await getTimelinePage({ topic: 'art' }, mockRedis);
      expect(artPage.items).toHaveLength(1);
      expect(artPage.items[0]?.id).toBe('t3_art');
    });
  });

  describe('JobState storage', () => {
    it('sets and retrieves job state values', async () => {
      await setJobState('backfill_cursor', 't3_cursor_123', mockRedis);
      const val = await getJobState('backfill_cursor', mockRedis);
      expect(val).toBe('t3_cursor_123');

      const missing = await getJobState('unknown_job', mockRedis);
      expect(missing).toBeNull();
    });
  });
});
