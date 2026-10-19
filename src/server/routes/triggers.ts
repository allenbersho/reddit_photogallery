import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostCreateRequest,
  OnPostDeleteRequest,
} from '@devvit/web/shared';
import { context, reddit, redis } from '@devvit/web/server';
import {
  loadCrosspostSettings,
} from '../core/crosspostSettings.js';
import { createPost } from '../core/post.js';
import {
  buildGalleryItemFromCrosspost,
  buildGalleryItemFromPost,
  type ChildPostInfo,
  type RedditPostLike,
} from '../core/postCapture.js';
import {
  loadTopicRules,
  type SettingsClientContract,
} from '../core/topicSettings.js';
import {
  isCrosspostDuplicate,
  recordCrosspostDuplicate,
  removeGalleryItem,
  saveGalleryItem,
  type RedisClientContract,
} from '../data/galleryStore.js';

export type TriggerResult = {
  status: 'success' | 'error';
  message: string;
};

export type RedditClientForTriggers = {
  getPostById(id: string): Promise<RedditPostLike | undefined>;
};

export const createTriggersRouter = (
  redisClient: RedisClientContract = redis,
  settingsClient?: SettingsClientContract,
  redditClient: RedditClientForTriggers = reddit
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

      const rules = await loadTopicRules(settingsClient);
      const crosspostSettings = await loadCrosspostSettings(settingsClient);

      // Check if post is a crosspost
      const crosspostParentId = input.post.crosspostParentId;
      if (crosspostParentId && crosspostParentId.trim().length > 0) {
        // Dedupe check
        const isDupe = await isCrosspostDuplicate(
          crosspostParentId,
          redisClient
        );
        if (isDupe) {
          await recordCrosspostDuplicate(
            crosspostParentId,
            input.post.id,
            redisClient
          );
          return c.json<TriggerResult>(
            {
              status: 'success',
              message: `Crosspost ${input.post.id} skipped: parent ${crosspostParentId} is already captured`,
            },
            200
          );
        }

        try {
          const parentPost = await redditClient.getPostById(crosspostParentId);
          if (!parentPost) {
            return c.json<TriggerResult>(
              {
                status: 'success',
                message: `Crosspost ${input.post.id} skipped: parent ${crosspostParentId} not found`,
              },
              200
            );
          }

          const childInfo: ChildPostInfo = {
            id: input.post.id,
            title: input.post.title,
            permalink: input.post.permalink,
            authorName: input.author?.name,
            subredditName: input.subreddit?.name,
            createdAt: input.post.createdAt,
            nsfw: input.post.nsfw,
            removed: input.post.deleted,
            spam: input.post.spam,
            flairText: input.post.linkFlair?.text,
          };

          const { item: crosspostGalleryItem, reason } =
            buildGalleryItemFromCrosspost(
              childInfo,
              parentPost,
              crosspostSettings,
              rules
            );

          if (!crosspostGalleryItem) {
            return c.json<TriggerResult>(
              {
                status: 'success',
                message: `Crosspost ${input.post.id} skipped: ${reason}`,
              },
              200
            );
          }

          await saveGalleryItem(crosspostGalleryItem, redisClient);
          return c.json<TriggerResult>(
            {
              status: 'success',
              message: `Captured crosspost ${crosspostGalleryItem.id} (original ${crosspostParentId}) into gallery`,
            },
            200
          );
        } catch (err) {
          console.warn(
            `Parent post ${crosspostParentId} cannot be read; skipping crosspost ${input.post.id}:`,
            err
          );
          return c.json<TriggerResult>(
            {
              status: 'success',
              message: `Crosspost ${input.post.id} skipped: parent post ${crosspostParentId} inaccessible`,
            },
            200
          );
        }
      }

      // Plain native post
      const galleryItem = buildGalleryItemFromPost(
        input.post,
        input.author?.name,
        input.subreddit?.name,
        rules
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
