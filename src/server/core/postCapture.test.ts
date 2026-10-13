import { describe, expect, it } from 'vitest';
import type { PostV2 } from '@devvit/protos/json/devvit/reddit/v2alpha/postv2.js';
import {
  buildGalleryItemFromPost,
  deriveTopic,
  extractMediaAsset,
  isEligibleImagePost,
} from './postCapture.js';

const createBasePost = (override?: Partial<PostV2>): PostV2 => ({
  id: 't3_test1',
  title: 'Nebula Image',
  selftext: '',
  nsfw: false,
  authorId: 'user_1',
  crowdControlLevel: 0,
  numReports: 0,
  isGallery: false,
  isMeta: false,
  createdAt: 1700000000,
  isApproved: true,
  isArchived: false,
  distinguished: 0,
  ignoreReports: false,
  isSelf: false,
  isVideo: false,
  isLocked: false,
  isSpoiler: false,
  subredditId: 'sub_1',
  upvotes: 10,
  downvotes: 0,
  url: 'https://i.redd.it/nebula.png',
  isSticky: false,
  spam: false,
  deleted: false,
  languageCode: 'en',
  updatedAt: 1700000000,
  gildings: 0,
  score: 10,
  numComments: 0,
  thumbnail: 'https://b.thumbs.redditmedia.com/thumb.jpg',
  crosspostParentId: '',
  permalink: '/r/science/comments/test1/nebula_image/',
  isPoll: false,
  isPromoted: false,
  isMultiMedia: false,
  type: 'image',
  unlisted: false,
  galleryImages: [],
  isImage: true,
  mediaUrls: ['https://i.redd.it/nebula.png'],
  isClubContent: false,
  ...override,
});

describe('postCapture', () => {
  describe('isEligibleImagePost', () => {
    it('approves standard Reddit image post', () => {
      const post = createBasePost();
      expect(isEligibleImagePost(post)).toBe(true);
    });

    it('rejects NSFW posts', () => {
      const post = createBasePost({ nsfw: true });
      expect(isEligibleImagePost(post)).toBe(false);
    });

    it('rejects deleted and spam posts', () => {
      expect(isEligibleImagePost(createBasePost({ deleted: true }))).toBe(
        false
      );
      expect(isEligibleImagePost(createBasePost({ spam: true }))).toBe(false);
    });

    it('rejects video posts', () => {
      const post = createBasePost({ isVideo: true, isImage: false });
      expect(isEligibleImagePost(post)).toBe(false);
    });

    it('rejects plain text self-posts', () => {
      const post = createBasePost({
        isSelf: true,
        isImage: false,
        url: 'https://reddit.com/r/science/comments/test1',
        galleryImages: [],
      });
      expect(isEligibleImagePost(post)).toBe(false);
    });

    it('rejects external articles without images', () => {
      const post = createBasePost({
        isImage: false,
        url: 'https://www.nature.com/articles/d41586-024-00000-0',
      });
      expect(isEligibleImagePost(post)).toBe(false);
    });

    it('approves gallery posts with images', () => {
      const post = createBasePost({
        isImage: false,
        isGallery: true,
        galleryImages: [
          'https://i.redd.it/img1.jpg',
          'https://i.redd.it/img2.jpg',
        ],
      });
      expect(isEligibleImagePost(post)).toBe(true);
    });
  });

  describe('extractMediaAsset', () => {
    it('extracts primary url and thumbnail preview', () => {
      const post = createBasePost();
      const asset = extractMediaAsset(post);
      expect(asset).not.toBeNull();
      expect(asset?.url).toBe('https://i.redd.it/nebula.png');
      expect(asset?.previewUrl).toBe(
        'https://b.thumbs.redditmedia.com/thumb.jpg'
      );
    });

    it('falls back to galleryImages[0] when post url is missing', () => {
      const post = createBasePost({
        url: '',
        galleryImages: ['https://i.redd.it/gallery1.jpg'],
      });
      const asset = extractMediaAsset(post);
      expect(asset?.url).toBe('https://i.redd.it/gallery1.jpg');
    });
  });

  describe('deriveTopic', () => {
    it('categorizes science flairs', () => {
      expect(deriveTopic('Astrophysics').topic).toBe('science');
      expect(deriveTopic('Biochemistry Research').topic).toBe('science');
    });

    it('categorizes engineering flairs', () => {
      expect(deriveTopic('Robotics & AI').topic).toBe('engineering');
      expect(deriveTopic('Mechanical Design').topic).toBe('engineering');
    });

    it('categorizes art flairs', () => {
      expect(deriveTopic('Digital Painting').topic).toBe('art');
      expect(deriveTopic('Nature Photography').topic).toBe('art');
    });

    it('falls back to other for unknown or missing flairs', () => {
      expect(deriveTopic('Discussion').topic).toBe('other');
      expect(deriveTopic(undefined).topic).toBe('other');
      expect(deriveTopic(undefined).source).toBe('default');
    });

    it('applies custom topic mapping rules when provided', () => {
      const customRules = {
        scienceKeywords: ['quantum', 'lab'],
        engineeringKeywords: ['hardware'],
        artKeywords: ['sketch'],
      };

      expect(deriveTopic('Quantum Leap', customRules).topic).toBe('science');
      expect(deriveTopic('New Hardware Demo', customRules).topic).toBe(
        'engineering'
      );
      expect(deriveTopic('Pencil Sketch', customRules).topic).toBe('art');
      // Default keyword that is not in custom rules falls back to other
      expect(deriveTopic('Space Exploration', customRules).topic).toBe('other');
    });
  });

  describe('buildGalleryItemFromPost', () => {
    it('constructs a complete GalleryItem from post', () => {
      const post = createBasePost({
        linkFlair: {
          text: 'Space Science',
          templateId: 'flair_1',
          textColor: 'dark',
          backgroundColor: '#fff',
          cssClass: '',
        },
      });
      const item = buildGalleryItemFromPost(post, 'astronomer', 'space');

      expect(item).not.toBeNull();
      expect(item?.id).toBe('t3_test1');
      expect(item?.author).toBe('astronomer');
      expect(item?.subreddit).toBe('space');
      expect(item?.topic).toBe('science');
      expect(item?.topicSource).toBe('flair');
      expect(item?.media.url).toBe('https://i.redd.it/nebula.png');
      expect(item?.isNsfw).toBe(false);
      expect(item?.createdAt).toBe(1700000000);
    });

    it('applies custom topic rules when building gallery item', () => {
      const post = createBasePost({
        linkFlair: {
          text: 'Laser Optics Lab',
          templateId: 'flair_custom',
          textColor: 'dark',
          backgroundColor: '#fff',
          cssClass: '',
        },
      });
      const customRules = {
        scienceKeywords: ['optics'],
        engineeringKeywords: [],
        artKeywords: [],
      };
      const item = buildGalleryItemFromPost(
        post,
        'researcher',
        'physics',
        customRules
      );
      expect(item?.topic).toBe('science');
    });

    it('extracts location from flair and marks as poster-tagged', () => {
      const post = createBasePost({
        linkFlair: {
          text: 'Tokyo, Japan',
          templateId: 'flair_loc',
          textColor: 'dark',
          backgroundColor: '#fff',
          cssClass: '',
        },
      });
      const item = buildGalleryItemFromPost(post, 'traveler', 'photography');
      expect(item?.place).toBeDefined();
      expect(item?.place?.city).toBe('Tokyo');
      expect(item?.place?.country).toBe('JP');
      expect(item?.place?.status).toBe('poster-tagged');
    });

    it('extracts location when flair has a prefix like Location: Paris, France', () => {
      const post = createBasePost({
        linkFlair: {
          text: 'Location: Paris, France',
          templateId: 'flair_loc',
          textColor: 'dark',
          backgroundColor: '#fff',
          cssClass: '',
        },
      });
      const item = buildGalleryItemFromPost(post, 'traveler', 'art');
      expect(item?.place).toBeDefined();
      expect(item?.place?.city).toBe('Paris');
      expect(item?.place?.country).toBe('FR');
    });

    it('leaves place undefined when flair does not match a known place', () => {
      const post = createBasePost({
        linkFlair: {
          text: 'General Discussion',
          templateId: 'flair_gen',
          textColor: 'dark',
          backgroundColor: '#fff',
          cssClass: '',
        },
      });
      const item = buildGalleryItemFromPost(post, 'user', 'science');
      expect(item?.place).toBeUndefined();
    });

    it('returns null for ineligible posts', () => {
      const nsfwPost = createBasePost({ nsfw: true });
      expect(buildGalleryItemFromPost(nsfwPost)).toBeNull();
    });
  });
});
