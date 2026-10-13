import { Hono, type Context } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { createPost } from '../core/post.js';
import {
  getGalleryItem,
  setGalleryItemModHidden,
  type RedisClientContract,
} from '../data/galleryStore.js';

export type MenuActionPayload = {
  actionId?: string;
  thingId?: string;
  targetId?: string;
  postId?: string;
};

const extractPostId = async (c: Context): Promise<string | undefined> => {
  let bodyPostId: string | undefined;
  try {
    const body = await c.req.json<MenuActionPayload>();
    bodyPostId = body.thingId || body.targetId || body.postId;
  } catch {
    // Body is optional or empty
  }
  let ctxPostId: string | undefined;
  try {
    ctxPostId = context.postId;
  } catch {
    // Context may not be initialized in some mock/test harnesses
  }
  return bodyPostId || ctxPostId;
};

export const createMenuRouter = (
  redisClient: RedisClientContract = redis
): Hono => {
  const router = new Hono();

  router.post('/post-create', async (c) => {
    try {
      const post = await createPost();

      return c.json<UiResponse>(
        {
          navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
        },
        200
      );
    } catch (error) {
      console.error(`Error creating post: ${error}`);
      return c.json<UiResponse>(
        {
          showToast: 'Failed to create post',
        },
        400
      );
    }
  });

  router.post('/mod-hide', async (c) => {
    try {
      const targetId = await extractPostId(c);
      if (!targetId) {
        return c.json<UiResponse>(
          {
            showToast: 'Unable to hide: missing target post ID',
          },
          400
        );
      }

      const success = await setGalleryItemModHidden(
        targetId,
        true,
        redisClient
      );
      if (!success) {
        return c.json<UiResponse>(
          {
            showToast: 'Post is not in the photo gallery',
          },
          404
        );
      }

      return c.json<UiResponse>(
        {
          showToast: 'Post hidden from gallery',
        },
        200
      );
    } catch (error) {
      console.error(`Error in /mod-hide: ${error}`);
      return c.json<UiResponse>(
        {
          showToast: 'Failed to hide post from gallery',
        },
        500
      );
    }
  });

  router.post('/mod-unhide', async (c) => {
    try {
      const targetId = await extractPostId(c);
      if (!targetId) {
        return c.json<UiResponse>(
          {
            showToast: 'Unable to unhide: missing target post ID',
          },
          400
        );
      }

      const success = await setGalleryItemModHidden(
        targetId,
        false,
        redisClient
      );
      if (!success) {
        return c.json<UiResponse>(
          {
            showToast: 'Post is not in the photo gallery',
          },
          404
        );
      }

      return c.json<UiResponse>(
        {
          showToast: 'Post restored to gallery',
        },
        200
      );
    } catch (error) {
      console.error(`Error in /mod-unhide: ${error}`);
      return c.json<UiResponse>(
        {
          showToast: 'Failed to restore post to gallery',
        },
        500
      );
    }
  });

  router.post('/tag-location-open', async (c) => {
    try {
      const targetId = await extractPostId(c);
      if (!targetId) {
        return c.json<UiResponse>(
          {
            showToast: 'Unable to open form: missing target post ID',
          },
          400
        );
      }

      const item = await getGalleryItem(targetId, redisClient);

      return c.json<UiResponse>(
        {
          showForm: {
            name: 'tagLocationForm',
            form: {
              title: 'Tag Photo Location',
              description: 'Tag the place where this photo was taken.',
              acceptLabel: 'Save Location',
              cancelLabel: 'Cancel',
              fields: [
                {
                  type: 'string',
                  name: 'location',
                  label: 'Location (City, Country or Region)',
                  helpText:
                    'e.g. Tokyo, Japan or Paris, France or Cambridge, MA',
                  required: true,
                  defaultValue: item?.place?.raw || '',
                },
                {
                  type: 'string',
                  name: 'takenDate',
                  label: 'Date Taken (optional, YYYY-MM-DD)',
                  helpText: 'e.g. 2024-05-15',
                  required: false,
                  defaultValue: item?.takenAt
                    ? new Date(item.takenAt * 1000).toISOString().split('T')[0]
                    : '',
                },
              ],
            },
            data: {
              postId: targetId,
            },
          },
        },
        200
      );
    } catch (error) {
      console.error(`Error opening tag location form: ${error}`);
      return c.json<UiResponse>(
        {
          showToast: 'Failed to open location tagging form',
        },
        500
      );
    }
  });

  return router;
};

export const menu = createMenuRouter();
