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
} from '../../shared/types.js';
import { resolvePlace, toPlaceLocation } from '../core/placeResolver.js';
import {
  getGalleryItem,
  getPlacesHierarchy,
  getPlacesSummary,
  setGalleryItemModHidden,
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

export const createApiRouter = (
  redisClient: RedisClientContract = redis,
  isModerator: ModeratorChecker = defaultModeratorChecker
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
    const username = await getCallerUsername();
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
    const username = await getCallerUsername();
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

    const username = await getCallerUsername();
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

  return router;
};

export const api = createApiRouter();
