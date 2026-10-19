import { beforeEach, describe, expect, it } from 'vitest';
import type { PostV2 } from '@devvit/protos/json/devvit/reddit/v2alpha/postv2.js';
import type { UserV2 } from '@devvit/protos/json/devvit/reddit/v2alpha/userv2.js';
import type { SubredditV2 } from '@devvit/protos/json/devvit/reddit/v2alpha/subredditv2.js';
import type {
  OnPostCreateRequest,
  OnPostDeleteRequest,
} from '@devvit/web/shared';
import {
  getGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';
import { createTriggersRouter, type TriggerResult } from './triggers.js';

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

const createMockUser = (override?: Partial<UserV2>): UserV2 => ({
  id: 'u_1',
  name: 'physicist',
  isGold: false,
  snoovatarImage: '',
  url: '/user/physicist',
  spam: false,
  banned: false,
  karma: 100,
  iconImage: '',
  description: '',
  suspended: false,
  accountType: 1,
  ...override,
});

const createMockSubreddit = (override?: Partial<SubredditV2>): SubredditV2 => ({
  id: 'sub_1',
  name: 'science',
  nsfw: false,
  type: 5,
  spam: false,
  quarantined: false,
  topics: ['science'],
  rating: 1,
  subscribersCount: 10000,
  permalink: '/r/science',
  title: 'Science Community',
  description: 'Discussing science',
  ...override,
});

const createMockPost = (override?: Partial<PostV2>): PostV2 => ({
  id: 't3_trigger_post',
  title: 'Quantum Computing Lab',
  selftext: '',
  nsfw: false,
  authorId: 'user_123',
  crowdControlLevel: 0,
  numReports: 0,
  isGallery: false,
  isMeta: false,
  createdAt: 1710000000,
  isApproved: true,
  isArchived: false,
  distinguished: 0,
  ignoreReports: false,
  isSelf: false,
  isVideo: false,
  isLocked: false,
  isSpoiler: false,
  subredditId: 'sub_test',
  upvotes: 50,
  downvotes: 1,
  url: 'https://i.redd.it/quantum.png',
  isSticky: false,
  spam: false,
  deleted: false,
  languageCode: 'en',
  updatedAt: 1710000000,
  gildings: 0,
  score: 49,
  numComments: 5,
  thumbnail: 'https://b.thumbs.redditmedia.com/thumb.jpg',
  crosspostParentId: '',
  permalink: '/r/science/comments/trigger_post/quantum_lab/',
  isPoll: false,
  isPromoted: false,
  isMultiMedia: false,
  type: 'image',
  unlisted: false,
  galleryImages: [],
  isImage: true,
  mediaUrls: ['https://i.redd.it/quantum.png'],
  isClubContent: false,
  linkFlair: {
    text: 'Physics / Science',
    templateId: 'flair_1',
    textColor: 'dark',
    backgroundColor: '#fff',
    cssClass: '',
  },
  ...override,
});

describe('Triggers Router', () => {
  let mockRedis: RedisClientContract;
  let router: ReturnType<typeof createTriggersRouter>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    router = createTriggersRouter(mockRedis);
  });

  describe('POST /on-post-create', () => {
    it('captures and indexes an eligible image post', async () => {
      const payload: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost(),
        author: createMockUser(),
        subreddit: createMockSubreddit(),
      };

      const res = await router.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      expect(
        typeof json === 'object' && json !== null && 'status' in json
      ).toBe(true);
      const data = json as TriggerResult;
      expect(data.status).toBe('success');

      // Verify item stored in Redis
      const stored = await getGalleryItem('t3_trigger_post', mockRedis);
      expect(stored).not.toBeNull();
      expect(stored?.title).toBe('Quantum Computing Lab');
      expect(stored?.topic).toBe('science');
      expect(stored?.author).toBe('physicist');
    });

    it('skips NSFW post without storing in Redis', async () => {
      const payload: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost({ nsfw: true }),
      };

      const res = await router.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const data = json as TriggerResult;
      expect(data.status).toBe('success');
      expect(data.message).toContain('Post skipped');

      const stored = await getGalleryItem('t3_trigger_post', mockRedis);
      expect(stored).toBeNull();
    });

    it('skips text post without image', async () => {
      const payload: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost({
          isSelf: true,
          isImage: false,
          url: 'https://reddit.com/r/science/post',
        }),
      };

      const res = await router.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const data = json as TriggerResult;
      expect(data.status).toBe('success');
      expect(data.message).toContain('Post skipped');
    });

    it('returns 400 when post payload is missing', async () => {
      const res = await router.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PostCreate' }),
      });

      expect(res.status).toBe(400);
    });

    it('captures an eligible crosspost using parent post image and child post ID', async () => {
      const mockParentPost = {
        id: 't3_parent_nasa',
        title: 'NASA Nebula Photo',
        url: 'https://i.redd.it/nebula.jpg',
        permalink: '/r/space/comments/parent_nasa',
        nsfw: false,
        authorName: 'nasa_curator',
        subredditName: 'space',
        createdAt: 1690000000,
      };

      const mockReddit = {
        async getPostById(id: string) {
          if (id === 't3_parent_nasa') return mockParentPost;
          return undefined;
        },
      };

      const customRouter = createTriggersRouter(mockRedis, undefined, mockReddit);

      const payload: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost({
          id: 't3_child_cross_1',
          title: 'Shared Nebula Image',
          crosspostParentId: 't3_parent_nasa',
          isImage: false,
          url: 'https://reddit.com/r/space/comments/parent_nasa',
        }),
        author: { id: 't2_crossposter', name: 'astro_fan' } as UserV2,
        subreddit: { id: 't5_local', name: 'photogallery' } as SubredditV2,
      };

      const res = await customRouter.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const data = json as TriggerResult;
      expect(data.status).toBe('success');
      expect(data.message).toContain('Captured crosspost');

      const saved = await getGalleryItem('t3_child_cross_1', mockRedis);
      expect(saved).not.toBeNull();
      expect(saved?.isCrosspost).toBe(true);
      expect(saved?.crosspostParentId).toBe('t3_parent_nasa');
      expect(saved?.originalAuthor).toBe('nasa_curator');
      expect(saved?.originalSubreddit).toBe('space');
      expect(saved?.crossposterName).toBe('astro_fan');
      expect(saved?.media.url).toBe('https://i.redd.it/nebula.jpg');
    });

    it('deduplicates repeat crossposts of the same parent in O(1)', async () => {
      const mockParentPost = {
        id: 't3_parent_rover',
        title: 'Mars Rover Selfie',
        url: 'https://i.redd.it/rover.jpg',
        nsfw: false,
        authorName: 'jpl_tech',
        subredditName: 'mars',
        createdAt: 1690000000,
      };

      const mockReddit = {
        async getPostById(id: string) {
          if (id === 't3_parent_rover') return mockParentPost;
          return undefined;
        },
      };

      const customRouter = createTriggersRouter(mockRedis, undefined, mockReddit);

      // First crosspost succeeds
      const payload1: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost({
          id: 't3_rover_cross_first',
          crosspostParentId: 't3_parent_rover',
        }),
      };
      const res1 = await customRouter.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1),
      });
      expect(res1.status).toBe(200);

      // Second crosspost with same parent is rejected as duplicate
      const payload2: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost({
          id: 't3_rover_cross_second',
          crosspostParentId: 't3_parent_rover',
        }),
      };
      const res2 = await customRouter.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2),
      });
      expect(res2.status).toBe(200);
      const json2: unknown = await res2.json();
      const data2 = json2 as TriggerResult;
      expect(data2.message).toContain('already captured');

      // Only the first crosspost exists in gallery
      expect(await getGalleryItem('t3_rover_cross_first', mockRedis)).not.toBeNull();
      expect(await getGalleryItem('t3_rover_cross_second', mockRedis)).toBeNull();
    });

    it('gracefully skips crosspost if parent post throws an inaccessible error', async () => {
      const mockReddit = {
        async getPostById() {
          throw new Error('no post t3_parent_private');
        },
      };

      const customRouter = createTriggersRouter(mockRedis, undefined, mockReddit);

      const payload: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost({
          id: 't3_inaccessible_cross',
          crosspostParentId: 't3_parent_private',
        }),
      };

      const res = await customRouter.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const data = json as TriggerResult;
      expect(data.status).toBe('success');
      expect(data.message).toContain('parent post t3_parent_private inaccessible');
      expect(await getGalleryItem('t3_inaccessible_cross', mockRedis)).toBeNull();
    });
  });

  describe('POST /on-post-delete', () => {
    it('removes an existing post from gallery on deletion', async () => {
      // First save an item
      const createPayload: OnPostCreateRequest = {
        type: 'PostCreate',
        post: createMockPost({ id: 't3_delete_target' }),
      };
      await router.request('/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });

      expect(
        await getGalleryItem('t3_delete_target', mockRedis)
      ).not.toBeNull();

      // Trigger deletion
      const deletePayload: OnPostDeleteRequest = {
        type: 'PostDelete',
        postId: 't3_delete_target',
        source: 1,
        reason: 0,
      };

      const res = await router.request('/on-post-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletePayload),
      });

      expect(res.status).toBe(200);
      const json: unknown = await res.json();
      const data = json as TriggerResult;
      expect(data.status).toBe('success');
      expect(data.message).toContain('Removed post');

      // Verify removed from Redis
      expect(await getGalleryItem('t3_delete_target', mockRedis)).toBeNull();
    });

    it('returns 400 when postId is missing', async () => {
      const res = await router.request('/on-post-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PostDelete' }),
      });

      expect(res.status).toBe(400);
    });
  });
});
