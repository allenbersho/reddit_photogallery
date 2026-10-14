import type { PlacesSummary, TimelineSummary } from '../shared/types.js';

export type TabType = 'timeline' | 'places' | 'favorites' | 'search';

export type ThemeMode = 'dark' | 'light';

export type TopicFilter = 'all' | 'science' | 'engineering' | 'art';

export type ZoomLevel = 'years' | 'months' | 'days' | 'all';

export type GalleryContextState = {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedTopic: TopicFilter;
  setSelectedTopic: (topic: TopicFilter) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  selectedPlace: { placeType: 'country' | 'region' | 'city' | 'unplaced'; placeKey: string; name: string } | null;
  setSelectedPlace: (place: { placeType: 'country' | 'region' | 'city' | 'unplaced'; placeKey: string; name: string } | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  summary: TimelineSummary | null;
  placesSummary: PlacesSummary | null;
  refreshSummary: () => Promise<void>;
  username: string | null;
  isModerator: boolean;
};
