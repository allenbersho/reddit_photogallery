import { beforeAll, describe, expect, it } from 'vitest';
import {
  CHIMERA_DISCIPLINES,
  CHIMERA_IMPACTS,
  type Discipline,
  type Impact,
} from '../../shared/taxonomy.js';
import type { GalleryItem, Topic } from '../../shared/types.js';
import {
  getPlacesHierarchy,
  getPlacesSummary,
  getTimelinePage,
  getTimelineSummary,
  getTopicCounts,
  removeGalleryItem,
  saveGalleryItem,
  searchGallery,
} from './galleryStore.js';
import { createMockRedis } from './mockRedis.js';

describe('Performance benchmark with 5,000 synthetic gallery items', () => {
  const redis = createMockRedis();
  const TOTAL_ITEMS = 5000;

  const TOPICS: readonly Topic[] = ['science', 'engineering', 'art', 'other'];
  const PLACES = [
    { country: 'US', region: 'CA', city: 'San Francisco' },
    { country: 'US', region: 'NY', city: 'New York' },
    { country: 'CH', region: 'GE', city: 'Geneva' },
    { country: 'JP', region: '13', city: 'Tokyo' },
    { country: 'GB', region: 'ENG', city: 'London' },
    { country: 'FR', region: 'IDF', city: 'Paris' },
    undefined, // unplaced
  ] as const;

  const KEYWORDS = [
    'telescope',
    'quantum',
    'robotics',
    'sculpture',
    'galaxy',
    'particle',
    'circuit',
    'painting',
    'cern',
    'nebula',
  ];

  beforeAll(async () => {
    // Ingest 5,000 synthetic items distributed across 2023-2026
    const baseTime = 1672531200; // Jan 1, 2023 00:00:00 UTC
    const items: GalleryItem[] = [];

    for (let i = 0; i < TOTAL_ITEMS; i++) {
      const topicIndex = i % TOPICS.length;
      const topic = TOPICS[topicIndex] ?? 'other';
      const placeConfig = PLACES[i % PLACES.length];
      const keyword1 = KEYWORDS[i % KEYWORDS.length] ?? 'item';
      const keyword2 = KEYWORDS[(i + 3) % KEYWORDS.length] ?? 'study';

      const dIndex = i % (CHIMERA_DISCIPLINES.length + 1);
      const disc =
        dIndex < CHIMERA_DISCIPLINES.length
          ? CHIMERA_DISCIPLINES[dIndex]
          : undefined;
      const disciplines: Discipline[] = disc ? [disc] : [];

      const iIndex = i % (CHIMERA_IMPACTS.length + 1);
      const imp =
        iIndex < CHIMERA_IMPACTS.length ? CHIMERA_IMPACTS[iIndex] : undefined;
      const impacts: Impact[] = imp ? [imp] : [];

      const isCrosspost = i % 7 === 0;


      // Timestamps increment by 30 minutes for each item over ~100 days to span years/months
      const createdAt = baseTime + i * 1800;

      const item: GalleryItem = {
        id: `t3_perf_${i}`,
        permalink: `/r/${topic}/comments/perf_${i}`,
        title: `Synthetic ${topic} capture ${keyword1} and ${keyword2} observation #${i}`,
        author: `researcher_${i % 50}`,
        subreddit: topic,
        createdAt,
        media: {
          url: `https://i.redd.it/perf_${i}.jpg`,
          previewUrl: `https://preview.redd.it/perf_${i}.jpg`,
          width: 1920,
          height: 1080,
        },
        disciplines,
        disciplinesSource: disciplines.length > 0 ? 'poster-tagged' : 'untagged',
        impacts,
        impactsSource: impacts.length > 0 ? 'poster-tagged' : 'untagged',
        isCrosspost,
        crosspostParentId: isCrosspost ? `t3_parent_${i}` : undefined,
        originalSubreddit: isCrosspost ? 'original_research' : undefined,
        originalAuthor: isCrosspost ? `orig_author_${i}` : undefined,
        topic,
        topicSource: 'flair',
        place: placeConfig
          ? {
              raw: `${placeConfig.city}, ${placeConfig.country}`,
              country: placeConfig.country,
              region: placeConfig.region,
              city: placeConfig.city,
              status: 'poster-tagged',
            }
          : undefined,
        isModHidden: false,
        isNsfw: false,
        isRemoved: false,
        capturedAt: createdAt * 1000,
        lastVerifiedAt: createdAt * 1000,
      };

      items.push(item);
    }

    // Ingest sequentially or in batches
    for (const item of items) {
      await saveGalleryItem(item, redis);
    }
  }, 30000); // 30s timeout for bulk setup

  it('verifies 5,000 items are indexed and timeline summary aggregates efficiently', async () => {
    const start = performance.now();
    const summary = await getTimelineSummary(redis);
    const duration = performance.now() - start;

    expect(summary.totalCount).toBe(TOTAL_ITEMS);
    expect(summary.years.length).toBeGreaterThan(0);
    // Bench: summary lookup should complete well under 100ms
    expect(duration).toBeLessThan(100);
  });

  it('paginates through the first page in under 30ms', async () => {
    const start = performance.now();
    const page1 = await getTimelinePage({ limit: 30 }, redis);
    const duration = performance.now() - start;

    expect(page1.items).toHaveLength(30);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();
    expect(page1.totalCount).toBe(TOTAL_ITEMS);
    expect(duration).toBeLessThan(30);
  });

  it('chains cursor pagination over 10 consecutive pages with 0 duplicate items', async () => {
    const seenIds = new Set<string>();
    let cursor: string | undefined = undefined;

    const start = performance.now();
    for (let page = 0; page < 10; page++) {
      const pageResult = await getTimelinePage({ limit: 50, cursor }, redis);
      expect(pageResult.items.length).toBe(50);

      for (const item of pageResult.items) {
        expect(seenIds.has(item.id)).toBe(false);
        seenIds.add(item.id);
      }

      cursor = pageResult.nextCursor;
      expect(cursor).toBeDefined();
    }
    const duration = performance.now() - start;

    expect(seenIds.size).toBe(500);
    // 10 pages of 50 items = 500 items loaded in under 200ms
    expect(duration).toBeLessThan(200);
  });

  it('filters by topic efficiently across the 5,000 item dataset', async () => {
    const start = performance.now();
    const sciencePage = await getTimelinePage({ limit: 40, topic: 'science' }, redis);
    const duration = performance.now() - start;

    expect(sciencePage.items.length).toBe(40);
    for (const item of sciencePage.items) {
      expect(item.topic).toBe('science');
    }
    expect(sciencePage.totalCount).toBe(Math.floor(TOTAL_ITEMS / 4));
    expect(duration).toBeLessThan(30);

    const counts = await getTopicCounts(redis);
    expect(counts.science + counts.engineering + counts.art + counts.other).toBe(TOTAL_ITEMS);
  });

  it('executes place hierarchy rollup and place-filtered queries under 50ms', async () => {
    const start = performance.now();
    const summary = await getPlacesSummary(redis);
    const hierarchy = await getPlacesHierarchy(redis);
    const duration = performance.now() - start;

    expect(summary.hierarchy.length).toBeGreaterThanOrEqual(4);
    expect(summary.unplacedCount).toBeGreaterThan(0);
    expect(hierarchy.length).toBe(summary.hierarchy.length);
    expect(duration).toBeLessThan(50);

    // Query items for a specific country
    const countryPage = await getTimelinePage(
      { placeType: 'country', placeKey: 'US', limit: 25 },
      redis
    );
    expect(countryPage.items.length).toBe(25);
    for (const item of countryPage.items) {
      expect(item.place?.country).toBe('US');
    }
  });

  it('performs title search with single and multi-token intersections across 5,000 items in under 40ms', async () => {
    // Single token search: 'telescope'
    const startSingle = performance.now();
    const singleResult = await searchGallery({ query: 'telescope', limit: 25 }, redis);
    const singleDuration = performance.now() - startSingle;

    expect(singleResult.items.length).toBeGreaterThan(0);
    expect(singleResult.items.length).toBeLessThanOrEqual(25);
    for (const item of singleResult.items) {
      expect(item.title.toLowerCase()).toContain('telescope');
    }
    expect(singleDuration).toBeLessThan(40);

    // Multi-token search intersection: 'telescope' AND 'cern'
    const startMulti = performance.now();
    const multiResult = await searchGallery({ query: 'telescope cern', limit: 25 }, redis);
    const multiDuration = performance.now() - startMulti;

    expect(multiDuration).toBeLessThan(40);
    for (const item of multiResult.items) {
      const lower = item.title.toLowerCase();
      expect(lower).toContain('telescope');
      expect(lower).toContain('cern');
    }
  });

  it('cleans up indices cleanly when deleting items from a 5,000 item store', async () => {
    const targetId = 't3_perf_42';
    const deleted = await removeGalleryItem(targetId, redis);
    expect(deleted).toBe(true);

    const checkPage = await getTimelinePage({ limit: 1 }, redis);
    expect(checkPage.totalCount).toBe(TOTAL_ITEMS - 1);

    // Double delete returns false
    const deletedAgain = await removeGalleryItem(targetId, redis);
    expect(deletedAgain).toBe(false);
  });

  it('filters by Chimera single discipline and multi-discipline OR under 35ms', async () => {
    // Single discipline
    const startSingle = performance.now();
    const biologyPage = await getTimelinePage(
      { disciplines: ['Biology'], limit: 30 },
      redis
    );
    const singleDuration = performance.now() - startSingle;

    expect(biologyPage.items.length).toBeGreaterThan(0);
    expect(biologyPage.items.length).toBeLessThanOrEqual(30);
    for (const item of biologyPage.items) {
      expect(item.disciplines).toContain('Biology');
    }
    expect(singleDuration).toBeLessThan(35);

    // Multi-discipline OR: Biology OR Arts
    const startMulti = performance.now();
    const multiPage = await getTimelinePage(
      { disciplines: ['Biology', 'Arts'], limit: 30 },
      redis
    );
    const multiDuration = performance.now() - startMulti;

    expect(multiPage.items.length).toBeGreaterThan(0);
    for (const item of multiPage.items) {
      const match =
        item.disciplines.includes('Biology') || item.disciplines.includes('Arts');
      expect(match).toBe(true);
    }
    expect(multiDuration).toBeLessThan(40);
  });

  it('filters by Chimera cross-group (Disciplines AND Impacts) under 50ms', async () => {
    const start = performance.now();
    const crossPage = await getTimelinePage(
      {
        disciplines: ['Biology', 'Mechanics'],
        impacts: ['Home'],
        limit: 25,
      },
      redis
    );
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
    for (const item of crossPage.items) {
      const discMatch =
        item.disciplines.includes('Biology') ||
        item.disciplines.includes('Mechanics');
      expect(discMatch).toBe(true);
      expect(item.impacts).toContain('Home');
    }
  });

  it('queries Chimera untagged items under 35ms', async () => {
    const start = performance.now();
    const untaggedPage = await getTimelinePage(
      { disciplines: ['untagged'], limit: 25 },
      redis
    );
    const duration = performance.now() - start;

    expect(untaggedPage.items.length).toBeGreaterThan(0);
    for (const item of untaggedPage.items) {
      expect(item.disciplines.length).toBe(0);
    }
    expect(duration).toBeLessThan(35);
  });
});

