import type { PostV2 } from '@devvit/protos/json/devvit/reddit/v2alpha/postv2.js';
import type {
  GalleryItem,
  MediaAsset,
  PlaceLocation,
  Topic,
  TopicMappingRules,
  TopicSource,
} from '../../shared/types.js';
import { resolvePlace, toPlaceLocation } from './placeResolver.js';
import { DEFAULT_TOPIC_RULES } from './topicSettings.js';

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
  flairText?: string,
  rules: TopicMappingRules = DEFAULT_TOPIC_RULES
): { topic: Topic; source: TopicSource } => {
  if (!flairText) {
    return { topic: 'other', source: 'default' };
  }

  const normalized = flairText.toLowerCase();

  if (rules.scienceKeywords.some((kw) => normalized.includes(kw))) {
    return { topic: 'science', source: 'flair' };
  }

  if (rules.engineeringKeywords.some((kw) => normalized.includes(kw))) {
    return { topic: 'engineering', source: 'flair' };
  }

  if (rules.artKeywords.some((kw) => normalized.includes(kw))) {
    return { topic: 'art', source: 'flair' };
  }

  return { topic: 'other', source: 'flair' };
};

export const extractLocationFromFlair = (
  flairText?: string
): PlaceLocation | undefined => {
  if (!flairText) {
    return undefined;
  }
  const res = resolvePlace(flairText);
  if (res.status === 'resolved') {
    return toPlaceLocation(res.place, 'poster-tagged');
  }
  return undefined;
};

export const buildGalleryItemFromPost = (
  post: PostV2,
  authorName?: string,
  subredditName?: string,
  rules?: TopicMappingRules
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
  const { topic, source } = deriveTopic(flair, rules);
  const place = extractLocationFromFlair(flair);

  const item: GalleryItem = {
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

  if (place) {
    item.place = place;
  }

  return item;
};

export type RedditPostLike = {
  id: string;
  title: string;
  url: string;
  permalink?: string;
  nsfw: boolean;
  authorName?: string;
  subredditName?: string;
  createdAt?: Date | number;
  thumbnail?: { url: string; width?: number; height?: number } | string;
  flair?: { text?: string };
  isSelf?: boolean;
  removed?: boolean;
  spam?: boolean;
};

export const buildGalleryItemFromRedditPost = (
  post: RedditPostLike,
  rules?: TopicMappingRules
): GalleryItem | null => {
  if (post.nsfw || post.removed || post.spam) {
    return null;
  }
  const url = post.url?.toLowerCase() || '';
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

  if (!isRedditHosted && !hasImageExtension) {
    return null;
  }

  let previewUrl: string | undefined;
  if (typeof post.thumbnail === 'object' && post.thumbnail?.url) {
    previewUrl = post.thumbnail.url;
  } else if (
    typeof post.thumbnail === 'string' &&
    post.thumbnail.startsWith('http')
  ) {
    previewUrl = post.thumbnail;
  }

  let createdAtSec = Math.floor(Date.now() / 1000);
  if (post.createdAt instanceof Date) {
    createdAtSec = Math.floor(post.createdAt.getTime() / 1000);
  } else if (typeof post.createdAt === 'number' && post.createdAt > 0) {
    createdAtSec =
      post.createdAt > 1e11
        ? Math.floor(post.createdAt / 1000)
        : post.createdAt;
  }

  const { topic, source } = deriveTopic(post.flair?.text, rules);
  const place = extractLocationFromFlair(post.flair?.text);

  const item: GalleryItem = {
    id: post.id,
    permalink: post.permalink || `/comments/${post.id}`,
    title: post.title || 'Untitled',
    author: post.authorName || 'redditor',
    subreddit: post.subredditName || 'community',
    createdAt: createdAtSec,
    media: {
      url: post.url,
      previewUrl,
      width: 0,
      height: 0,
    },
    topic,
    topicSource: source,
    isModHidden: false,
    isNsfw: false,
    isRemoved: false,
    capturedAt: Date.now(),
    lastVerifiedAt: Date.now(),
  };

  if (place) {
    item.place = place;
  }

  return item;
};
