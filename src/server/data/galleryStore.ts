import { redis } from '@devvit/web/server';
import type {
  GalleryItem,
  TimelinePage,
  TimelineQueryParams,
  TimelineSummary,
  Topic,
  YearSummary,
} from '../../shared/types.js';

// Minimal Redis interface matching Devvit's redis client capabilities
export type RedisClientContract = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<string>;
  del(...keys: string[]): Promise<void>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  zAdd(
    key: string,
    ...members: { member: string; score: number }[]
  ): Promise<number>;
  zRange(
    key: string,
    start: number | string,
    stop: number | string,
    options?: {
      reverse?: boolean;
      by: 'score' | 'lex' | 'rank';
      limit?: {
        offset: number;
        count: number;
      };
    }
  ): Promise<{ member: string; score: number }[]>;
  zRem(key: string, members: string[]): Promise<number>;
  zCard(key: string): Promise<number>;
  hGet(key: string, field: string): Promise<string | undefined>;
  hSet(key: string, fieldValues: Record<string, string>): Promise<number>;
  hIncrBy(key: string, field: string, value: number): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, fields: string[]): Promise<number>;
};

// Redis Key prefixes and helper functions
export const REDIS_KEYS = {
  item: (id: string): string => `gallery:item:${id}`,
  idxTime: (): string => 'gallery:idx:time',
  idxTopic: (topic: Topic): string => `gallery:idx:topic:${topic}`,
  idxUnplaced: (): string => 'gallery:idx:place:unplaced',
  idxCountry: (country: string): string =>
    `gallery:idx:place:country:${country.trim().toLowerCase()}`,
  idxRegion: (country: string, region: string): string =>
    `gallery:idx:place:region:${country.trim().toLowerCase()}:${region.trim().toLowerCase()}`,
  idxCity: (country: string, region: string, city: string): string =>
    `gallery:idx:place:city:${country.trim().toLowerCase()}:${region.trim().toLowerCase()}:${city.trim().toLowerCase()}`,
  placesCounts: (): string => 'gallery:places:counts',
  placesCovers: (): string => 'gallery:places:covers',
  timelineCounts: (): string => 'gallery:timeline:counts',
  jobState: (): string => 'gallery:state:jobs',
  favorites: (userId: string): string => `gallery:fav:${userId}`,
};

const formatYearMonth = (
  epochSeconds: number
): { yearStr: string; monthStr: string } => {
  const date = new Date(epochSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const yearStr = `${year}`;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return { yearStr, monthStr };
};

const parseCursor = (cursor?: string): number => {
  if (!cursor) {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = Number.parseInt(decoded, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

const createCursor = (offset: number): string => {
  return Buffer.from(offset.toString(), 'utf8').toString('base64');
};

const getIndexKeyForQuery = (params: TimelineQueryParams): string => {
  if (params.topic) {
    return REDIS_KEYS.idxTopic(params.topic);
  }
  if (params.placeType === 'unplaced') {
    return REDIS_KEYS.idxUnplaced();
  }
  if (params.placeType && params.placeKey) {
    const parts = params.placeKey.split(':');
    const country = parts[0] ?? '';
    const region = parts[1] ?? '';
    const city = parts[2] ?? '';

    if (params.placeType === 'country') {
      return REDIS_KEYS.idxCountry(country);
    }
    if (params.placeType === 'region') {
      return REDIS_KEYS.idxRegion(country, region);
    }
    if (params.placeType === 'city') {
      return REDIS_KEYS.idxCity(country, region, city);
    }
  }
  return REDIS_KEYS.idxTime();
};

export const saveGalleryItem = async (
  item: GalleryItem,
  client: RedisClientContract = redis
): Promise<void> => {
  if (!item.id || !item.createdAt) {
    throw new Error('Invalid gallery item: missing id or createdAt');
  }

  // 1. Store item record
  const itemKey = REDIS_KEYS.item(item.id);
  await client.set(itemKey, JSON.stringify(item));

  // 2. Add to global time index
  const member = { member: item.id, score: item.createdAt };
  await client.zAdd(REDIS_KEYS.idxTime(), member);

  // 3. Add to topic index
  await client.zAdd(REDIS_KEYS.idxTopic(item.topic), member);

  // 4. Update place indexes & hierarchy counters
  if (item.place && item.place.country) {
    const cKey = item.place.country.trim().toLowerCase();
    const rKey = `${cKey}:${item.place.region.trim().toLowerCase()}`;
    const cityKey = `${rKey}:${item.place.city.trim().toLowerCase()}`;

    await client.zAdd(REDIS_KEYS.idxCountry(item.place.country), member);
    if (item.place.region) {
      await client.zAdd(
        REDIS_KEYS.idxRegion(item.place.country, item.place.region),
        member
      );
    }
    if (item.place.city) {
      await client.zAdd(
        REDIS_KEYS.idxCity(
          item.place.country,
          item.place.region,
          item.place.city
        ),
        member
      );
    }

    await client.hIncrBy(REDIS_KEYS.placesCounts(), cKey, 1);
    if (item.place.region) {
      await client.hIncrBy(REDIS_KEYS.placesCounts(), rKey, 1);
    }
    if (item.place.city) {
      await client.hIncrBy(REDIS_KEYS.placesCounts(), cityKey, 1);
    }

    // Set cover photo if not already defined
    const existingCover = await client.hGet(REDIS_KEYS.placesCovers(), cKey);
    if (!existingCover) {
      await client.hSet(REDIS_KEYS.placesCovers(), { [cKey]: item.id });
    }
  } else {
    await client.zAdd(REDIS_KEYS.idxUnplaced(), member);
  }

  // 5. Update timeline summary counters
  const { yearStr, monthStr } = formatYearMonth(item.createdAt);
  await client.hIncrBy(REDIS_KEYS.timelineCounts(), yearStr, 1);
  await client.hIncrBy(REDIS_KEYS.timelineCounts(), monthStr, 1);
};

export const getGalleryItem = async (
  id: string,
  client: RedisClientContract = redis
): Promise<GalleryItem | null> => {
  if (!id) {
    return null;
  }
  const raw = await client.get(REDIS_KEYS.item(id));
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'id' in parsed) {
      return parsed as GalleryItem;
    }
    return null;
  } catch {
    return null;
  }
};

export const getGalleryItems = async (
  ids: string[],
  client: RedisClientContract = redis
): Promise<GalleryItem[]> => {
  if (ids.length === 0) {
    return [];
  }
  const keys = ids.map((id) => REDIS_KEYS.item(id));
  const rawValues = await client.mGet(keys);
  const items: GalleryItem[] = [];

  for (const raw of rawValues) {
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && 'id' in parsed) {
          items.push(parsed as GalleryItem);
        }
      } catch {
        // Skip malformed records
      }
    }
  }
  return items;
};

export const removeGalleryItem = async (
  id: string,
  client: RedisClientContract = redis
): Promise<boolean> => {
  const item = await getGalleryItem(id, client);
  if (!item) {
    return false;
  }

  // 1. Remove from time index
  await client.zRem(REDIS_KEYS.idxTime(), [id]);

  // 2. Remove from topic index
  await client.zRem(REDIS_KEYS.idxTopic(item.topic), [id]);

  // 3. Remove from place index and decrement counters
  if (item.place && item.place.country) {
    const cKey = item.place.country.trim().toLowerCase();
    const rKey = `${cKey}:${item.place.region.trim().toLowerCase()}`;
    const cityKey = `${rKey}:${item.place.city.trim().toLowerCase()}`;

    await client.zRem(REDIS_KEYS.idxCountry(item.place.country), [id]);
    if (item.place.region) {
      await client.zRem(
        REDIS_KEYS.idxRegion(item.place.country, item.place.region),
        [id]
      );
    }
    if (item.place.city) {
      await client.zRem(
        REDIS_KEYS.idxCity(
          item.place.country,
          item.place.region,
          item.place.city
        ),
        [id]
      );
    }

    await client.hIncrBy(REDIS_KEYS.placesCounts(), cKey, -1);
    if (item.place.region) {
      await client.hIncrBy(REDIS_KEYS.placesCounts(), rKey, -1);
    }
    if (item.place.city) {
      await client.hIncrBy(REDIS_KEYS.placesCounts(), cityKey, -1);
    }
  } else {
    await client.zRem(REDIS_KEYS.idxUnplaced(), [id]);
  }

  // 4. Decrement timeline counts
  const { yearStr, monthStr } = formatYearMonth(item.createdAt);
  await client.hIncrBy(REDIS_KEYS.timelineCounts(), yearStr, -1);
  await client.hIncrBy(REDIS_KEYS.timelineCounts(), monthStr, -1);

  // 5. Delete primary item record
  await client.del(REDIS_KEYS.item(id));
  return true;
};

export const setGalleryItemModHidden = async (
  id: string,
  isModHidden: boolean,
  client: RedisClientContract = redis
): Promise<boolean> => {
  const item = await getGalleryItem(id, client);
  if (!item) {
    return false;
  }
  const updatedItem: GalleryItem = {
    ...item,
    isModHidden,
    lastVerifiedAt: Date.now(),
  };
  await client.set(REDIS_KEYS.item(id), JSON.stringify(updatedItem));
  return true;
};

export const getTimelinePage = async (
  params: TimelineQueryParams,
  client: RedisClientContract = redis
): Promise<TimelinePage> => {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = parseCursor(params.cursor);
  const targetKey = getIndexKeyForQuery(params);

  const totalCount = await client.zCard(targetKey);
  if (totalCount === 0 || offset >= totalCount) {
    return {
      items: [],
      hasMore: false,
      totalCount,
    };
  }

  // Retrieve slice by rank with reverse ordering (newest first)
  const rangeResults = await client.zRange(
    targetKey,
    offset,
    offset + limit - 1,
    {
      by: 'rank',
      reverse: true,
    }
  );

  const ids = rangeResults.map((r) => r.member);
  const allItems = await getGalleryItems(ids, client);

  // Exclude hidden or removed items from client view unless includeHidden is true
  const visibleItems = allItems.filter(
    (i) => (params.includeHidden || !i.isModHidden) && !i.isRemoved && !i.isNsfw
  );

  const nextOffset = offset + limit;
  const hasMore = nextOffset < totalCount;

  return {
    items: visibleItems,
    nextCursor: hasMore ? createCursor(nextOffset) : undefined,
    hasMore,
    totalCount,
  };
};

export const getTimelineSummary = async (
  client: RedisClientContract = redis
): Promise<TimelineSummary> => {
  const countsRecord = await client.hGetAll(REDIS_KEYS.timelineCounts());
  const yearMap = new Map<number, YearSummary>();
  let totalCount = 0;

  for (const [key, valStr] of Object.entries(countsRecord)) {
    const count = Number.parseInt(valStr, 10);
    if (!Number.isFinite(count) || count <= 0) {
      continue;
    }

    if (/^\d{4}$/.test(key)) {
      const year = Number.parseInt(key, 10);
      const existing = yearMap.get(year);
      if (existing) {
        existing.count = count;
      } else {
        yearMap.set(year, { year, count, months: [] });
      }
      totalCount += count;
    } else if (/^\d{4}-\d{2}$/.test(key)) {
      const parts = key.split('-');
      const year = Number.parseInt(parts[0] ?? '', 10);
      const month = Number.parseInt(parts[1] ?? '', 10);
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        let entry = yearMap.get(year);
        if (!entry) {
          entry = { year, count: 0, months: [] };
          yearMap.set(year, entry);
        }
        entry.months.push({ month, count });
      }
    }
  }

  const years = Array.from(yearMap.values())
    .sort((a, b) => b.year - a.year)
    .map((y) => ({
      ...y,
      months: y.months.sort((a, b) => b.month - a.month),
    }));

  return {
    years,
    totalCount,
  };
};

export const getJobState = async (
  field: string,
  client: RedisClientContract = redis
): Promise<string | null> => {
  const val = await client.hGet(REDIS_KEYS.jobState(), field);
  return val ?? null;
};

export const setJobState = async (
  field: string,
  value: string,
  client: RedisClientContract = redis
): Promise<void> => {
  await client.hSet(REDIS_KEYS.jobState(), { [field]: value });
};

export const getTopicCounts = async (
  client: RedisClientContract = redis
): Promise<Record<Topic, number>> => {
  const [science, engineering, art, other] = await Promise.all([
    client.zCard(REDIS_KEYS.idxTopic('science')),
    client.zCard(REDIS_KEYS.idxTopic('engineering')),
    client.zCard(REDIS_KEYS.idxTopic('art')),
    client.zCard(REDIS_KEYS.idxTopic('other')),
  ]);
  return { science, engineering, art, other };
};
