import { describe, expect, it } from 'vitest';
import type { PostV2 } from '@devvit/protos/json/devvit/reddit/v2alpha/postv2.js';
import { extractMediaAsset, isEligibleImagePost } from './postCapture.js';
import { createMockRedis } from '../data/mockRedis.js';
import {
  getGalleryItem,
  removeGalleryItem,
  saveGalleryItem,
  setGalleryItemModHidden,
} from '../data/galleryStore.js';
import type { GalleryItem } from '../../shared/types.js';

describe('Task 6.3: Security, Compliance & Devvit Content Policy', () => {
  it('strictly rejects NSFW posts from entering the gallery', () => {
    const nsfwPost: Partial<PostV2> = {
      id: 't3_nsfw1',
      title: 'NSFW Content',
      authorId: 'user1',
      subredditId: 'science',
      nsfw: true,
      url: 'https://i.redd.it/nsfw.jpg',
      isImage: true,
    };

    expect(isEligibleImagePost(nsfwPost as PostV2)).toBe(false);
  });

  it('strictly rejects external non-image URLs from being captured', () => {
    const externalPost: Partial<PostV2> = {
      id: 't3_ext1',
      title: 'External link',
      authorId: 'user2',
      subredditId: 'science',
      nsfw: false,
      url: 'https://external-untrusted-site.com/article',
      isSelf: true,
    };

    expect(isEligibleImagePost(externalPost as PostV2)).toBe(false);
  });

  it('extracts media asset for valid Reddit-hosted images', () => {
    const validPost: Partial<PostV2> = {
      id: 't3_valid1',
      title: 'Valid Reddit image',
      authorId: 'user3',
      subredditId: 'science',
      nsfw: false,
      url: 'https://i.redd.it/valid.jpg',
      isImage: true,
    };

    expect(isEligibleImagePost(validPost as PostV2)).toBe(true);
    const media = extractMediaAsset(validPost as PostV2);
    expect(media).not.toBeNull();
    expect(media?.url).toBe('https://i.redd.it/valid.jpg');
  });

  it('guarantees removed or deleted posts are purged and unavailable in gallery store', async () => {
    const redis = createMockRedis();

    const item: GalleryItem = {
      id: 't3_todelete',
      permalink: '/r/science/comments/todelete',
      title: 'Post to be removed',
      author: 'poster1',
      subreddit: 'science',
      createdAt: 1700000000,
      media: { url: 'https://i.redd.it/sample.jpg', width: 800, height: 600 },
      disciplines: ['Biology'],
      disciplinesSource: 'poster-tagged',
      impacts: ['Home'],
      impactsSource: 'poster-tagged',
      isCrosspost: false,
      topic: 'science',
      topicSource: 'default',
      isModHidden: false,
      isNsfw: false,
      isRemoved: false,
      capturedAt: 1700000000000,
      lastVerifiedAt: 1700000000000,
    };

    await saveGalleryItem(item, redis);
    expect(await getGalleryItem('t3_todelete', redis)).not.toBeNull();

    // Remove upon Reddit post deletion trigger or reconcile
    await removeGalleryItem('t3_todelete', redis);
    expect(await getGalleryItem('t3_todelete', redis)).toBeNull();
  });

  it('ensures mod-hidden items are marked and protected from public views', async () => {
    const redis = createMockRedis();

    const item: GalleryItem = {
      id: 't3_modtarget',
      permalink: '/r/science/comments/modtarget',
      title: 'Mod Target',
      author: 'poster2',
      subreddit: 'science',
      createdAt: 1700000000,
      media: { url: 'https://i.redd.it/sample.jpg', width: 800, height: 600 },
      disciplines: ['Biology'],
      disciplinesSource: 'poster-tagged',
      impacts: ['Home'],
      impactsSource: 'poster-tagged',
      isCrosspost: false,
      topic: 'science',
      topicSource: 'default',
      isModHidden: false,
      isNsfw: false,
      isRemoved: false,
      capturedAt: 1700000000000,
      lastVerifiedAt: 1700000000000,
    };

    await saveGalleryItem(item, redis);

    // Mod hides post
    await setGalleryItemModHidden('t3_modtarget', true, redis);
    const hiddenItem = await getGalleryItem('t3_modtarget', redis);
    expect(hiddenItem?.isModHidden).toBe(true);

    // Mod unhides post
    await setGalleryItemModHidden('t3_modtarget', false, redis);
    const unhiddenItem = await getGalleryItem('t3_modtarget', redis);
    expect(unhiddenItem?.isModHidden).toBe(false);
  });
});
