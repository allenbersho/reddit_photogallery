import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api.js';
import type {
  GalleryItem,
  PlaceHierarchyNode,
  PlacesSummary,
  PlaceStatus,
  TimelinePage,
  TimelineQueryParams,
  TimelineSummary,
  Topic,
} from '../../shared/types.js';
import { resolvePlace, toPlaceLocation } from '../core/placeResolver.js';
import {
  getGalleryItem,
  getPlacesHierarchy,
  getPlacesSummary,
  getTimelinePage,
  getTimelineSummary,
  getUserFavorites,
  isUserFavorite,
  searchGallery,
  setGalleryItemModHidden,
  toggleUserFavorite,
  updateGalleryItemLocation,
  type RedisClientContract,
} from '../data/galleryStore.js';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export type ModActionResponse = {
  success: boolean;
  id: string;
  isModHidden: boolean;
};

export type ModeratorChecker = (
  username?: string,
  subredditName?: string
) => Promise<boolean>;

export const defaultModeratorChecker: ModeratorChecker = async (
  username?: string,
  subredditName?: string
): Promise<boolean> => {
  if (!username || !subredditName) {
    return false;
  }
  try {
    const moderators = await reddit.getModerators({ subredditName }).all();
    return moderators.some(
      (m) => m.username?.toLowerCase() === username.toLowerCase()
    );
  } catch (error) {
    console.warn('Failed to verify moderator status:', error);
    return false;
  }
};

const getCallerUsername = async (): Promise<string | undefined> => {
  try {
    if (context.username) {
      return context.username;
    }
  } catch {
    // context may not be available outside request
  }
  try {
    const username = await reddit.getCurrentUsername();
    return username ?? undefined;
  } catch {
    return undefined;
  }
};

const getSubredditNameSafely = (): string | undefined => {
  try {
    return context.subredditName;
  } catch {
    return undefined;
  }
};

const isTopic = (value: string): value is Topic =>
  value === 'science' ||
  value === 'engineering' ||
  value === 'art' ||
  value === 'other';

const isPlaceType = (
  value: string
): value is 'country' | 'region' | 'city' | 'unplaced' =>
  value === 'country' ||
  value === 'region' ||
  value === 'city' ||
  value === 'unplaced';

export type UsernameProvider = () => Promise<string | undefined>;

export const defaultUsernameProvider: UsernameProvider = getCallerUsername;

export const createApiRouter = (
  redisClient: RedisClientContract = redis,
  isModerator: ModeratorChecker = defaultModeratorChecker,
  getUsername: UsernameProvider = defaultUsernameProvider
): Hono => {
  const router = new Hono();

  router.get('/init', async (c) => {
    let postId: string | undefined;
    try {
      postId = context.postId;
    } catch {
      // outside context
    }

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'postId is required but missing from context',
        },
        400
      );
    }

    try {
      const [count, username] = await Promise.all([
        redisClient.get('count'),
        reddit.getCurrentUsername(),
      ]);

      return c.json<InitResponse>({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count, 10) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      return c.json<ErrorResponse>(
        { status: 'error', message: errorMessage },
        400
      );
    }
  });

  router.post('/increment', async (c) => {
    let postId: string | undefined;
    try {
      postId = context.postId;
    } catch {
      // outside context
    }
    if (!postId) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'postId is required',
        },
        400
      );
    }

    const count = await redis.incrBy('count', 1);
    return c.json<IncrementResponse>({
      count,
      postId,
      type: 'increment',
    });
  });

  router.post('/decrement', async (c) => {
    let postId: string | undefined;
    try {
      postId = context.postId;
    } catch {
      // outside context
    }
    if (!postId) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'postId is required',
        },
        400
      );
    }

    const count = await redis.incrBy('count', -1);
    return c.json<DecrementResponse>({
      count,
      postId,
      type: 'decrement',
    });
  });

  // Moderator endpoint: Hide gallery item
  router.post('/gallery/:id/hide', async (c) => {
    const id = c.req.param('id');
    const username = await getUsername();
    const subredditName = getSubredditNameSafely();

    const authorized = await isModerator(username, subredditName);
    if (!authorized) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'Moderator permissions required',
        },
        403
      );
    }

    const success = await setGalleryItemModHidden(id, true, redisClient);
    if (!success) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'Gallery item not found',
        },
        404
      );
    }

    return c.json<ModActionResponse>(
      {
        success: true,
        id,
        isModHidden: true,
      },
      200
    );
  });

  // Moderator endpoint: Unhide gallery item
  router.post('/gallery/:id/unhide', async (c) => {
    const id = c.req.param('id');
    const username = await getUsername();
    const subredditName = getSubredditNameSafely();

    const authorized = await isModerator(username, subredditName);
    if (!authorized) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'Moderator permissions required',
        },
        403
      );
    }

    const success = await setGalleryItemModHidden(id, false, redisClient);
    if (!success) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'Gallery item not found',
        },
        404
      );
    }

    return c.json<ModActionResponse>(
      {
        success: true,
        id,
        isModHidden: false,
      },
      200
    );
  });

  // Timeline page
  router.get('/gallery/timeline', async (c) => {
    const limitQuery = c.req.query('limit');
    const cursor = c.req.query('cursor');
    const topicQuery = c.req.query('topic');
    const placeTypeQuery = c.req.query('placeType');
    const placeKey = c.req.query('placeKey');
    const yearQuery = c.req.query('year');
    const monthQuery = c.req.query('month');
    const includeHiddenQuery = c.req.query('includeHidden');

    let limit: number | undefined;
    if (limitQuery !== undefined) {
      const parsedLimit = Number.parseInt(limitQuery, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
        return c.json<ErrorResponse>(
          { status: 'error', message: 'limit must be a positive integer' },
          400
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    let topic: Topic | undefined;
    if (topicQuery !== undefined) {
      if (!isTopic(topicQuery)) {
        return c.json<ErrorResponse>(
          { status: 'error', message: `Invalid topic: ${topicQuery}` },
          400
        );
      }
      topic = topicQuery;
    }

    let placeType: 'country' | 'region' | 'city' | 'unplaced' | undefined;
    if (placeTypeQuery !== undefined) {
      if (!isPlaceType(placeTypeQuery)) {
        return c.json<ErrorResponse>(
          { status: 'error', message: `Invalid placeType: ${placeTypeQuery}` },
          400
        );
      }
      placeType = placeTypeQuery;
    }

    let year: number | undefined;
    if (yearQuery !== undefined) {
      const parsedYear = Number.parseInt(yearQuery, 10);
      if (Number.isNaN(parsedYear) || parsedYear < 2005 || parsedYear > 2100) {
        return c.json<ErrorResponse>(
          { status: 'error', message: 'Invalid year' },
          400
        );
      }
      year = parsedYear;
    }

    let month: number | undefined;
    if (monthQuery !== undefined) {
      if (year === undefined) {
        return c.json<ErrorResponse>(
          {
            status: 'error',
            message: 'year is required when month is specified',
          },
          400
        );
      }
      const parsedMonth = Number.parseInt(monthQuery, 10);
      if (Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        return c.json<ErrorResponse>(
          {
            status: 'error',
            message: 'Invalid month, must be between 1 and 12',
          },
          400
        );
      }
      month = parsedMonth;
    }

    let includeHidden = false;
    if (includeHiddenQuery === 'true') {
      const username = await getUsername();
      const subredditName = getSubredditNameSafely();
      includeHidden = await isModerator(username, subredditName);
    }

    const queryParams: TimelineQueryParams = {
      cursor,
      includeHidden,
      limit,
      month,
      placeKey,
      placeType,
      topic,
      year,
    };

    const page = await getTimelinePage(queryParams, redisClient);
    return c.json<TimelinePage>(page, 200);
  });

  // Timeline summary
  router.get('/gallery/timeline/summary', async (c) => {
    const summary = await getTimelineSummary(redisClient);
    return c.json<TimelineSummary>(summary, 200);
  });

  // Places summary (default places endpoint)
  router.get('/gallery/places', async (c) => {
    const summary = await getPlacesSummary(redisClient);
    return c.json<PlacesSummary>(summary, 200);
  });

  // Places hierarchy
  router.get('/gallery/places/hierarchy', async (c) => {
    const hierarchy = await getPlacesHierarchy(redisClient);
    return c.json<PlaceHierarchyNode[]>(hierarchy, 200);
  });

  // Places summary (hierarchy + unplaced count)
  router.get('/gallery/places/summary', async (c) => {
    const summary = await getPlacesSummary(redisClient);
    return c.json<PlacesSummary>(summary, 200);
  });

  // Items for unplaced posts
  router.get('/gallery/places/unplaced/items', async (c) => {
    const limitQuery = c.req.query('limit');
    const cursor = c.req.query('cursor');
    const includeHiddenQuery = c.req.query('includeHidden');

    let limit: number | undefined;
    if (limitQuery !== undefined) {
      const parsedLimit = Number.parseInt(limitQuery, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
        return c.json<ErrorResponse>(
          { status: 'error', message: 'limit must be a positive integer' },
          400
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    let includeHidden = false;
    if (includeHiddenQuery === 'true') {
      const username = await getUsername();
      const subredditName = getSubredditNameSafely();
      includeHidden = await isModerator(username, subredditName);
    }

    const page = await getTimelinePage(
      {
        cursor,
        includeHidden,
        limit,
        placeType: 'unplaced',
      },
      redisClient
    );

    return c.json<TimelinePage>(page, 200);
  });

  // Items by place (country, region, or city)
  router.get('/gallery/places/:placeType/:placeKey/items', async (c) => {
    const placeTypeParam = c.req.param('placeType');
    const placeKey = c.req.param('placeKey');

    if (
      placeTypeParam !== 'country' &&
      placeTypeParam !== 'region' &&
      placeTypeParam !== 'city'
    ) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'Invalid placeType. Must be country, region, or city',
        },
        400
      );
    }

    const limitQuery = c.req.query('limit');
    const cursor = c.req.query('cursor');
    const includeHiddenQuery = c.req.query('includeHidden');

    let limit: number | undefined;
    if (limitQuery !== undefined) {
      const parsedLimit = Number.parseInt(limitQuery, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
        return c.json<ErrorResponse>(
          { status: 'error', message: 'limit must be a positive integer' },
          400
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    let includeHidden = false;
    if (includeHiddenQuery === 'true') {
      const username = await getUsername();
      const subredditName = getSubredditNameSafely();
      includeHidden = await isModerator(username, subredditName);
    }

    const page = await getTimelinePage(
      {
        cursor,
        includeHidden,
        limit,
        placeKey,
        placeType: placeTypeParam,
      },
      redisClient
    );

    return c.json<TimelinePage>(page, 200);
  });

  // Item detail
  router.get('/gallery/item/:id', async (c) => {
    const id = c.req.param('id');
    const item = await getGalleryItem(id, redisClient);

    if (!item || item.isRemoved) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Gallery item not found' },
        404
      );
    }

    if (item.isModHidden) {
      const username = await getUsername();
      const subredditName = getSubredditNameSafely();
      const isMod = await isModerator(username, subredditName);
      if (!isMod) {
        return c.json<ErrorResponse>(
          { status: 'error', message: 'Gallery item not found' },
          404
        );
      }
    }

    return c.json<{ item: GalleryItem }>({ item }, 200);
  });

  // Title keyword search
  router.get('/gallery/search', async (c) => {
    const q = c.req.query('q');
    if (!q || !q.trim()) {
      return c.json<ErrorResponse>(
        { status: 'error', message: "Query parameter 'q' is required" },
        400
      );
    }

    const limitQuery = c.req.query('limit');
    const cursor = c.req.query('cursor');
    const includeHiddenQuery = c.req.query('includeHidden');

    let limit: number | undefined;
    if (limitQuery !== undefined) {
      const parsedLimit = Number.parseInt(limitQuery, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
        return c.json<ErrorResponse>(
          { status: 'error', message: 'limit must be a positive integer' },
          400
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    let includeHidden = false;
    if (includeHiddenQuery === 'true') {
      const username = await getUsername();
      const subredditName = getSubredditNameSafely();
      includeHidden = await isModerator(username, subredditName);
    }

    const page = await searchGallery(
      {
        cursor,
        includeHidden,
        limit,
        query: q.trim(),
      },
      redisClient
    );

    return c.json<TimelinePage>(page, 200);
  });

  // Tag or update location for a gallery item
  router.post('/gallery/:id/location', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ location?: string; takenDate?: string }>();
    const locationInput = body.location?.trim() || '';

    if (!locationInput) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Location is required' },
        400
      );
    }

    const item = await getGalleryItem(id, redisClient);
    if (!item) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Gallery item not found' },
        404
      );
    }

    const username = await getUsername();
    const subredditName = getSubredditNameSafely();
    const isAuthor =
      username !== undefined &&
      item.author.toLowerCase() === username.toLowerCase();
    const isMod = await isModerator(username, subredditName);

    if (!isAuthor && !isMod) {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message: 'Only the author or moderators can tag this location',
        },
        403
      );
    }

    const resolved = resolvePlace(locationInput);
    if (resolved.status === 'unresolved') {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message:
            'Could not resolve place. Try "City, Country" (e.g. Tokyo, Japan)',
        },
        400
      );
    }

    if (resolved.status === 'ambiguous') {
      return c.json<ErrorResponse>(
        {
          status: 'error',
          message:
            'Ambiguous place. Please include country or region (e.g. Cambridge, UK or Cambridge, US)',
        },
        400
      );
    }

    const placeStatus: PlaceStatus = isMod ? 'mod-verified' : 'poster-tagged';
    const place = toPlaceLocation(resolved.place, placeStatus);

    let takenAtEpoch: number | undefined;
    if (body.takenDate && /^\d{4}-\d{2}-\d{2}$/.test(body.takenDate)) {
      const parsedEpoch = Date.parse(body.takenDate);
      if (!Number.isNaN(parsedEpoch)) {
        takenAtEpoch = Math.floor(parsedEpoch / 1000);
      }
    }

    const updated = await updateGalleryItemLocation(
      id,
      place,
      takenAtEpoch,
      redisClient
    );

    if (!updated) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Failed to update location' },
        500
      );
    }

    return c.json<{ success: boolean; item: GalleryItem }>(
      { success: true, item: updated },
      200
    );
  });

  // Get user favorites
  router.get('/gallery/favorites', async (c) => {
    const username = await getUsername();
    if (!username) {
      return c.json<TimelinePage>(
        { items: [], hasMore: false, totalCount: 0 },
        200
      );
    }

    const limitQuery = c.req.query('limit');
    const cursor = c.req.query('cursor');

    let limit: number | undefined;
    if (limitQuery !== undefined) {
      const parsedLimit = Number.parseInt(limitQuery, 10);
      if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
        return c.json<ErrorResponse>(
          { status: 'error', message: 'limit must be a positive integer' },
          400
        );
      }
      limit = Math.min(parsedLimit, 100);
    }

    const page = await getUserFavorites(username, { limit, cursor }, redisClient);
    return c.json<TimelinePage>(page, 200);
  });

  // Toggle favorite for an item
  router.post('/gallery/:id/favorite', async (c) => {
    const id = c.req.param('id');
    const username = await getUsername();
    if (!username) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Authentication required to toggle favorite' },
        401
      );
    }

    const item = await getGalleryItem(id, redisClient);
    if (!item || item.isRemoved) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Gallery item not found' },
        404
      );
    }

    const result = await toggleUserFavorite(username, id, redisClient);
    return c.json<{ id: string; isFavorite: boolean }>({ id, isFavorite: result.isFavorite }, 200);
  });

  // Check if item is favorite
  router.get('/gallery/:id/favorite', async (c) => {
    const id = c.req.param('id');
    const username = await getUsername();
    if (!username) {
      return c.json<{ id: string; isFavorite: boolean }>({ id, isFavorite: false }, 200);
    }

    const isFav = await isUserFavorite(username, id, redisClient);
    return c.json<{ id: string; isFavorite: boolean }>({ id, isFavorite: isFav }, 200);
  });

  return router;
};

export const api = createApiRouter();
