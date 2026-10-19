import { beforeEach, describe, expect, it } from 'vitest';
import type { RedditPostLike } from '../core/postCapture.js';
import {
  getGalleryItem,
  getJobState,
  saveGalleryItem,
  REDIS_KEYS,
  type RedisClientContract,
} from '../data/galleryStore.js';
import { runBackfillJob, type RedditClientForBackfill } from './backfill.js';
import { runReconcileJob, type RedditClientForReconcile } from './reconcile.js';
import {
  getMigrationStatus,
  resetMigration,
  runMigrationJob,
} from './migration.js';

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
      stop: number | string,
      options?: {
        reverse?: boolean;
        by?: 'score' | 'lex' | 'rank';
        limit?: {
          offset: number;
          count: number;
        };
      }
    ): Promise<{ member: string; score: number }[]> {
      const zmap = zsets.get(key);
      if (!zmap) return [];
      const reverse = options?.reverse ?? true;
      const sorted = Array.from(zmap.entries())
        .map(([member, score]) => ({ member, score }))
        .sort((a, b) => (reverse ? b.score - a.score : a.score - b.score));
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
          disciplines: ['Biology'],
          disciplinesSource: 'poster-tagged',
          impacts: ['Home'],
          impactsSource: 'poster-tagged',
          isCrosspost: false,
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
          disciplines: ['Arts'],
          disciplinesSource: 'poster-tagged',
          impacts: ['Self'],
          impactsSource: 'poster-tagged',
          isCrosspost: false,
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
          disciplines: ['Mechanics'],
          disciplinesSource: 'poster-tagged',
          impacts: ['Government'],
          impactsSource: 'poster-tagged',
          isCrosspost: false,
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

    it('purges a crosspost item if its parent post is deleted, removed, or inaccessible', async () => {
      // 1. Crosspost whose parent is removed
      await saveGalleryItem(
        {
          id: 't3_cross_child_1',
          permalink: '/comments/cross_child_1',
          title: 'Crosspost with Removed Parent',
          author: 'crossposter1',
          subreddit: 'test',
          createdAt: 1000,
          media: { url: 'https://i.redd.it/image.jpg', width: 0, height: 0 },
          disciplines: ['Biology'],
          disciplinesSource: 'poster-tagged',
          impacts: ['Home'],
          impactsSource: 'poster-tagged',
          isCrosspost: true,
          crosspostParentId: 't3_parent_removed',
          originalSubreddit: 'science',
          originalAuthor: 'author1',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 1000,
          lastVerifiedAt: 1000,
        },
        mockRedis
      );

      // 2. Crosspost whose parent is active and intact
      await saveGalleryItem(
        {
          id: 't3_cross_child_2',
          permalink: '/comments/cross_child_2',
          title: 'Crosspost with Active Parent',
          author: 'crossposter2',
          subreddit: 'test',
          createdAt: 950,
          media: { url: 'https://i.redd.it/intact.jpg', width: 0, height: 0 },
          disciplines: ['Materials'],
          disciplinesSource: 'poster-tagged',
          impacts: ['Self'],
          impactsSource: 'poster-tagged',
          isCrosspost: true,
          crosspostParentId: 't3_parent_intact',
          originalSubreddit: 'physics',
          originalAuthor: 'author2',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 950,
          lastVerifiedAt: 950,
        },
        mockRedis
      );

      const mockReddit: RedditClientForReconcile = {
        getPostById: async (id: string) => {
          if (id === 't3_cross_child_1') {
            return {
              id: 't3_cross_child_1',
              title: 'Crosspost with Removed Parent',
              url: 'https://reddit.com/r/test/comments/cross_child_1',
              nsfw: false,
              authorName: 'crossposter1',
            };
          }
          if (id === 't3_parent_removed') {
            return {
              id: 't3_parent_removed',
              title: 'Original Post',
              url: 'https://i.redd.it/image.jpg',
              nsfw: false,
              removed: true, // Parent was removed!
              authorName: 'author1',
            };
          }
          if (id === 't3_cross_child_2') {
            return {
              id: 't3_cross_child_2',
              title: 'Crosspost with Active Parent',
              url: 'https://reddit.com/r/test/comments/cross_child_2',
              nsfw: false,
              authorName: 'crossposter2',
            };
          }
          if (id === 't3_parent_intact') {
            return {
              id: 't3_parent_intact',
              title: 'Original Intact Post',
              url: 'https://i.redd.it/intact.jpg',
              nsfw: false,
              removed: false,
              authorName: 'author2',
            };
          }
          return undefined;
        },
      };

      const result = await runReconcileJob(mockRedis, mockReddit);

      expect(result.checkedCount).toBe(2);
      expect(result.purgedCount).toBe(1);

      // Child 1 purged because parent was removed
      expect(await getGalleryItem('t3_cross_child_1', mockRedis)).toBeNull();
      // Child 2 kept because parent is intact
      expect(await getGalleryItem('t3_cross_child_2', mockRedis)).not.toBeNull();
    });
  });

  describe('runBackfillJob with crossposts', () => {
    it('indexes historical crossposts by resolving original parent and deduplicates repeats', async () => {
      const mockPosts: RedditPostLike[] = [
        {
          id: 't3_bf_cross_1',
          title: 'Shared Galaxy Picture',
          url: 'https://reddit.com/r/space/comments/orig_galaxy',
          crosspostParentId: 't3_orig_galaxy',
          nsfw: false,
          createdAt: 1700000000,
          authorName: 'crossposter_bob',
        },
        {
          id: 't3_bf_cross_dupe',
          title: 'Duplicate Galaxy Share',
          url: 'https://reddit.com/r/space/comments/orig_galaxy',
          crosspostParentId: 't3_orig_galaxy', // Duplicate parent!
          nsfw: false,
          createdAt: 1699999000,
          authorName: 'crossposter_alice',
        },
      ];

      const mockParentPost: RedditPostLike = {
        id: 't3_orig_galaxy',
        title: 'Hubble Deep Galaxy',
        url: 'https://i.redd.it/galaxy.jpg',
        permalink: '/r/space/comments/orig_galaxy',
        nsfw: false,
        authorName: 'hubble_fan',
        subredditName: 'space',
        createdAt: 1690000000,
      };

      const mockReddit: RedditClientForBackfill = {
        getNewPosts: () => ({
          all: async () => mockPosts,
        }),
        getPostById: async (id: string) => {
          if (id === 't3_orig_galaxy') return mockParentPost;
          return undefined;
        },
      };

      const result = await runBackfillJob(mockRedis, mockReddit);

      expect(result.fetchedCount).toBe(2);
      expect(result.indexedCount).toBe(1); // Only the first crosspost indexed

      const item1 = await getGalleryItem('t3_bf_cross_1', mockRedis);
      expect(item1).not.toBeNull();
      expect(item1?.isCrosspost).toBe(true);
      expect(item1?.crosspostParentId).toBe('t3_orig_galaxy');
      expect(item1?.media.url).toBe('https://i.redd.it/galaxy.jpg');

      const dupeItem = await getGalleryItem('t3_bf_cross_dupe', mockRedis);
      expect(dupeItem).toBeNull();
    });
  });

  describe('runMigrationJob', () => {
    it('handles empty gallery store gracefully', async () => {
      const result = await runMigrationJob(mockRedis);
      expect(result.status).toBe('completed');
      expect(result.isComplete).toBe(true);
      expect(result.totalItems).toBe(0);

      const status = await getMigrationStatus(mockRedis);
      expect(status.status).toBe('completed');
      expect(status.schemaVersion).toBe('v2.0');
      expect(status.percentComplete).toBe(100);
    });

    it('processes items in batches, re-evaluates tags, and resumes from cursor', async () => {
      await saveGalleryItem(
        {
          id: 't3_mig_1',
          permalink: '/comments/mig_1',
          title: 'RF antenna and circuit experiment',
          author: 'user1',
          subreddit: 'science',
          createdAt: 1000,
          media: { url: 'https://i.redd.it/1.jpg', width: 0, height: 0 },
          disciplines: [],
          disciplinesSource: 'untagged',
          impacts: [],
          impactsSource: 'untagged',
          isCrosspost: false,
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
          id: 't3_mig_2',
          permalink: '/comments/mig_2',
          title: 'Microscopy of plant cell DNA genetics',
          author: 'user2',
          subreddit: 'science',
          createdAt: 2000,
          media: { url: 'https://i.redd.it/2.jpg', width: 0, height: 0 },
          disciplines: [],
          disciplinesSource: 'untagged',
          impacts: [],
          impactsSource: 'untagged',
          isCrosspost: false,
          topic: 'science',
          topicSource: 'flair',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 2000,
          lastVerifiedAt: 2000,
        },
        mockRedis
      );

      await saveGalleryItem(
        {
          id: 't3_mig_3',
          permalink: '/comments/mig_3',
          title: 'Suspension bridge turbine engine structure',
          author: 'user3',
          subreddit: 'science',
          createdAt: 3000,
          media: { url: 'https://i.redd.it/3.jpg', width: 0, height: 0 },
          disciplines: [],
          disciplinesSource: 'untagged',
          impacts: [],
          impactsSource: 'untagged',
          isCrosspost: false,
          topic: 'engineering',
          topicSource: 'flair',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 3000,
          lastVerifiedAt: 3000,
        },
        mockRedis
      );

      // Batch 1 (batchSize: 2) -> processes 2 items
      const batch1 = await runMigrationJob(mockRedis, undefined, 2);
      expect(batch1.status).toBe('in_progress');
      expect(batch1.isComplete).toBe(false);
      expect(batch1.batchProcessed).toBe(2);
      expect(batch1.batchMigrated).toBe(2);
      expect(batch1.totalProcessed).toBe(2);
      expect(batch1.nextCursor).toBe('2');

      const midStatus = await getMigrationStatus(mockRedis);
      expect(midStatus.status).toBe('in_progress');
      expect(midStatus.cursor).toBe(2);
      expect(midStatus.processedCount).toBe(2);

      // Batch 2 (batchSize: 2) -> resumes from cursor 2 and processes remaining 1 item
      const batch2 = await runMigrationJob(mockRedis, undefined, 2);
      expect(batch2.status).toBe('completed');
      expect(batch2.isComplete).toBe(true);
      expect(batch2.batchProcessed).toBe(1);
      expect(batch2.batchMigrated).toBe(1);
      expect(batch2.totalProcessed).toBe(3);

      // Verify item tags re-evaluated accurately
      const item1 = await getGalleryItem('t3_mig_1', mockRedis);
      expect(item1?.disciplines).toContain('Electromagnetics');
      expect(item1?.disciplinesSource).toBe('auto-suggested');

      const item2 = await getGalleryItem('t3_mig_2', mockRedis);
      expect(item2?.disciplines).toContain('Biology');
      expect(item2?.disciplinesSource).toBe('auto-suggested');

      const item3 = await getGalleryItem('t3_mig_3', mockRedis);
      expect(item3?.disciplines).toContain('Mechanics');
      expect(item3?.disciplinesSource).toBe('auto-suggested');

      // Final status
      const finalStatus = await getMigrationStatus(mockRedis);
      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.schemaVersion).toBe('v2.0');
      expect(finalStatus.percentComplete).toBe(100);
    });

    it('preserves user and moderator confirmed tags and does not overwrite them', async () => {
      await saveGalleryItem(
        {
          id: 't3_mig_user',
          permalink: '/comments/mig_user',
          title: 'Circuit antenna motor', // keywords would suggest Electromagnetics/Mechanics
          author: 'alice',
          subreddit: 'science',
          createdAt: 1000,
          media: { url: 'https://i.redd.it/user.jpg', width: 0, height: 0 },
          disciplines: ['Arts'],
          disciplinesSource: 'poster-tagged', // user confirmed!
          impacts: ['Home'],
          impactsSource: 'poster-tagged', // user confirmed!
          isCrosspost: false,
          topic: 'art',
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
          id: 't3_mig_mod',
          permalink: '/comments/mig_mod',
          title: 'Microscopy cell biology',
          author: 'bob',
          subreddit: 'science',
          createdAt: 2000,
          media: { url: 'https://i.redd.it/mod.jpg', width: 0, height: 0 },
          disciplines: ['Materials'],
          disciplinesSource: 'mod-verified', // mod confirmed!
          impacts: ['Government'],
          impactsSource: 'mod-verified', // mod confirmed!
          isCrosspost: false,
          topic: 'science',
          topicSource: 'flair',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 2000,
          lastVerifiedAt: 2000,
        },
        mockRedis
      );

      const result = await runMigrationJob(mockRedis, undefined, 10);
      expect(result.status).toBe('completed');
      expect(result.batchSkipped).toBe(2);
      expect(result.batchMigrated).toBe(0);

      // Verify confirmed tags were preserved untouched
      const itemUser = await getGalleryItem('t3_mig_user', mockRedis);
      expect(itemUser?.disciplines).toEqual(['Arts']);
      expect(itemUser?.disciplinesSource).toBe('poster-tagged');
      expect(itemUser?.impacts).toEqual(['Home']);
      expect(itemUser?.impactsSource).toBe('poster-tagged');

      const itemMod = await getGalleryItem('t3_mig_mod', mockRedis);
      expect(itemMod?.disciplines).toEqual(['Materials']);
      expect(itemMod?.disciplinesSource).toBe('mod-verified');
      expect(itemMod?.impacts).toEqual(['Government']);
      expect(itemMod?.impactsSource).toBe('mod-verified');
    });

    it('does not guess legacy topics and leaves ambiguous items untagged', async () => {
      await saveGalleryItem(
        {
          id: 't3_ambiguous',
          permalink: '/comments/ambiguous',
          title: 'A lovely sunny afternoon in the park with coffee',
          author: 'charlie',
          subreddit: 'science',
          createdAt: 1500,
          media: { url: 'https://i.redd.it/amb.jpg', width: 0, height: 0 },
          disciplines: [],
          disciplinesSource: 'untagged',
          impacts: [],
          impactsSource: 'untagged',
          isCrosspost: false,
          topic: 'science', // legacy topic was science
          topicSource: 'flair',
          isModHidden: false,
          isNsfw: false,
          isRemoved: false,
          capturedAt: 1500,
          lastVerifiedAt: 1500,
        },
        mockRedis
      );

      const result = await runMigrationJob(mockRedis, undefined, 10);
      expect(result.status).toBe('completed');

      const item = await getGalleryItem('t3_ambiguous', mockRedis);
      // Strictly follows requirement: do NOT guess mappings like Science -> Biology; leave ambiguous items Untagged
      expect(item?.disciplines).toEqual([]);
      expect(item?.disciplinesSource).toBe('untagged');
      expect(item?.impacts).toEqual([]);
      expect(item?.impactsSource).toBe('untagged');
    });

    it('purges obsolete topic indexes upon migration completion', async () => {
      // Seed a legacy topic index entry
      await mockRedis.zAdd(REDIS_KEYS.idxTopic('science'), {
        member: 't3_mig_1',
        score: 1000,
      });
      await mockRedis.zAdd(REDIS_KEYS.idxTopic('art'), {
        member: 't3_mig_2',
        score: 2000,
      });

      expect(await mockRedis.zCard(REDIS_KEYS.idxTopic('science'))).toBe(1);
      expect(await mockRedis.zCard(REDIS_KEYS.idxTopic('art'))).toBe(1);

      await saveGalleryItem(
        {
          id: 't3_mig_1',
          permalink: '/comments/mig_1',
          title: 'Antenna Circuit',
          author: 'user1',
          subreddit: 'science',
          createdAt: 1000,
          media: { url: 'https://i.redd.it/1.jpg', width: 0, height: 0 },
          disciplines: [],
          disciplinesSource: 'untagged',
          impacts: [],
          impactsSource: 'untagged',
          isCrosspost: false,
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

      await runMigrationJob(mockRedis, undefined, 10);

      // Verify obsolete topic indexes are purged
      expect(await mockRedis.zCard(REDIS_KEYS.idxTopic('science'))).toBe(0);
      expect(await mockRedis.zCard(REDIS_KEYS.idxTopic('art'))).toBe(0);
    });

    it('supports resetMigration to restart migration from cursor 0', async () => {
      await saveGalleryItem(
        {
          id: 't3_mig_item',
          permalink: '/comments/mig_item',
          title: 'Antenna Circuit',
          author: 'user1',
          subreddit: 'science',
          createdAt: 1000,
          media: { url: 'https://i.redd.it/1.jpg', width: 0, height: 0 },
          disciplines: [],
          disciplinesSource: 'untagged',
          impacts: [],
          impactsSource: 'untagged',
          isCrosspost: false,
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

      await runMigrationJob(mockRedis, undefined, 10);
      let status = await getMigrationStatus(mockRedis);
      expect(status.status).toBe('completed');

      await resetMigration(mockRedis);
      status = await getMigrationStatus(mockRedis);
      expect(status.status).toBe('in_progress');
      expect(status.cursor).toBe(0);
      expect(status.processedCount).toBe(0);
    });
  });
});
