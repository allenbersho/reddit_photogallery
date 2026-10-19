import { reddit } from '@devvit/web/server';
import type { RedditPostLike } from '../core/postCapture.js';
import {
  getJobState,
  getTimelinePage,
  removeGalleryItem,
  setJobState,
  type RedisClientContract,
} from '../data/galleryStore.js';

export type ReconcileResult = {
  status: 'ok';
  checkedCount: number;
  purgedCount: number;
  nextCursor?: string;
};

export type RedditClientForReconcile = {
  getPostById(id: string): Promise<RedditPostLike | undefined>;
};

export const runReconcileJob = async (
  redisClient?: RedisClientContract,
  redditClient: RedditClientForReconcile = reddit
): Promise<ReconcileResult> => {
  const BATCH_SIZE = 20;
  const cursor =
    (await getJobState('reconcile_cursor', redisClient)) ?? undefined;

  const page = await getTimelinePage(
    {
      limit: BATCH_SIZE,
      cursor,
    },
    redisClient
  );

  let purgedCount = 0;
  for (const item of page.items) {
    try {
      // 1. Verify child post in installed subreddit
      const post = await redditClient.getPostById(item.id);
      if (
        !post ||
        post.removed ||
        post.spam ||
        post.nsfw ||
        post.authorName === '[deleted]'
      ) {
        await removeGalleryItem(item.id, redisClient);
        purgedCount += 1;
        continue;
      }

      // 2. If crosspost, verify original parent post
      if (item.isCrosspost && item.crosspostParentId) {
        try {
          const parentPost = await redditClient.getPostById(
            item.crosspostParentId
          );
          if (
            !parentPost ||
            parentPost.removed ||
            parentPost.spam ||
            parentPost.nsfw ||
            parentPost.authorName === '[deleted]'
          ) {
            await removeGalleryItem(item.id, redisClient);
            purgedCount += 1;
            continue;
          }
        } catch {
          // Parent post thrown error (inaccessible, private, banned, deleted)
          await removeGalleryItem(item.id, redisClient);
          purgedCount += 1;
          continue;
        }
      }
    } catch {
      // If fetching post throws (e.g. 404 or deleted from reddit), remove from gallery
      await removeGalleryItem(item.id, redisClient);
      purgedCount += 1;
    }
  }

  if (page.hasMore && page.nextCursor) {
    await setJobState('reconcile_cursor', page.nextCursor, redisClient);
  } else {
    // Reached end of index; reset cursor for next full cycle
    await setJobState('reconcile_cursor', '', redisClient);
  }

  await setJobState('last_reconcile_at', Date.now().toString(), redisClient);

  return {
    status: 'ok',
    checkedCount: page.items.length,
    purgedCount,
    nextCursor: page.nextCursor,
  };
};
