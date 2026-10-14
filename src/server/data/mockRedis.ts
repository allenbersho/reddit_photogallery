import type { RedisClientContract } from './galleryStore.js';

// In-memory mock implementing RedisClientContract for unit testing & benchmarks
export const createMockRedis = (): RedisClientContract => {
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
      let added = 0;
      for (const m of members) {
        if (!zmap.has(m.member)) {
          added += 1;
        }
        zmap.set(m.member, m.score);
      }
      return added;
    },
    async zRange(
      key: string,
      start: number | string,
      stop: number | string,
      options?: {
        reverse?: boolean;
        by: 'score' | 'lex' | 'rank';
        limit?: { offset: number; count: number };
      }
    ): Promise<{ member: string; score: number }[]> {
      const zmap = zsets.get(key);
      if (!zmap) {
        return [];
      }
      let sorted = Array.from(zmap.entries()).map(([member, score]) => ({
        member,
        score,
      }));

      // Sort by score
      sorted.sort((a, b) => {
        if (options?.reverse) {
          return b.score - a.score;
        }
        return a.score - b.score;
      });

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
    async zRem(key: string, members: string[]): Promise<number> {
      const zmap = zsets.get(key);
      if (!zmap) {
        return 0;
      }
      let removed = 0;
      for (const m of members) {
        if (zmap.delete(m)) {
          removed += 1;
        }
      }
      return removed;
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
      let count = 0;
      for (const [k, v] of Object.entries(fieldValues)) {
        if (!hmap.has(k)) {
          count += 1;
        }
        hmap.set(k, v);
      }
      return count;
    },
    async hIncrBy(key: string, field: string, value: number): Promise<number> {
      let hmap = hashes.get(key);
      if (!hmap) {
        hmap = new Map<string, string>();
        hashes.set(key, hmap);
      }
      const current = Number.parseInt(hmap.get(field) ?? '0', 10);
      const next = (Number.isNaN(current) ? 0 : current) + value;
      hmap.set(field, next.toString());
      return next;
    },
    async hGetAll(key: string): Promise<Record<string, string>> {
      const hmap = hashes.get(key);
      if (!hmap) {
        return {};
      }
      const result: Record<string, string> = {};
      for (const [k, v] of hmap.entries()) {
        result[k] = v;
      }
      return result;
    },
    async hDel(key: string, fields: string[]): Promise<number> {
      const hmap = hashes.get(key);
      if (!hmap) {
        return 0;
      }
      let deleted = 0;
      for (const f of fields) {
        if (hmap.delete(f)) {
          deleted += 1;
        }
      }
      return deleted;
    },
  };
};
