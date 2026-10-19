import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GalleryItem,
  TimelinePage,
  TimelineSummary,
} from '../../shared/types.js';
import {
  getGalleryItem,
  saveGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';
import {
  createApiRouter,
  defaultModeratorChecker,
  type ModActionResponse,
} from './api.js';

const createMockRedis = (): RedisClientContract => {
  const kv = new Map<string, string>();
  const zsets = new Map<string, Map<string, number>>();
  const hashes = new Map<string, Map<string, string>>();

  return {
    get: async (key: string) => kv.get(key),
    set: async (key: string, value: string) => {
      kv.set(key, value);
      return 'OK';
    },
    del: async (...keys: string[]) => {
      for (const k of keys) {
        kv.delete(k);
        zsets.delete(k);
        hashes.delete(k);
      }
    },
    mGet: async (keys: string[]) => keys.map((k) => kv.get(k) ?? null),
    zAdd: async (
      key: string,
      ...members: { member: string; score: number }[]
    ) => {
      let set = zsets.get(key);
      if (!set) {
        set = new Map<string, number>();
        zsets.set(key, set);
      }
      for (const m of members) {
        set.set(m.member, m.score);
      }
      return members.length;
    },
    zRange: async (
      key: string,
      start?: number | string,
      stop?: number | string,
      options?: {
        reverse?: boolean;
        by?: 'score' | 'lex' | 'rank';
        limit?: { offset: number; count: number };
      }
    ) => {
      const set = zsets.get(key);
      if (!set) return [];
      let sorted = Array.from(set.entries()).map(([member, score]) => ({
        member,
        score,
      }));
      sorted.sort((a, b) =>
        options?.reverse ? b.score - a.score : a.score - b.score
      );

      if (options?.by === 'score') {
        const min = options.reverse ? Number(stop) : Number(start);
        const max = options.reverse ? Number(start) : Number(stop);
        sorted = sorted.filter(
          (item) => item.score >= min && item.score <= max
        );
        const offset = options.limit?.offset ?? 0;
        const count = options.limit?.count ?? sorted.length;
        return sorted.slice(offset, offset + count);
      }

      const offset = typeof start === 'number' && start >= 0 ? start : 0;
      let endIndex = typeof stop === 'number' ? stop : sorted.length - 1;
      if (endIndex < 0) {
        endIndex = sorted.length + endIndex;
      }
      return sorted.slice(offset, endIndex + 1);
    },
    zRem: async (key: string, members: string[]) => {
      const set = zsets.get(key);
      if (!set) return 0;
      let count = 0;
      for (const m of members) {
        if (set.delete(m)) count++;
      }
      return count;
    },
    zCard: async (key: string) => {
      const set = zsets.get(key);
      return set ? set.size : 0;
    },
    hGet: async (key: string, field: string) => {
      const h = hashes.get(key);
      return h ? h.get(field) : undefined;
    },
    hSet: async (key: string, fieldValues: Record<string, string>) => {
      let h = hashes.get(key);
      if (!h) {
        h = new Map<string, string>();
        hashes.set(key, h);
      }
      for (const [k, v] of Object.entries(fieldValues)) {
        h.set(k, v);
      }
      return Object.keys(fieldValues).length;
    },
    hIncrBy: async (key: string, field: string, value: number) => {
      let h = hashes.get(key);
      if (!h) {
        h = new Map<string, string>();
        hashes.set(key, h);
      }
      const current = Number.parseInt(h.get(field) || '0', 10);
      const updated = current + value;
      h.set(field, updated.toString());
      return updated;
    },
    hGetAll: async (key: string) => {
      const h = hashes.get(key);
      if (!h) return {};
      return Object.fromEntries(h.entries());
    },
    hDel: async (key: string, fields: string[]) => {
      const h = hashes.get(key);
      if (!h) return 0;
      let count = 0;
      for (const f of fields) {
        if (h.delete(f)) count++;
      }
      return count;
    },
  };
};

const createSampleItem = (override?: Partial<GalleryItem>): GalleryItem => ({
  id: 't3_api_target',
  permalink: '/r/science/comments/test',
  title: 'Test Photo',
  author: 'test_user',
  subreddit: 'science',
  createdAt: 1700000000,
  media: {
    url: 'https://i.redd.it/test.png',
    width: 0,
    height: 0,
  },
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
  capturedAt: 1700000001000,
  lastVerifiedAt: 1700000001000,
  ...override,
});

describe('API router moderator actions', () => {
  let mockRedis: RedisClientContract;

  beforeEach(() => {
    mockRedis = createMockRedis();
  });

  describe('POST /gallery/:id/hide', () => {
    it('denies access if user is not a moderator', async () => {
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false)
      );

      const res = await router.request('/gallery/t3_api_target/hide', {
        method: 'POST',
      });

      expect(res.status).toBe(403);
      const body: { status: string; message: string } = await res.json();
      expect(body.message).toBe('Moderator permissions required');
    });

    it('hides item when user is verified moderator', async () => {
      await saveGalleryItem(createSampleItem(), mockRedis);
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/gallery/t3_api_target/hide', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body: ModActionResponse = await res.json();
      expect(body.success).toBe(true);
      expect(body.isModHidden).toBe(true);

      const updated = await getGalleryItem('t3_api_target', mockRedis);
      expect(updated?.isModHidden).toBe(true);
    });

    it('returns 404 if item does not exist', async () => {
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/gallery/t3_nonexistent/hide', {
        method: 'POST',
      });

      expect(res.status).toBe(404);
      const body: { status: string; message: string } = await res.json();
      expect(body.message).toBe('Gallery item not found');
    });
  });

  describe('POST /gallery/:id/unhide', () => {
    it('unhides item when user is verified moderator', async () => {
      await saveGalleryItem(createSampleItem({ isModHidden: true }), mockRedis);
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/gallery/t3_api_target/unhide', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body: ModActionResponse = await res.json();
      expect(body.success).toBe(true);
      expect(body.isModHidden).toBe(false);

      const updated = await getGalleryItem('t3_api_target', mockRedis);
      expect(updated?.isModHidden).toBe(false);
    });
  });

  describe('GET /gallery/places/hierarchy and /gallery/places/summary', () => {
    it('returns places hierarchy and summary from Redis', async () => {
      const item = createSampleItem({
        id: 't3_tokyo',
        place: {
          raw: 'Tokyo, Japan',
          country: 'JP',
          region: 'Tokyo',
          city: 'Tokyo',
          status: 'poster-tagged',
        },
      });
      await saveGalleryItem(item, mockRedis);

      const router = createApiRouter(mockRedis);

      const hierarchyRes = await router.request('/gallery/places/hierarchy');
      expect(hierarchyRes.status).toBe(200);
      const hierarchy: Array<{ name: string; count: number }> =
        await hierarchyRes.json();
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0]?.name).toBe('Japan');

      const summaryRes = await router.request('/gallery/places/summary');
      expect(summaryRes.status).toBe(200);
      const summary: { unplacedCount: number; hierarchy: unknown[] } =
        await summaryRes.json();
      expect(summary.unplacedCount).toBe(0);
      expect(summary.hierarchy).toHaveLength(1);

      // GET /gallery/places
      const placesRes = await router.request('/gallery/places');
      expect(placesRes.status).toBe(200);
      const placesSummary: { unplacedCount: number; totalPlacedCount: number } =
        await placesRes.json();
      expect(placesSummary.totalPlacedCount).toBe(1);

      // GET /gallery/places/country/JP/items
      const itemsRes = await router.request('/gallery/places/country/JP/items');
      expect(itemsRes.status).toBe(200);
      const countryItems: TimelinePage = await itemsRes.json();
      expect(countryItems.items).toHaveLength(1);
      expect(countryItems.items[0]?.id).toBe('t3_tokyo');

      // GET /gallery/places/city/JP:Tokyo:Tokyo/items
      const cityItemsRes = await router.request(
        '/gallery/places/city/JP:Tokyo:Tokyo/items'
      );
      expect(cityItemsRes.status).toBe(200);
      const cityItems: TimelinePage = await cityItemsRes.json();
      expect(cityItems.items).toHaveLength(1);

      // Invalid placeType returns 400
      const badRes = await router.request(
        '/gallery/places/invalidPlace/abc/items'
      );
      expect(badRes.status).toBe(400);
    });

    it('returns unplaced items via /gallery/places/unplaced/items', async () => {
      const item = createSampleItem({
        id: 't3_unplaced_item',
        place: undefined,
      });
      await saveGalleryItem(item, mockRedis);

      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/places/unplaced/items');
      expect(res.status).toBe(200);
      const page: TimelinePage = await res.json();
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_unplaced_item');
    });
  });

  describe('POST /gallery/:id/location', () => {
    it('updates location when caller is verified moderator', async () => {
      await saveGalleryItem(createSampleItem({ id: 't3_loc_post' }), mockRedis);
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/gallery/t3_loc_post/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'San Francisco, CA',
          takenDate: '2024-06-01',
        }),
      });

      expect(res.status).toBe(200);
      const body: { success: boolean; item: GalleryItem } = await res.json();
      expect(body.success).toBe(true);
      expect(body.item.place?.city).toBe('San Francisco');
      expect(body.item.place?.country).toBe('US');
      expect(body.item.place?.status).toBe('mod-verified');
    });

    it('denies access if caller is neither author nor moderator', async () => {
      await saveGalleryItem(createSampleItem({ id: 't3_loc_post' }), mockRedis);
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false)
      );

      const res = await router.request('/gallery/t3_loc_post/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: 'San Francisco, CA' }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /gallery/timeline', () => {
    it('returns paged timeline items newest first', async () => {
      await saveGalleryItem(
        createSampleItem({ id: 't3_item_old', createdAt: 1000 }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({ id: 't3_item_new', createdAt: 2000 }),
        mockRedis
      );

      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/timeline?limit=1');
      expect(res.status).toBe(200);

      const page: TimelinePage = await res.json();
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_item_new');
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBeDefined();

      const page2Res = await router.request(
        `/gallery/timeline?limit=1&cursor=${page.nextCursor}`
      );
      expect(page2Res.status).toBe(200);
      const page2: TimelinePage = await page2Res.json();
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0]?.id).toBe('t3_item_old');
      expect(page2.hasMore).toBe(false);
    });

    it('filters timeline by topic', async () => {
      await saveGalleryItem(
        createSampleItem({ id: 't3_sci', topic: 'science' }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({ id: 't3_art', topic: 'art' }),
        mockRedis
      );

      const router = createApiRouter(mockRedis);
      const sciRes = await router.request('/gallery/timeline?topic=science');
      expect(sciRes.status).toBe(200);
      const sciPage: TimelinePage = await sciRes.json();
      expect(sciPage.items).toHaveLength(1);
      expect(sciPage.items[0]?.id).toBe('t3_sci');

      const artRes = await router.request('/gallery/timeline?topic=art');
      expect(artRes.status).toBe(200);
      const artPage: TimelinePage = await artRes.json();
      expect(artPage.items).toHaveLength(1);
      expect(artPage.items[0]?.id).toBe('t3_art');
    });

    it('filters timeline by year and month', async () => {
      // 2023-05-15
      await saveGalleryItem(
        createSampleItem({ id: 't3_2023_05', createdAt: 1684152000 }),
        mockRedis
      );
      // 2024-08-15
      await saveGalleryItem(
        createSampleItem({ id: 't3_2024_08', createdAt: 1723723200 }),
        mockRedis
      );

      const router = createApiRouter(mockRedis);
      const year2024Res = await router.request('/gallery/timeline?year=2024');
      expect(year2024Res.status).toBe(200);
      const year2024Page: TimelinePage = await year2024Res.json();
      expect(year2024Page.items).toHaveLength(1);
      expect(year2024Page.items[0]?.id).toBe('t3_2024_08');

      const aug2024Res = await router.request(
        '/gallery/timeline?year=2024&month=8'
      );
      expect(aug2024Res.status).toBe(200);
      const aug2024Page: TimelinePage = await aug2024Res.json();
      expect(aug2024Page.items).toHaveLength(1);
      expect(aug2024Page.items[0]?.id).toBe('t3_2024_08');
    });

    it('excludes mod-hidden items unless requested by a moderator', async () => {
      await saveGalleryItem(
        createSampleItem({
          id: 't3_hidden',
          isModHidden: true,
          createdAt: 3000,
        }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({
          id: 't3_visible',
          isModHidden: false,
          createdAt: 2000,
        }),
        mockRedis
      );

      // Normal viewer
      const routerPublic = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false)
      );
      const publicRes = await routerPublic.request(
        '/gallery/timeline?includeHidden=true'
      );
      expect(publicRes.status).toBe(200);
      const publicPage: TimelinePage = await publicRes.json();
      expect(publicPage.items).toHaveLength(1);
      expect(publicPage.items[0]?.id).toBe('t3_visible');

      // Moderator viewer
      const routerMod = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );
      const modRes = await routerMod.request(
        '/gallery/timeline?includeHidden=true'
      );
      expect(modRes.status).toBe(200);
      const modPage: TimelinePage = await modRes.json();
      expect(modPage.items).toHaveLength(2);
    });

    it('validates invalid query inputs with 400', async () => {
      const router = createApiRouter(mockRedis);

      const resBadLimit = await router.request('/gallery/timeline?limit=invalid');
      expect(resBadLimit.status).toBe(400);

      const resBadTopic = await router.request('/gallery/timeline?topic=gaming');
      expect(resBadTopic.status).toBe(400);

      const resBadPlaceType = await router.request(
        '/gallery/timeline?placeType=universe'
      );
      expect(resBadPlaceType.status).toBe(400);

      const resMonthWithoutYear = await router.request(
        '/gallery/timeline?month=5'
      );
      expect(resMonthWithoutYear.status).toBe(400);

      const resBadMonth = await router.request(
        '/gallery/timeline?year=2024&month=13'
      );
      expect(resBadMonth.status).toBe(400);
    });
  });

  describe('GET /gallery/timeline/summary', () => {
    it('returns timeline counts by year and month along with topic counts', async () => {
      await saveGalleryItem(
        createSampleItem({
          id: 't3_item1',
          createdAt: 1684152000, // 2023-05
          topic: 'science',
        }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({
          id: 't3_item2',
          createdAt: 1723723200, // 2024-08
          topic: 'art',
        }),
        mockRedis
      );

      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/timeline/summary');
      expect(res.status).toBe(200);

      const summary: TimelineSummary = await res.json();
      expect(summary.totalCount).toBe(2);
      expect(summary.years).toHaveLength(2);
      expect(summary.topics?.science).toBe(1);
      expect(summary.topics?.art).toBe(1);
      expect(summary.topics?.engineering).toBe(0);
    });
  });

  describe('GET /gallery/item/:id', () => {
    it('returns item detail when item exists and is visible', async () => {
      await saveGalleryItem(
        createSampleItem({ id: 't3_detail_target', title: 'Target Detail Post' }),
        mockRedis
      );

      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/item/t3_detail_target');
      expect(res.status).toBe(200);

      const body: { item: GalleryItem } = await res.json();
      expect(body.item.id).toBe('t3_detail_target');
      expect(body.item.title).toBe('Target Detail Post');
    });

    it('returns 404 for nonexistent or removed item', async () => {
      const router = createApiRouter(mockRedis);
      const resNonexistent = await router.request('/gallery/item/t3_does_not_exist');
      expect(resNonexistent.status).toBe(404);

      await saveGalleryItem(
        createSampleItem({ id: 't3_removed_post', isRemoved: true }),
        mockRedis
      );
      const resRemoved = await router.request('/gallery/item/t3_removed_post');
      expect(resRemoved.status).toBe(404);
    });

    it('hides mod-hidden item from normal viewers but shows to moderators', async () => {
      await saveGalleryItem(
        createSampleItem({ id: 't3_hidden_detail', isModHidden: true }),
        mockRedis
      );

      // Normal viewer
      const routerNormal = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false)
      );
      const resNormal = await routerNormal.request(
        '/gallery/item/t3_hidden_detail'
      );
      expect(resNormal.status).toBe(404);

      // Moderator viewer
      const routerMod = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );
      const resMod = await routerMod.request('/gallery/item/t3_hidden_detail');
      expect(resMod.status).toBe(200);
      const body: { item: GalleryItem } = await resMod.json();
      expect(body.item.id).toBe('t3_hidden_detail');
      expect(body.item.isModHidden).toBe(true);
    });
  });

  describe('GET /gallery/search', () => {
    it('validates query parameter q and returns 400 if missing or empty', async () => {
      const router = createApiRouter(mockRedis);
      const resMissing = await router.request('/gallery/search');
      expect(resMissing.status).toBe(400);

      const resEmpty = await router.request('/gallery/search?q=   ');
      expect(resEmpty.status).toBe(400);
    });

    it('returns matching items by title keyword', async () => {
      await saveGalleryItem(
        createSampleItem({
          id: 't3_galaxy',
          title: 'Spiral Galaxy M31 in Andromeda',
          createdAt: 2000,
        }),
        mockRedis
      );
      await saveGalleryItem(
        createSampleItem({
          id: 't3_nebula',
          title: 'Orion Nebula Emission Region',
          createdAt: 1000,
        }),
        mockRedis
      );

      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/search?q=galaxy');
      expect(res.status).toBe(200);

      const page: TimelinePage = await res.json();
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_galaxy');

      const noMatchRes = await router.request('/gallery/search?q=supernova');
      expect(noMatchRes.status).toBe(200);
      const noMatchPage: TimelinePage = await noMatchRes.json();
      expect(noMatchPage.items).toHaveLength(0);
    });
  });

  describe('Favorites endpoints', () => {
    it('toggles favorite on and off for authenticated user', async () => {
      await saveGalleryItem(
        createSampleItem({ id: 't3_fav_target' }),
        mockRedis
      );

      const usernameProvider = vi.fn().mockResolvedValue('curious_scientist');
      const router = createApiRouter(
        mockRedis,
        defaultModeratorChecker,
        usernameProvider
      );

      // Check favorite initial state
      const check1 = await router.request('/gallery/t3_fav_target/favorite');
      expect(check1.status).toBe(200);
      const c1: { id: string; isFavorite: boolean } = await check1.json();
      expect(c1.isFavorite).toBe(false);

      // Toggle ON
      const toggle1 = await router.request('/gallery/t3_fav_target/favorite', {
        method: 'POST',
      });
      expect(toggle1.status).toBe(200);
      const t1: { id: string; isFavorite: boolean } = await toggle1.json();
      expect(t1.isFavorite).toBe(true);

      // Check favorite state is now true
      const check2 = await router.request('/gallery/t3_fav_target/favorite');
      const c2: { id: string; isFavorite: boolean } = await check2.json();
      expect(c2.isFavorite).toBe(true);

      // GET /gallery/favorites returns the favorited item
      const favListRes = await router.request('/gallery/favorites');
      expect(favListRes.status).toBe(200);
      const favPage: TimelinePage = await favListRes.json();
      expect(favPage.items).toHaveLength(1);
      expect(favPage.items[0]?.id).toBe('t3_fav_target');

      // Toggle OFF
      const toggle2 = await router.request('/gallery/t3_fav_target/favorite', {
        method: 'POST',
      });
      expect(toggle2.status).toBe(200);
      const t2: { id: string; isFavorite: boolean } = await toggle2.json();
      expect(t2.isFavorite).toBe(false);

      // GET /gallery/favorites is now empty
      const favListAfter = await router.request('/gallery/favorites');
      const favPageAfter: TimelinePage = await favListAfter.json();
      expect(favPageAfter.items).toHaveLength(0);
    });

    it('requires authentication to toggle favorite', async () => {
      await saveGalleryItem(createSampleItem({ id: 't3_fav_target' }), mockRedis);
      const unauthProvider = vi.fn().mockResolvedValue(undefined);
      const router = createApiRouter(
        mockRedis,
        defaultModeratorChecker,
        unauthProvider
      );

      const res = await router.request('/gallery/t3_fav_target/favorite', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when toggling favorite on nonexistent post', async () => {
      const usernameProvider = vi.fn().mockResolvedValue('user123');
      const router = createApiRouter(
        mockRedis,
        defaultModeratorChecker,
        usernameProvider
      );

      const res = await router.request('/gallery/t3_nonexistent/favorite', {
        method: 'POST',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('Taxonomy Filtering & Endpoints', () => {
    beforeEach(async () => {
      // Seed varied items
      await saveGalleryItem(
        createSampleItem({
          id: 't3_bio_home',
          title: 'Bio Home Photo',
          author: 'alice',
          disciplines: ['Biology'],
          disciplinesSource: 'poster-tagged',
          impacts: ['Home'],
          impactsSource: 'poster-tagged',
          createdAt: 1000,
        }),
        mockRedis
      );

      await saveGalleryItem(
        createSampleItem({
          id: 't3_mat_self',
          title: 'Materials Self Photo',
          author: 'bob',
          disciplines: ['Materials'],
          disciplinesSource: 'poster-tagged',
          impacts: ['Self'],
          impactsSource: 'poster-tagged',
          createdAt: 2000,
        }),
        mockRedis
      );

      await saveGalleryItem(
        createSampleItem({
          id: 't3_em_friends',
          title: 'Electromagnetics Friends Photo',
          author: 'charlie',
          disciplines: ['Electromagnetics'],
          disciplinesSource: 'mod-verified',
          impacts: ['Friends'],
          impactsSource: 'mod-verified',
          createdAt: 3000,
        }),
        mockRedis
      );

      await saveGalleryItem(
        createSampleItem({
          id: 't3_untagged_item',
          title: 'Untagged Photo',
          author: 'dave',
          disciplines: [],
          disciplinesSource: 'untagged',
          impacts: [],
          impactsSource: 'untagged',
          createdAt: 4000,
        }),
        mockRedis
      );
    });

    it('filters timeline by single discipline', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/timeline?disciplines=Biology');
      expect(res.status).toBe(200);
      const page: TimelinePage = await res.json();
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_bio_home');
    });

    it('filters timeline by multiple disciplines (OR within group)', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request(
        '/gallery/timeline?disciplines=Biology,Materials'
      );
      expect(res.status).toBe(200);
      const page: TimelinePage = await res.json();
      const ids = page.items.map((i) => i.id);
      expect(ids).toContain('t3_bio_home');
      expect(ids).toContain('t3_mat_self');
      expect(ids).not.toContain('t3_em_friends');
    });

    it('filters timeline by single impact', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/timeline?impacts=Self');
      expect(res.status).toBe(200);
      const page: TimelinePage = await res.json();
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_mat_self');
    });

    it('filters timeline by discipline AND impact (cross-group AND)', async () => {
      const router = createApiRouter(mockRedis);
      // Biology + Self has no match
      const resNone = await router.request(
        '/gallery/timeline?disciplines=Biology&impacts=Self'
      );
      expect(resNone.status).toBe(200);
      const pageNone: TimelinePage = await resNone.json();
      expect(pageNone.items).toHaveLength(0);

      // Biology + Home matches t3_bio_home
      const resMatch = await router.request(
        '/gallery/timeline?disciplines=Biology&impacts=Home'
      );
      expect(resMatch.status).toBe(200);
      const pageMatch: TimelinePage = await resMatch.json();
      expect(pageMatch.items).toHaveLength(1);
      expect(pageMatch.items[0]?.id).toBe('t3_bio_home');
    });

    it('filters timeline by untagged disciplines', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/timeline?disciplines=untagged');
      expect(res.status).toBe(200);
      const page: TimelinePage = await res.json();
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_untagged_item');
    });

    it('returns 400 when discipline filter is invalid', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/timeline?disciplines=FakeDiscipline');
      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.message).toContain('Invalid discipline');
    });

    it('returns 400 when impact filter is invalid', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/timeline?impacts=FakeImpact');
      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.message).toContain('Invalid impact');
    });

    it('returns accurate taxonomy counts on GET /gallery/taxonomy/summary', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request('/gallery/taxonomy/summary');
      expect(res.status).toBe(200);
      const counts: {
        disciplines: Record<string, number>;
        impacts: Record<string, number>;
      } = await res.json();

      expect(counts.disciplines.Biology).toBe(1);
      expect(counts.disciplines.Materials).toBe(1);
      expect(counts.disciplines.Electromagnetics).toBe(1);
      expect(counts.disciplines.Mechanics).toBe(0);
      expect(counts.disciplines.untagged).toBe(1);

      expect(counts.impacts.Home).toBe(1);
      expect(counts.impacts.Self).toBe(1);
      expect(counts.impacts.Friends).toBe(1);
      expect(counts.impacts.Government).toBe(0);
      expect(counts.impacts.untagged).toBe(1);
    });

    it('allows author to update tags on their post via POST /gallery/:id/tags', async () => {
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false), // not mod
        vi.fn().mockResolvedValue('alice') // author of t3_bio_home
      );

      const res = await router.request('/gallery/t3_bio_home/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplines: ['Biology', 'Materials'],
          impacts: ['Home', 'Self'],
        }),
      });

      expect(res.status).toBe(200);
      const updated = await getGalleryItem('t3_bio_home', mockRedis);
      expect(updated?.disciplines).toEqual(['Biology', 'Materials']);
      expect(updated?.disciplinesSource).toBe('poster-tagged');
      expect(updated?.impacts).toEqual(['Home', 'Self']);
      expect(updated?.impactsSource).toBe('poster-tagged');
    });

    it('allows moderator to override tags on any post via POST /gallery/:id/tags', async () => {
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true), // is mod
        vi.fn().mockResolvedValue('mod_user')
      );

      const res = await router.request('/gallery/t3_bio_home/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplines: ['Mechanics'],
          impacts: ['Government'],
        }),
      });

      expect(res.status).toBe(200);
      const updated = await getGalleryItem('t3_bio_home', mockRedis);
      expect(updated?.disciplines).toEqual(['Mechanics']);
      expect(updated?.disciplinesSource).toBe('mod-verified');
      expect(updated?.impacts).toEqual(['Government']);
      expect(updated?.impactsSource).toBe('mod-verified');
    });

    it('rejects tag update when caller is neither author nor moderator', async () => {
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false), // not mod
        vi.fn().mockResolvedValue('stranger') // not author
      );

      const res = await router.request('/gallery/t3_bio_home/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplines: ['Arts'],
        }),
      });

      expect(res.status).toBe(403);
    });

    it('rejects poster attempt to downgrade moderator-verified tags', async () => {
      const router = createApiRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false), // not mod
        vi.fn().mockResolvedValue('charlie') // author of t3_em_friends (which is mod-verified)
      );

      const res = await router.request('/gallery/t3_em_friends/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplines: ['Biology'],
        }),
      });

      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.message).toContain('Cannot override moderator-verified');
    });

    it('supports taxonomy filtering on unplaced items endpoint', async () => {
      const router = createApiRouter(mockRedis);
      const res = await router.request(
        '/gallery/places/unplaced/items?disciplines=Biology'
      );
      expect(res.status).toBe(200);
      const page: TimelinePage = await res.json();
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe('t3_bio_home');
    });
  });
});
