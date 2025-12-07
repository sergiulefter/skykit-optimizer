import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useGameState } from './hooks/useGameState';
import { useTheme } from './hooks/useTheme';
import { useLanguage } from './hooks/useLanguage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { POLL_INTERVAL_IDLE } from './constants/config';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactUsPage = lazy(() => import('./pages/ContactUsPage'));
const AlgorithmPage = lazy(() => import('./pages/AlgorithmPage'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-border border-t-accent rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  const game = useGameState(POLL_INTERVAL_IDLE);
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={<HomePage game={game} theme={theme} onToggleTheme={toggleTheme} language={language} onToggleLanguage={toggleLanguage} />}
          />
          <Route
            path="/inventory"
            element={<InventoryPage game={game} theme={theme} onToggleTheme={toggleTheme} language={language} onToggleLanguage={toggleLanguage} />}
          />
          <Route
            path="/network"
            element={<NetworkPage game={game} theme={theme} onToggleTheme={toggleTheme} language={language} onToggleLanguage={toggleLanguage} />}
          />
          <Route
            path="/events"
            element={<EventsPage game={game} theme={theme} onToggleTheme={toggleTheme} language={language} onToggleLanguage={toggleLanguage} />}
          />
          <Route
            path="/about"
            element={<AboutPage game={game} theme={theme} onToggleTheme={toggleTheme} language={language} onToggleLanguage={toggleLanguage} />}
          />
          <Route
            path="/algorithm"
            element={<AlgorithmPage game={game} theme={theme} onToggleTheme={toggleTheme} language={language} onToggleLanguage={toggleLanguage} />}
          />
          <Route
            path="/contact"
            element={<ContactUsPage game={game} theme={theme} onToggleTheme={toggleTheme} language={language} onToggleLanguage={toggleLanguage} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
