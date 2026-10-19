import './index.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  DisciplineFilter,
  GalleryItem,
  ImpactFilter,
  TimelineSummary,
} from '../shared/types.js';
import { Navbar } from './components/Navbar.js';
import { PhotoDetailModal } from './components/PhotoDetailModal.js';
import { TabBar } from './components/TabBar.js';
import { useTaxonomySummary } from './hooks/useTaxonomySummary.js';
import type { TabType, ThemeMode, ZoomLevel } from './types.js';
import { FavoritesView } from './views/FavoritesView.js';
import { PlacesView } from './views/PlacesView.js';
import { SearchView } from './views/SearchView.js';
import { TimelineView } from './views/TimelineView.js';

export const App = () => {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [selectedDisciplines, setSelectedDisciplines] = useState<
    DisciplineFilter[]
  >([]);
  const [selectedImpacts, setSelectedImpacts] = useState<ImpactFilter[]>([]);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('all');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [summary, setSummary] = useState<TimelineSummary | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState<boolean>(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryItem | null>(null);

  const { summary: taxonomySummary, refresh: refreshTaxonomySummary } =
    useTaxonomySummary();

  // Sync theme class to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Load summary, user details, and favorites
  useEffect(() => {
    const fetchInit = async () => {
      try {
        const [initRes, summaryRes, favRes] = await Promise.all([
          fetch('/api/init'),
          fetch('/api/gallery/timeline/summary'),
          fetch('/api/gallery/favorites?limit=100'),
        ]);

        if (initRes.ok) {
          const initData: { username?: string; isModerator?: boolean } =
            await initRes.json();
          if (initData.username) {
            setUsername(initData.username);
          }
          if (typeof initData.isModerator === 'boolean') {
            setIsModerator(initData.isModerator);
          }
        }

        if (summaryRes.ok) {
          const sumData: TimelineSummary = await summaryRes.json();
          setSummary(sumData);
        }

        if (favRes.ok) {
          const favData: { items: GalleryItem[] } = await favRes.json();
          if (Array.isArray(favData.items)) {
            setFavoriteIds(new Set(favData.items.map((i) => i.id)));
          }
        }
      } catch (err) {
        console.warn('Failed to load initial gallery summary:', err);
      }
    };

    void fetchInit();
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleToggleDiscipline = (disc: DisciplineFilter | 'all') => {
    if (disc === 'all') {
      setSelectedDisciplines([]);
    } else {
      setSelectedDisciplines((prev) =>
        prev.includes(disc) ? prev.filter((d) => d !== disc) : [...prev, disc]
      );
    }
  };

  const handleToggleImpact = (imp: ImpactFilter | 'all') => {
    if (imp === 'all') {
      setSelectedImpacts([]);
    } else {
      setSelectedImpacts((prev) =>
        prev.includes(imp) ? prev.filter((i) => i !== imp) : [...prev, imp]
      );
    }
  };

  const handleResetFilters = () => {
    setSelectedDisciplines([]);
    setSelectedImpacts([]);
  };

  const handleToggleFavorite = async (postId: string) => {
    // Optimistic toggle
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    try {
      const res = await fetch(`/api/gallery/${postId}/favorite`, {
        method: 'POST',
      });
      if (res.ok) {
        const data: { isFavorite: boolean } = await res.json();
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (data.isFavorite) {
            next.add(postId);
          } else {
            next.delete(postId);
          }
          return next;
        });
      }
    } catch {
      // Revert if failed
    }
  };

  const handleItemUpdated = (updatedItem: GalleryItem) => {
    setSelectedPhoto(updatedItem);
    void refreshTaxonomySummary();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      <Navbar
        subredditName="Community"
        selectedDisciplines={selectedDisciplines}
        onToggleDiscipline={handleToggleDiscipline}
        selectedImpacts={selectedImpacts}
        onToggleImpact={handleToggleImpact}
        taxonomySummary={taxonomySummary}
        theme={theme}
        onToggleTheme={toggleTheme}
        totalPhotos={taxonomySummary?.totalCount ?? summary?.totalCount}
        onResetFilters={handleResetFilters}
      />

      <main className="flex-1 flex flex-col w-full">
        {activeTab === 'timeline' && (
          <TimelineView
            selectedDisciplines={selectedDisciplines}
            selectedImpacts={selectedImpacts}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            onSelectPhoto={setSelectedPhoto}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onResetFilters={handleResetFilters}
          />
        )}
        {activeTab === 'places' && (
          <PlacesView
            onSelectPhoto={setSelectedPhoto}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {activeTab === 'favorites' && (
          <FavoritesView
            username={username}
            onSelectPhoto={setSelectedPhoto}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {activeTab === 'search' && (
          <SearchView
            onSelectPhoto={setSelectedPhoto}
            favoriteIds={favoriteIds}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </main>

      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoritesCount={favoriteIds.size}
      />

      {selectedPhoto && (
        <PhotoDetailModal
          key={selectedPhoto.id}
          item={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          isFavorite={favoriteIds.has(selectedPhoto.id)}
          onToggleFavorite={handleToggleFavorite}
          currentUser={username}
          isModerator={isModerator}
          onItemUpdated={handleItemUpdated}
        />
      )}
    </div>
  );
};

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
