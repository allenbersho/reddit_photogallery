import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GalleryItem } from '../../shared/types.js';
import {
  getGalleryItem,
  saveGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';
import { createApiRouter, type ModActionResponse } from './api.js';

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
});
