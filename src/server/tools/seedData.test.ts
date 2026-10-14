import { describe, expect, it } from 'vitest';
import { createMockRedis } from '../data/mockRedis.js';
import { getPlacesHierarchy, getTimelinePage, getTimelineSummary } from '../data/galleryStore.js';
import { SAMPLE_POSTS, seedGalleryStore } from './seedData.js';

describe('seedData tool', () => {
  it('seeds sample gallery items and populates timeline, places, and topics', async () => {
    const redis = createMockRedis();

    const seededCount = await seedGalleryStore(redis, SAMPLE_POSTS);
    expect(seededCount).toBe(SAMPLE_POSTS.length);

    // Verify timeline page contains seeded items
    const page = await getTimelinePage({ limit: 10 }, redis);
    expect(page.items.length).toBe(10);
    expect(page.totalCount).toBe(SAMPLE_POSTS.length);

    // Verify timeline summary aggregates correctly
    const summary = await getTimelineSummary(redis);
    expect(summary.totalCount).toBe(SAMPLE_POSTS.length);
    expect(summary.topics?.science).toBe(5);
    expect(summary.topics?.engineering).toBe(5);
    expect(summary.topics?.art).toBe(5);

    // Verify places hierarchy includes seeded countries
    const hierarchy = await getPlacesHierarchy(redis);
    const countryCodes = hierarchy.map((c) => c.key);
    expect(countryCodes).toContain('ch');
    expect(countryCodes).toContain('us');
    expect(countryCodes).toContain('jp');
    expect(countryCodes).toContain('gb');
    expect(countryCodes).toContain('fr');
  });
});
