import { beforeEach, describe, expect, it } from 'vitest';
import type { GalleryItem } from '../../shared/types.js';
import {
  getGalleryItem,
  saveGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';
import { createMenuRouter } from './menu.js';

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
    zRange: async (key: string) => {
      const set = zsets.get(key);
      if (!set) return [];
      return Array.from(set.entries()).map(([member, score]) => ({
        member,
        score,
      }));
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
  id: 't3_mod_target',
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

describe('Menu actions router', () => {
  let mockRedis: RedisClientContract;
  let router: ReturnType<typeof createMenuRouter>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    router = createMenuRouter(mockRedis);
  });

  describe('POST /mod-hide', () => {
    it('hides an existing item from the gallery and confirms with a toast', async () => {
      await saveGalleryItem(createSampleItem(), mockRedis);

      const res = await router.request('/mod-hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thingId: 't3_mod_target' }),
      });

      expect(res.status).toBe(200);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe('Post hidden from gallery');

      const updated = await getGalleryItem('t3_mod_target', mockRedis);
      expect(updated?.isModHidden).toBe(true);
    });

    it('returns 404 toast when item does not exist in the gallery', async () => {
      const res = await router.request('/mod-hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thingId: 't3_nonexistent' }),
      });

      expect(res.status).toBe(404);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe('Post is not in the photo gallery');
    });

    it('returns 400 toast when post ID cannot be extracted', async () => {
      const res = await router.request('/mod-hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe('Unable to hide: missing target post ID');
    });
  });

  describe('POST /mod-unhide', () => {
    it('restores a hidden item to the gallery and confirms with a toast', async () => {
      await saveGalleryItem(createSampleItem({ isModHidden: true }), mockRedis);

      const res = await router.request('/mod-unhide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thingId: 't3_mod_target' }),
      });

      expect(res.status).toBe(200);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe('Post restored to gallery');

      const updated = await getGalleryItem('t3_mod_target', mockRedis);
      expect(updated?.isModHidden).toBe(false);
    });

    it('returns 404 toast when restoring an item not in gallery', async () => {
      const res = await router.request('/mod-unhide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: 't3_nonexistent' }),
      });

      expect(res.status).toBe(404);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe('Post is not in the photo gallery');
    });
  });

  describe('POST /tag-location-open', () => {
    it('returns showForm with tagLocationForm specification and prefilled data', async () => {
      await saveGalleryItem(
        createSampleItem({
          id: 't3_target_loc',
          place: {
            raw: 'Kyoto, Japan',
            country: 'JP',
            region: 'Kyoto',
            city: 'Kyoto',
            status: 'poster-tagged',
          },
          takenAt: 1700000000,
        }),
        mockRedis
      );

      const res = await router.request('/tag-location-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thingId: 't3_target_loc' }),
      });

      expect(res.status).toBe(200);
      const body: {
        showForm?: {
          name: string;
          form: {
            title: string;
            fields: Array<{ name: string; defaultValue?: string }>;
          };
          data?: { postId: string };
        };
      } = await res.json();

      expect(body.showForm).toBeDefined();
      expect(body.showForm?.name).toBe('tagLocationForm');
      expect(body.showForm?.data?.postId).toBe('t3_target_loc');
      const locField = body.showForm?.form.fields.find(
        (f) => f.name === 'location'
      );
      expect(locField?.defaultValue).toBe('Kyoto, Japan');
    });

    it('returns 400 when missing target post ID', async () => {
      const res = await router.request('/tag-location-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe(
        'Unable to open form: missing target post ID'
      );
    });
  });
});
