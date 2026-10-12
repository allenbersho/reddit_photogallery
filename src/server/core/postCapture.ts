import type { PostV2 } from '@devvit/protos/json/devvit/reddit/v2alpha/postv2.js';
import type {
  GalleryItem,
  MediaAsset,
  Topic,
  TopicSource,
} from '../../shared/types.js';

export const isEligibleImagePost = (post?: PostV2): boolean => {
  if (!post) {
    return false;
  }
  // Exclude NSFW posts
  if (post.nsfw) {
    return false;
  }
  // Exclude deleted or spam posts
  if (post.deleted || post.spam) {
    return false;
  }
  // Exclude video posts
  if (post.isVideo) {
    return false;
  }
  // Exclude self posts that have no image
  if (
    post.isSelf &&
    !post.isImage &&
    (!post.galleryImages || post.galleryImages.length === 0)
  ) {
    return false;
  }

  // Must be an image post or hosted on Reddit image domains
  if (post.isImage || (post.galleryImages && post.galleryImages.length > 0)) {
    return true;
  }

  const url = post.url.toLowerCase();
  const isRedditHosted =
    url.includes('i.redd.it') ||
    url.includes('preview.redd.it') ||
    url.includes('external-preview.redd.it');
  const hasImageExtension =
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.png') ||
    url.endsWith('.webp') ||
    url.endsWith('.gif');

  return isRedditHosted || hasImageExtension;
};

export const extractMediaAsset = (post: PostV2): MediaAsset | null => {
  let primaryUrl = '';
  if (
    post.url &&
    (post.url.startsWith('http://') || post.url.startsWith('https://'))
  ) {
    primaryUrl = post.url;
  } else if (post.galleryImages && post.galleryImages.length > 0) {
    primaryUrl = post.galleryImages[0] ?? '';
  }

  if (!primaryUrl) {
    return null;
  }

  let previewUrl: string | undefined;
  if (
    post.thumbnail &&
    (post.thumbnail.startsWith('http://') ||
      post.thumbnail.startsWith('https://'))
  ) {
    previewUrl = post.thumbnail;
  }

  return {
    url: primaryUrl,
    previewUrl,
    width: 0,
    height: 0,
  };
};

export const deriveTopic = (
  flairText?: string
): { topic: Topic; source: TopicSource } => {
  if (!flairText) {
    return { topic: 'other', source: 'default' };
  }

  const normalized = flairText.toLowerCase();
  if (
    normalized.includes('science') ||
    normalized.includes('physics') ||
    normalized.includes('chem') ||
    normalized.includes('bio') ||
    normalized.includes('space') ||
    normalized.includes('astronomy')
  ) {
    return { topic: 'science', source: 'flair' };
  }

  if (
    normalized.includes('engineer') ||
    normalized.includes('tech') ||
    normalized.includes('robot') ||
    normalized.includes('mechanic') ||
    normalized.includes('code')
  ) {
    return { topic: 'engineering', source: 'flair' };
  }

  if (
    normalized.includes('art') ||
    normalized.includes('photo') ||
    normalized.includes('design') ||
    normalized.includes('paint') ||
    normalized.includes('draw')
  ) {
    return { topic: 'art', source: 'flair' };
  }

  return { topic: 'other', source: 'flair' };
};

export const buildGalleryItemFromPost = (
  post: PostV2,
  authorName?: string,
  subredditName?: string
): GalleryItem | null => {
  if (!isEligibleImagePost(post)) {
    return null;
  }

  const media = extractMediaAsset(post);
  if (!media) {
    return null;
  }

  // Normalize createdAt to seconds
  let createdAtSec = Math.floor(Date.now() / 1000);
  if (post.createdAt > 0) {
    createdAtSec =
      post.createdAt > 1e11
        ? Math.floor(post.createdAt / 1000)
        : post.createdAt;
  }

  const flair = post.linkFlair?.text;
  const { topic, source } = deriveTopic(flair);

  return {
    id: post.id,
    permalink: post.permalink || `/comments/${post.id}`,
    title: post.title || 'Untitled',
    author: authorName || 'redditor',
    subreddit: subredditName || 'community',
    createdAt: createdAtSec,
    media,
    topic,
    topicSource: source,
    isModHidden: false,
    isNsfw: post.nsfw || false,
    isRemoved: false,
    capturedAt: Date.now(),
    lastVerifiedAt: Date.now(),
  };
};
