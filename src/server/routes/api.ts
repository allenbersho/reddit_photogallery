import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
} from '../../shared/api.js';
import {
  setGalleryItemModHidden,
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

  return router;
};

export const api = createApiRouter();
