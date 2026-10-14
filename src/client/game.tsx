import './index.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { TimelineSummary } from '../shared/types.js';
import { Navbar } from './components/Navbar.js';
import { TabBar } from './components/TabBar.js';
import type { TabType, ThemeMode, TopicFilter, ZoomLevel } from './types.js';
import { FavoritesView } from './views/FavoritesView.js';
import { PlacesView } from './views/PlacesView.js';
import { SearchView } from './views/SearchView.js';
import { TimelineView } from './views/TimelineView.js';

export const App = () => {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [selectedTopic, setSelectedTopic] = useState<TopicFilter>('all');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('all');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [summary, setSummary] = useState<TimelineSummary | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  // Sync theme class to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Load summary and user details
  useEffect(() => {
    const fetchInit = async () => {
      try {
        const [initRes, summaryRes] = await Promise.all([
          fetch('/api/init'),
          fetch('/api/gallery/timeline/summary'),
        ]);

        if (initRes.ok) {
          const initData: { username?: string } = await initRes.json();
          if (initData.username) {
            setUsername(initData.username);
          }
        }

        if (summaryRes.ok) {
          const sumData: TimelineSummary = await summaryRes.json();
          setSummary(sumData);
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

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      <Navbar
        subredditName="Community"
        selectedTopic={selectedTopic}
        onSelectTopic={setSelectedTopic}
        topicCounts={summary?.topics}
        theme={theme}
        onToggleTheme={toggleTheme}
        totalPhotos={summary?.totalCount}
      />

      <main className="flex-1 flex flex-col w-full">
        {activeTab === 'timeline' && (
          <TimelineView
            selectedTopic={selectedTopic}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
          />
        )}
        {activeTab === 'places' && <PlacesView />}
        {activeTab === 'favorites' && <FavoritesView username={username} />}
        {activeTab === 'search' && <SearchView />}
      </main>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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
