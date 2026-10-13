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
  createdAt: number; // Post created epoch timestamp in seconds
  takenAt?: number; // Optional capture date epoch in seconds
  media: MediaAsset;
  topic: Topic;
  topicSource: TopicSource;
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

export type TimelineQueryParams = {
  limit?: number;
  cursor?: string;
  topic?: Topic;
  placeType?: 'country' | 'region' | 'city' | 'unplaced';
  placeKey?: string;
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
