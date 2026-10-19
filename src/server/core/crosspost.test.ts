import { describe, expect, it } from 'vitest';
import {
  isSourceSubredditAllowed,
  loadCrosspostSettings,
  type CrosspostSettings,
} from './crosspostSettings.js';
import {
  buildGalleryItemFromCrosspost,
  type ChildPostInfo,
  type RedditPostLike,
} from './postCapture.js';

describe('Crosspost Settings and Evaluation', () => {
  it('correctly parses settings with allowlist and blocklist', async () => {
    const mockSettings = {
      async get(name: string): Promise<unknown> {
        if (name === 'enableCrossposts') return true;
        if (name === 'crosspostAllowlist') return 'science, space, r/physics';
        if (name === 'crosspostBlocklist') return 'memes, r/spam';
        return undefined;
      },
    };

    const config = await loadCrosspostSettings(mockSettings);
    expect(config.enableCrossposts).toBe(true);
    expect(config.allowlist).toEqual(['science', 'space', 'physics']);
    expect(config.blocklist).toEqual(['memes', 'spam']);
  });

  it('evaluates allowlist and blocklist rules accurately', () => {
    const settings: CrosspostSettings = {
      enableCrossposts: true,
      allowlist: ['science', 'space'],
      blocklist: ['memes'],
    };

    expect(isSourceSubredditAllowed('science', settings)).toBe(true);
    expect(isSourceSubredditAllowed('r/space', settings)).toBe(true);
    expect(isSourceSubredditAllowed('gaming', settings)).toBe(false);
    expect(isSourceSubredditAllowed('memes', settings)).toBe(false);

    // When disabled, all are blocked
    const disabledSettings: CrosspostSettings = {
      ...settings,
      enableCrossposts: false,
    };
    expect(isSourceSubredditAllowed('science', disabledSettings)).toBe(false);
  });
});

describe('buildGalleryItemFromCrosspost', () => {
  const sampleParent: RedditPostLike = {
    id: 't3_orig123',
    title: 'James Webb Telescope Deep Field',
    url: 'https://i.redd.it/deepfield.jpg',
    permalink: '/r/astronomy/comments/orig123',
    nsfw: false,
    authorName: 'astro_dan',
    subredditName: 'astronomy',
    createdAt: 1690000000,
    thumbnail: 'https://preview.redd.it/deepfield.jpg',
    flair: { text: 'Science' },
  };

  const sampleChild: ChildPostInfo = {
    id: 't3_cross456',
    title: 'Cross-share: Webb deep field',
    permalink: '/r/photogallery/comments/cross456',
    authorName: 'crossposter_jane',
    subredditName: 'photogallery',
    createdAt: 1700000000,
    nsfw: false,
    removed: false,
    spam: false,
    flairText: 'Tokyo, Japan',
  };

  it('builds an eligible crosspost gallery item with parent and child metadata', () => {
    const { item, reason } = buildGalleryItemFromCrosspost(
      sampleChild,
      sampleParent
    );

    expect(reason).toBeUndefined();
    expect(item).not.toBeNull();
    expect(item?.id).toBe('t3_cross456');
    expect(item?.createdAt).toBe(1700000000); // Primary date is child submission date
    expect(item?.isCrosspost).toBe(true);
    expect(item?.crosspostParentId).toBe('t3_orig123');
    expect(item?.originalSubreddit).toBe('astronomy');
    expect(item?.originalAuthor).toBe('astro_dan');
    expect(item?.originalPermalink).toBe('/r/astronomy/comments/orig123');
    expect(item?.originalCreatedAt).toBe(1690000000);
    expect(item?.crossposterName).toBe('crossposter_jane');
    expect(item?.media.url).toBe('https://i.redd.it/deepfield.jpg');
    expect(item?.place?.city).toBe('Tokyo');
  });

  it('skips crosspost if original parent is NSFW', () => {
    const nsfwParent: RedditPostLike = {
      ...sampleParent,
      nsfw: true,
    };
    const { item, reason } = buildGalleryItemFromCrosspost(
      sampleChild,
      nsfwParent
    );
    expect(item).toBeNull();
    expect(reason).toBe('parent_post_ineligible');
  });

  it('skips crosspost if child post is NSFW', () => {
    const nsfwChild: ChildPostInfo = {
      ...sampleChild,
      nsfw: true,
    };
    const { item, reason } = buildGalleryItemFromCrosspost(
      nsfwChild,
      sampleParent
    );
    expect(item).toBeNull();
    expect(reason).toBe('child_post_ineligible');
  });

  it('skips crosspost if parent post is removed, deleted or spam', () => {
    const removedParent: RedditPostLike = {
      ...sampleParent,
      removed: true,
    };
    const { item: item1 } = buildGalleryItemFromCrosspost(
      sampleChild,
      removedParent
    );
    expect(item1).toBeNull();

    const deletedAuthorParent: RedditPostLike = {
      ...sampleParent,
      authorName: '[deleted]',
    };
    const { item: item2 } = buildGalleryItemFromCrosspost(
      sampleChild,
      deletedAuthorParent
    );
    expect(item2).toBeNull();
  });

  it('skips crosspost if parent has no eligible image', () => {
    const textParent: RedditPostLike = {
      ...sampleParent,
      url: 'https://reddit.com/r/astronomy/comments/orig123',
    };
    const { item, reason } = buildGalleryItemFromCrosspost(
      sampleChild,
      textParent
    );
    expect(item).toBeNull();
    expect(reason).toBe('parent_has_no_eligible_image');
  });

  it('skips crosspost if source subreddit is blocked by settings', () => {
    const settings: CrosspostSettings = {
      enableCrossposts: true,
      allowlist: ['space'],
      blocklist: [],
    };
    const { item, reason } = buildGalleryItemFromCrosspost(
      sampleChild,
      sampleParent,
      settings
    );
    expect(item).toBeNull();
    expect(reason).toContain('source_subreddit_blocked');
  });
});
