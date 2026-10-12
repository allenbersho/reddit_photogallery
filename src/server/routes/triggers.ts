import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostCreateRequest,
  OnPostDeleteRequest,
} from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { createPost } from '../core/post.js';
import { buildGalleryItemFromPost } from '../core/postCapture.js';
import {
  removeGalleryItem,
  saveGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';

export type TriggerResult = {
  status: 'success' | 'error';
  message: string;
};

export const createTriggersRouter = (
  redisClient: RedisClientContract = redis
): Hono => {
  const router = new Hono();

  router.post('/on-app-install', async (c) => {
    try {
      const post = await createPost();
      const input = await c.req.json<OnAppInstallRequest>();

      return c.json<TriggerResult>(
        {
          status: 'success',
          message: `Post created in subreddit ${context.subredditName} with id ${post.id} (trigger: ${input.type})`,
        },
        200
      );
    } catch (error) {
      console.error(`Error creating post: ${error}`);
      return c.json<TriggerResult>(
        {
          status: 'error',
          message: 'Failed to create post',
        },
        400
      );
    }
  });

  router.post('/on-post-create', async (c) => {
    try {
      const input = await c.req.json<OnPostCreateRequest>();
      if (!input.post) {
        return c.json<TriggerResult>(
          {
            status: 'error',
            message: 'Missing post in event payload',
          },
          400
        );
      }

      const galleryItem = buildGalleryItemFromPost(
        input.post,
        input.author?.name,
        input.subreddit?.name
      );

      if (!galleryItem) {
        return c.json<TriggerResult>(
          {
            status: 'success',
            message: 'Post skipped: not an eligible SFW image post',
          },
          200
        );
      }

      await saveGalleryItem(galleryItem, redisClient);
      return c.json<TriggerResult>(
        {
          status: 'success',
          message: `Captured post ${galleryItem.id} into gallery`,
        },
        200
      );
    } catch (error) {
      console.error(`Error processing onPostCreate trigger: ${error}`);
      return c.json<TriggerResult>(
        {
          status: 'error',
          message: 'Failed to process onPostCreate trigger',
        },
        500
      );
    }
  });

  router.post('/on-post-delete', async (c) => {
    try {
      const input = await c.req.json<OnPostDeleteRequest>();
      if (!input.postId) {
        return c.json<TriggerResult>(
          {
            status: 'error',
            message: 'Missing postId in event payload',
          },
          400
        );
      }

      const removed = await removeGalleryItem(input.postId, redisClient);
      return c.json<TriggerResult>(
        {
          status: 'success',
          message: removed
            ? `Removed post ${input.postId} from gallery`
            : `Post ${input.postId} not present in gallery`,
        },
        200
      );
    } catch (error) {
      console.error(`Error processing onPostDelete trigger: ${error}`);
      return c.json<TriggerResult>(
        {
          status: 'error',
          message: 'Failed to process onPostDelete trigger',
        },
        500
      );
    }
  });

  return router;
};

export const triggers = createTriggersRouter();
