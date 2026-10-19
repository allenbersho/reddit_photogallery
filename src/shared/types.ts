import type { Discipline, Impact, TagSource } from './taxonomy.js';

export type Topic = 'science' | 'engineering' | 'art' | 'other';

export type TopicSource = 'flair' | 'mod' | 'default';

export type PlaceStatus = 'unknown' | 'poster-tagged' | 'mod-verified';

export type PlaceLocation = {
  raw: string;
  country: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
  status: PlaceStatus;
};

export type MediaAsset = {
  url: string;
  previewUrl?: string;
  width: number;
  height: number;
};

export type GalleryItem = {
  id: string; // Reddit post ID (e.g. "t3_12345")
  permalink: string;
  title: string;
  author: string;
  subreddit: string;
  createdAt: number; // Post created epoch timestamp in seconds (when posted into installed sub)
  takenAt?: number; // Optional capture date epoch in seconds
  media: MediaAsset;

  // Chimera University taxonomy
  disciplines: Discipline[];
  disciplinesSource: TagSource;
  impacts: Impact[];
  impactsSource: TagSource;

  // Crosspost / Repost metadata
  isCrosspost: boolean;
  crosspostParentId?: string;
  originalSubreddit?: string;
  originalAuthor?: string;
  originalPermalink?: string;
  originalCreatedAt?: number;
  crossposterName?: string;

  // Legacy topic fields (retained for backward compatibility and migration)
  topic?: Topic;
  topicSource?: TopicSource;

  place?: PlaceLocation;
  isModHidden: boolean;
  isNsfw: boolean;
  isRemoved: boolean;
  capturedAt: number; // Ingest epoch timestamp in milliseconds
  lastVerifiedAt: number; // Reconciliation epoch timestamp in milliseconds
};

export type TopicMappingRules = {
  scienceKeywords: string[];
  engineeringKeywords: string[];
  artKeywords: string[];
};

export type TimelineCursor = {
  score: number;
  id: string;
};

export type DisciplineFilter = Discipline | 'untagged';
export type ImpactFilter = Impact | 'untagged';

export type TimelineQueryParams = {
  limit?: number;
  cursor?: string;
  disciplines?: DisciplineFilter[];
  impacts?: ImpactFilter[];
  topic?: Topic;
  placeType?: 'country' | 'region' | 'city' | 'unplaced';
  placeKey?: string;
  year?: number;
  month?: number;
  includeHidden?: boolean;
};

export type TimelinePage = {
  items: GalleryItem[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount: number;
};

export type MonthSummary = {
  month: number;
  count: number;
};

export type YearSummary = {
  year: number;
  count: number;
  months: MonthSummary[];
};

export type TimelineSummary = {
  years: YearSummary[];
  totalCount: number;
  disciplines?: Record<Discipline | 'untagged', number>;
  impacts?: Record<Impact | 'untagged', number>;
  topics?: Record<Topic, number>;
};

export type PlaceHierarchyNode = {
  key: string;
  name: string;
  type: 'country' | 'region' | 'city';
  count: number;
  coverPostId?: string;
  children?: PlaceHierarchyNode[];
};

export type PlacesSummary = {
  hierarchy: PlaceHierarchyNode[];
  unplacedCount: number;
  totalPlacedCount: number;
};

export type TagLocationRequest = {
  postId: string;
  location: string;
  takenDate?: string;
};

export type TagItemRequest = {
  postId: string;
  disciplines?: Discipline[];
  impacts?: Impact[];
  location?: string;
  takenDate?: string;
};

export type TaxonomySummary = {
  disciplines: Record<Discipline, number>;
  impacts: Record<Impact, number>;
  untagged: {
    disciplines: number;
    impacts: number;
  };
  totalCount: number;
};

