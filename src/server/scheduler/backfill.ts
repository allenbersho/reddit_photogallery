import { context, reddit } from '@devvit/web/server';
import {
  loadCrosspostSettings,
} from '../core/crosspostSettings.js';
import {
  buildGalleryItemFromCrosspost,
  buildGalleryItemFromRedditPost,
  type ChildPostInfo,
  type RedditPostLike,
} from '../core/postCapture.js';
import {
  loadTopicRules,
  type SettingsClientContract,
} from '../core/topicSettings.js';
import {
  getJobState,
  isCrosspostDuplicate,
  recordCrosspostDuplicate,
  saveGalleryItem,
  setJobState,
  type RedisClientContract,
} from '../data/galleryStore.js';

export type BackfillResult = {
  status: 'in_progress' | 'completed';
  fetchedCount: number;
  indexedCount: number;
  nextCursor?: string;
};

export type RedditClientForBackfill = {
  getNewPosts(options: {
    subredditName?: string;
    limit?: number;
    after?: string;
  }): {
    all(): Promise<RedditPostLike[]>;
  };
  getPostById?(id: string): Promise<RedditPostLike | undefined>;
};

const getSubredditNameSafely = (): string | undefined => {
  try {
    return context.subredditName;
  } catch {
    return undefined;
  }
};

export const runBackfillJob = async (
  redisClient?: RedisClientContract,
  redditClient: RedditClientForBackfill = reddit,
  subredditName?: string,
  settingsClient?: SettingsClientContract
): Promise<BackfillResult> => {
  const BATCH_SIZE = 25;
  const cursor = await getJobState('backfill_cursor', redisClient);
  const targetSubreddit = subredditName || getSubredditNameSafely();
  const rules = await loadTopicRules(settingsClient);
  const crosspostSettings = await loadCrosspostSettings(settingsClient);

  const posts = await redditClient
    .getNewPosts({
      subredditName: targetSubreddit,
      limit: BATCH_SIZE,
      after: cursor ?? undefined,
    })
    .all();

  if (posts.length === 0) {
    await setJobState('backfill_status', 'completed', redisClient);
    return {
      status: 'completed',
      fetchedCount: 0,
      indexedCount: 0,
    };
  }

  let indexedCount = 0;
  for (const post of posts) {
    // 1. Check if post is a crosspost
    if (post.crosspostParentId && post.crosspostParentId.trim().length > 0) {
      const isDupe = await isCrosspostDuplicate(
        post.crosspostParentId,
        redisClient
      );
      if (isDupe) {
        await recordCrosspostDuplicate(
          post.crosspostParentId,
          post.id,
          redisClient
        );
        continue;
      }

      try {
        const getParent =
          redditClient.getPostById ??
          ((id: string) => reddit.getPostById(id as `t3_${string}`));
        const parentPost = await getParent(post.crosspostParentId);
        if (!parentPost) {
          continue;
        }

        const childInfo: ChildPostInfo = {
          id: post.id,
          title: post.title,
          permalink: post.permalink,
          authorName: post.authorName,
          subredditName: post.subredditName,
          createdAt: post.createdAt,
          nsfw: post.nsfw,
          removed: post.removed,
          spam: post.spam,
          flairText: post.flair?.text,
        };

        const { item: crosspostItem } = buildGalleryItemFromCrosspost(
          childInfo,
          parentPost,
          crosspostSettings,
          rules
        );

        if (crosspostItem) {
          await saveGalleryItem(crosspostItem, redisClient);
          indexedCount += 1;
        }
      } catch (err) {
        console.warn(
          `Backfill: failed to resolve parent ${post.crosspostParentId} for crosspost ${post.id}:`,
          err
        );
      }
      continue;
    }

    // 2. Native image post
    const item = buildGalleryItemFromRedditPost(post, rules);
    if (item) {
      await saveGalleryItem(item, redisClient);
      indexedCount += 1;
    }
  }

  const lastPost = posts[posts.length - 1];
  const nextCursor = lastPost?.id;

  if (nextCursor) {
    await setJobState('backfill_cursor', nextCursor, redisClient);
    await setJobState('backfill_last_run', Date.now().toString(), redisClient);
  }

  const isComplete = posts.length < BATCH_SIZE;
  if (isComplete) {
    await setJobState('backfill_status', 'completed', redisClient);
  }

  return {
    status: isComplete ? 'completed' : 'in_progress',
    fetchedCount: posts.length,
    indexedCount,
    nextCursor: isComplete ? undefined : nextCursor,
  };
};
