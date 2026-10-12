import { beforeEach, describe, expect, it } from 'vitest';
import type { RedditPostLike } from '../core/postCapture.js';
import {
  getGalleryItem,
  getJobState,
  saveGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';
import { runBackfillJob, type RedditClientForBackfill } from './backfill.js';
import { runReconcileJob, type RedditClientForReconcile } from './reconcile.js';

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
      for (const m of members) {
        zmap.set(m.member, m.score);
      }
      return members.length;
    },
    async zRange(
      key: string,
      start: number | string,
      stop: number | string
    ): Promise<{ member: string; score: number }[]> {
      const zmap = zsets.get(key);
      if (!zmap) return [];
      const sorted = Array.from(zmap.entries())
        .map(([member, score]) => ({ member, score }))
        .sort((a, b) => b.score - a.score);
      const offset = typeof start === 'number' ? start : 0;
      const count =
        typeof stop === 'number' ? stop - offset + 1 : sorted.length;
      return sorted.slice(offset, offset + count);
    },
    async zRem(key: string, members: string[]): Promise<number> {
      const zmap = zsets.get(key);
      if (!zmap) return 0;
      let count = 0;
      for (const m of members) {
        if (zmap.delete(m)) count++;
      }
      return count;
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
      for (const [k, v] of Object.entries(fieldValues)) {
        hmap.set(k, v);
      }
      return Object.keys(fieldValues).length;
    },
    async hIncrBy(key: string, field: string, value: number): Promise<number> {
      let hmap = hashes.get(key);
      if (!hmap) {
        hmap = new Map<string, string>();
        hashes.set(key, hmap);
      }
      const cur = Number.parseInt(hmap.get(field) ?? '0', 10);
      const next = (Number.isNaN(cur) ? 0 : cur) + value;
      hmap.set(field, next.toString());
      return next;
    },
    async hGetAll(key: string): Promise<Record<string, string>> {
      const hmap = hashes.get(key);
      if (!hmap) return {};
      const res: Record<string, string> = {};
      for (const [k, v] of hmap.entries()) res[k] = v;
      return res;
    },
    async hDel(key: string, fields: string[]): Promise<number> {
      const hmap = hashes.get(key);
      if (!hmap) return 0;
      let count = 0;
      for (const f of fields) {
        if (hmap.delete(f)) count++;
      }
      return count;
    },
  };
};

describe('Scheduler Jobs', () => {
  let mockRedis: RedisClientContract;

  beforeEach(() => {
    mockRedis = createMockRedis();
  });

  describe('runBackfillJob', () => {
    it('fetches posts, indexes eligible images, and updates cursor', async () => {
      const mockPosts: RedditPostLike[] = [
        {
          id: 't3_bf1',
          title: 'Mars Rover Image',
          url: 'https://i.redd.it/mars.jpg',
          nsfw: false,
          createdAt: 1700000000,
          authorName: 'nasa_fan',
          flair: { text: 'Science' },
        },
        {
          id: 't3_bf2',
          title: 'NSFW Post',
          url: 'https://i.redd.it/nsfw.jpg',
          nsfw: true,
          createdAt: 1699999000,
        },
        {
          id: 't3_bf3',
          title: 'Circuit Design',
          url: 'https://i.redd.it/chip.png',
          nsfw: false,
          createdAt: 1699998000,
          flair: { text: 'Engineering' },
        },
      ];

      const mockReddit: RedditClientForBackfill = {
        getNewPosts: (opts) => ({
          all: async () => {
            expect(opts.limit).toBe(25);
            return mockPosts;
          },
        }),
      };

      const result = await runBackfillJob(mockRedis, mockReddit);

      expect(result.fetchedCount).toBe(3);
      expect(result.indexedCount).toBe(2); // bf1 and bf3 (bf2 skipped because NSFW)

      // Verify item indexed in Redis
      const item1 = await getGalleryItem('t3_bf1', mockRedis);
      expect(item1).not.toBeNull();
      expect(item1?.topic).toBe('science');

      const item2 = await getGalleryItem('t3_bf2', mockRedis);
      expect(item2).toBeNull(); // NSFW skipped

      // Check cursor recorded
      const cursor = await getJobState('backfill_cursor', mockRedis);
      expect(cursor).toBe('t3_bf3');
    });

    it('marks backfill as completed when zero posts returned', async () => {
      const mockReddit: RedditClientForBackfill = {
        getNewPosts: () => ({
          all: async () => [],
        }),
      };

      const result = await runBackfillJob(mockRedis, mockReddit);
      expect(result.status).toBe('completed');
      expect(result.fetchedCount).toBe(0);

      const status = await getJobState('backfill_status', mockRedis);
      expect(status).toBe('completed');
    });
  });

  describe('runReconcileJob', () => {
    it('detects and purges deleted and removed posts from gallery', async () => {
      // Setup 3 items in store
      await saveGalleryItem(
        {
          id: 't3_rec_active',
          permalink: '/comments/rec_active',
          title: 'Active Post',
          author: 'user1',
          subreddit: 'test',
          createdAt: 1000,
          media: { url: 'https://i.redd.it/active.jpg', width: 0, height: 0 },
          topic: 'science',
          topicSource: 'flair',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 1000,
          lastVerifiedAt: 1000,
        },
        mockRedis
      );

      await saveGalleryItem(
        {
          id: 't3_rec_deleted',
          permalink: '/comments/rec_deleted',
          title: 'Deleted Post',
          author: 'user2',
          subreddit: 'test',
          createdAt: 900,
          media: { url: 'https://i.redd.it/del.jpg', width: 0, height: 0 },
          topic: 'art',
          topicSource: 'flair',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 900,
          lastVerifiedAt: 900,
        },
        mockRedis
      );

      await saveGalleryItem(
        {
          id: 't3_rec_removed',
          permalink: '/comments/rec_removed',
          title: 'Removed Post',
          author: 'user3',
          subreddit: 'test',
          createdAt: 800,
          media: { url: 'https://i.redd.it/rem.jpg', width: 0, height: 0 },
          topic: 'engineering',
          topicSource: 'flair',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 800,
          lastVerifiedAt: 800,
        },
        mockRedis
      );

      const mockReddit: RedditClientForReconcile = {
        getPostById: async (id: string) => {
          if (id === 't3_rec_active') {
            return {
              id: 't3_rec_active',
              title: 'Active Post',
              url: 'https://i.redd.it/active.jpg',
              nsfw: false,
              removed: false,
              authorName: 'user1',
            };
          }
          if (id === 't3_rec_removed') {
            return {
              id: 't3_rec_removed',
              title: 'Removed Post',
              url: 'https://i.redd.it/rem.jpg',
              nsfw: false,
              removed: true, // moderator removed
              authorName: 'user3',
            };
          }
          // t3_rec_deleted returns undefined (post deleted completely)
          return undefined;
        },
      };

      const result = await runReconcileJob(mockRedis, mockReddit);

      expect(result.checkedCount).toBe(3);
      expect(result.purgedCount).toBe(2);

      // Verify active remains in store
      expect(await getGalleryItem('t3_rec_active', mockRedis)).not.toBeNull();

      // Verify deleted & removed are purged from store
      expect(await getGalleryItem('t3_rec_deleted', mockRedis)).toBeNull();
      expect(await getGalleryItem('t3_rec_removed', mockRedis)).toBeNull();

      // Verify last_reconcile_at updated
      const lastReconcile = await getJobState('last_reconcile_at', mockRedis);
      expect(lastReconcile).not.toBeNull();
    });
  });
});
