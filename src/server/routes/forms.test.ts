import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GalleryItem } from '../../shared/types.js';
import {
  getGalleryItem,
  saveGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';
import { createFormsRouter } from './forms.js';

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
  id: 't3_form_target',
  permalink: '/r/science/comments/test',
  title: 'Test Photo',
  author: 'original_poster',
  subreddit: 'science',
  createdAt: 1700000000,
  media: {
    url: 'https://i.redd.it/test.png',
    width: 0,
    height: 0,
  },
  topic: 'science',
  topicSource: 'flair',
  isModHidden: false,
  isNsfw: false,
  isRemoved: false,
  capturedAt: 1700000001000,
  lastVerifiedAt: 1700000001000,
  ...override,
});

describe('Forms router', () => {
  let mockRedis: RedisClientContract;

  beforeEach(() => {
    mockRedis = createMockRedis();
  });

  describe('POST /tag-location', () => {
    it('returns error toast when missing post ID', async () => {
      const router = createFormsRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/tag-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'Tokyo, Japan',
        }),
      });

      expect(res.status).toBe(400);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe('Unable to tag location: missing post ID');
    });

    it('allows moderator to tag and verify location', async () => {
      await saveGalleryItem(createSampleItem(), mockRedis);
      const router = createFormsRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/tag-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: 't3_form_target',
          location: 'Geneva, Switzerland',
          takenDate: '2023-11-14',
        }),
      });

      expect(res.status).toBe(200);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toContain('Location updated: Geneva, Switzerland');

      const updated = await getGalleryItem('t3_form_target', mockRedis);
      expect(updated?.place?.city).toBe('Geneva');
      expect(updated?.place?.country).toBe('CH');
      expect(updated?.place?.status).toBe('mod-verified');
      expect(updated?.takenAt).toBeDefined();
    });

    it('rejects tagging when user is not author and not moderator', async () => {
      await saveGalleryItem(createSampleItem(), mockRedis);
      const router = createFormsRouter(
        mockRedis,
        vi.fn().mockResolvedValue(false)
      );

      const res = await router.request('/tag-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: 't3_form_target',
          location: 'Paris, France',
        }),
      });

      expect(res.status).toBe(403);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toBe(
        'Only the author or moderators can tag this location'
      );
    });

    it('returns error toast when place is ambiguous without country/region hint', async () => {
      await saveGalleryItem(createSampleItem(), mockRedis);
      const router = createFormsRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/tag-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: 't3_form_target',
          location: 'Cambridge',
        }),
      });

      expect(res.status).toBe(400);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toContain('Ambiguous place');
    });

    it('returns error toast when place cannot be resolved', async () => {
      await saveGalleryItem(createSampleItem(), mockRedis);
      const router = createFormsRouter(
        mockRedis,
        vi.fn().mockResolvedValue(true)
      );

      const res = await router.request('/tag-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: 't3_form_target',
          location: 'Nowhere Galaxy 42',
        }),
      });

      expect(res.status).toBe(400);
      const body: { showToast?: string } = await res.json();
      expect(body.showToast).toContain('Could not resolve place');
    });
  });
});
