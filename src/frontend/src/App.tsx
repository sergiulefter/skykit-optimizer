import { Navigate, Route, Routes } from 'react-router-dom';
import { useGameState } from './hooks/useGameState';
import { useTheme } from './hooks/useTheme';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { NetworkPage } from './pages/NetworkPage';
import { EventsPage } from './pages/EventsPage';
import { AboutPage } from './pages/AboutPage';
import {ContactUsPage} from "./pages/ContactUsPage";

function App() {
  const game = useGameState(1000);
  const { theme, toggleTheme } = useTheme();

  return (
    <Routes>
      <Route path="/" element={<HomePage game={game} theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/inventory" element={<InventoryPage game={game} theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/network" element={<NetworkPage game={game} theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/events" element={<EventsPage game={game} theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="/about" element={<AboutPage game={game} theme={theme} onToggleTheme={toggleTheme} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
