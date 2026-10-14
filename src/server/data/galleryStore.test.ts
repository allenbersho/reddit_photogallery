import { beforeEach, describe, expect, it } from 'vitest';
import type { GalleryItem } from '../../shared/types.js';
import {
  getGalleryItem,
  getGalleryItems,
  getJobState,
  getPlacesHierarchy,
  getPlacesSummary,
  getTimelinePage,
  getTimelineSummary,
  getTopicCounts,
  getUnplacedCount,
  REDIS_KEYS,
  removeGalleryItem,
  saveGalleryItem,
  searchGallery,
  setGalleryItemModHidden,
  setJobState,
  tokenizeTitle,
  updateGalleryItemLocation,
  type RedisClientContract,
} from './galleryStore.js';
import { createMockRedis } from './mockRedis.js';

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

    it('allows viewing mod hidden items when includeHidden is true', async () => {
      const normalItem = createSampleItem({ id: 't3_ok', createdAt: 2000 });
      const hiddenItem = createSampleItem({
        id: 't3_hidden',
        createdAt: 3000,
        isModHidden: true,
      });

      await saveGalleryItem(normalItem, mockRedis);
      await saveGalleryItem(hiddenItem, mockRedis);

      const page = await getTimelinePage(
        { limit: 10, includeHidden: true },
        mockRedis
      );
      expect(page.items).toHaveLength(2);
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

    it('filters timeline by year and month', async () => {
      // 2023-05-15
      const item2023May = createSampleItem({
        id: 't3_2023_05',
        createdAt: 1684152000,
      });
      // 2024-01-15
      const item2024Jan = createSampleItem({
        id: 't3_2024_01',
        createdAt: 1705320000,
      });
      // 2024-08-15
      const item2024Aug = createSampleItem({
        id: 't3_2024_08',
        createdAt: 1723723200,
      });

      await saveGalleryItem(item2023May, mockRedis);
      await saveGalleryItem(item2024Jan, mockRedis);
      await saveGalleryItem(item2024Aug, mockRedis);

      const year2024 = await getTimelinePage({ year: 2024 }, mockRedis);
      expect(year2024.items).toHaveLength(2);
      expect(year2024.items.map((i) => i.id)).toEqual([
        't3_2024_08',
        't3_2024_01',
      ]);

      const aug2024 = await getTimelinePage(
        { year: 2024, month: 8 },
        mockRedis
      );
      expect(aug2024.items).toHaveLength(1);
      expect(aug2024.items[0]?.id).toBe('t3_2024_08');

      const year2023 = await getTimelinePage({ year: 2023 }, mockRedis);
      expect(year2023.items).toHaveLength(1);
      expect(year2023.items[0]?.id).toBe('t3_2023_05');
    });

    it('returns topic counts across all topics', async () => {
      await saveGalleryItem(
        createSampleItem({ id: 't3_s1', topic: 'science' }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({ id: 't3_s2', topic: 'science' }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({ id: 't3_e1', topic: 'engineering' }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({ id: 't3_a1', topic: 'art' }),
        mockRedis
      );

      const counts = await getTopicCounts(mockRedis);
      expect(counts.science).toBe(2);
      expect(counts.engineering).toBe(1);
      expect(counts.art).toBe(1);
      expect(counts.other).toBe(0);
    });
  });

  describe('searchGallery', () => {
    it('tokenizes title strings correctly ignoring stopwords and short words', () => {
      const tokens = tokenizeTitle('The James Webb Space Telescope in 2024');
      expect(tokens).toContain('james');
      expect(tokens).toContain('webb');
      expect(tokens).toContain('space');
      expect(tokens).toContain('telescope');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('in');
    });

    it('indexes and searches items by title keyword', async () => {
      const jwstItem = createSampleItem({
        id: 't3_jwst',
        title: 'James Webb Space Telescope First Deep Field',
        createdAt: 2000,
      });
      const hubbleItem = createSampleItem({
        id: 't3_hubble',
        title: 'Hubble Space Telescope Ultra Deep Field',
        createdAt: 1000,
      });

      await saveGalleryItem(jwstItem, mockRedis);
      await saveGalleryItem(hubbleItem, mockRedis);

      // Search single word "telescope" -> matches both
      const telescopeRes = await searchGallery(
        { query: 'telescope' },
        mockRedis
      );
      expect(telescopeRes.items).toHaveLength(2);
      expect(telescopeRes.items[0]?.id).toBe('t3_jwst'); // newest first
      expect(telescopeRes.items[1]?.id).toBe('t3_hubble');

      // Search multi-word "james webb" -> matches only jwst
      const jwstRes = await searchGallery(
        { query: 'james webb' },
        mockRedis
      );
      expect(jwstRes.items).toHaveLength(1);
      expect(jwstRes.items[0]?.id).toBe('t3_jwst');

      // Search non-matching term
      const noRes = await searchGallery({ query: 'mars rover' }, mockRedis);
      expect(noRes.items).toHaveLength(0);
    });

    it('cleans up search tokens when item is removed', async () => {
      const item = createSampleItem({
        id: 't3_cern',
        title: 'Large Hadron Collider at CERN',
      });
      await saveGalleryItem(item, mockRedis);

      const beforeRes = await searchGallery({ query: 'hadron' }, mockRedis);
      expect(beforeRes.items).toHaveLength(1);

      await removeGalleryItem('t3_cern', mockRedis);

      const afterRes = await searchGallery({ query: 'hadron' }, mockRedis);
      expect(afterRes.items).toHaveLength(0);
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

  describe('updateGalleryItemLocation', () => {
    it('updates an unplaced item with new location and indexes it in places', async () => {
      const item = createSampleItem({ id: 't3_p1', place: undefined });
      await saveGalleryItem(item, mockRedis);

      const unplacedBefore = await getUnplacedCount(mockRedis);
      expect(unplacedBefore).toBe(1);

      const updated = await updateGalleryItemLocation(
        't3_p1',
        {
          raw: 'Tokyo, Japan',
          country: 'JP',
          region: 'Tokyo',
          city: 'Tokyo',
          latitude: 35.6762,
          longitude: 139.6503,
          status: 'poster-tagged',
        },
        1700005000,
        mockRedis
      );

      expect(updated).not.toBeNull();
      expect(updated?.place?.city).toBe('Tokyo');
      expect(updated?.takenAt).toBe(1700005000);

      const unplacedAfter = await getUnplacedCount(mockRedis);
      expect(unplacedAfter).toBe(0);

      const countryCount = await mockRedis.zCard(REDIS_KEYS.idxCountry('JP'));
      const cityCount = await mockRedis.zCard(
        REDIS_KEYS.idxCity('JP', 'Tokyo', 'Tokyo')
      );
      expect(countryCount).toBe(1);
      expect(cityCount).toBe(1);
    });

    it('moves an item from one place to another updating counts and indexes', async () => {
      const item = createSampleItem({
        id: 't3_p2',
        place: {
          raw: 'Geneva, Switzerland',
          country: 'CH',
          region: 'Geneva',
          city: 'Geneva',
          status: 'poster-tagged',
        },
      });
      await saveGalleryItem(item, mockRedis);

      const chCountBefore = await mockRedis.zCard(REDIS_KEYS.idxCountry('CH'));
      expect(chCountBefore).toBe(1);

      await updateGalleryItemLocation(
        't3_p2',
        {
          raw: 'Paris, France',
          country: 'FR',
          region: 'Ile-de-France',
          city: 'Paris',
          status: 'mod-verified',
        },
        undefined,
        mockRedis
      );

      const chCountAfter = await mockRedis.zCard(REDIS_KEYS.idxCountry('CH'));
      const frCountAfter = await mockRedis.zCard(REDIS_KEYS.idxCountry('FR'));
      expect(chCountAfter).toBe(0);
      expect(frCountAfter).toBe(1);
    });

    it('returns null when updating non-existent item', async () => {
      const result = await updateGalleryItemLocation(
        't3_nonexistent',
        undefined,
        undefined,
        mockRedis
      );
      expect(result).toBeNull();
    });
  });

  describe('Places Hierarchy and Summary', () => {
    it('generates nested hierarchy of country > region > city with counts and covers', async () => {
      const item1 = createSampleItem({
        id: 't3_t1',
        place: {
          raw: 'Tokyo, Japan',
          country: 'JP',
          region: 'Tokyo',
          city: 'Tokyo',
          status: 'poster-tagged',
        },
      });
      const item2 = createSampleItem({
        id: 't3_t2',
        place: {
          raw: 'Osaka, Japan',
          country: 'JP',
          region: 'Osaka',
          city: 'Osaka',
          status: 'poster-tagged',
        },
      });
      const item3 = createSampleItem({
        id: 't3_unp',
        place: undefined,
      });

      await saveGalleryItem(item1, mockRedis);
      await saveGalleryItem(item2, mockRedis);
      await saveGalleryItem(item3, mockRedis);

      const directHierarchy = await getPlacesHierarchy(mockRedis);
      expect(directHierarchy).toHaveLength(1);

      const summary = await getPlacesSummary(mockRedis);
      expect(summary.unplacedCount).toBe(1);
      expect(summary.hierarchy).toHaveLength(1);

      const japan = summary.hierarchy[0];
      expect(japan?.name).toBe('Japan');
      expect(japan?.count).toBe(2);
      expect(japan?.children).toHaveLength(2); // Tokyo and Osaka regions
    });
  });
});
