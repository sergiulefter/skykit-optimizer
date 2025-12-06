import { MapPanel } from '../components/MapPanel';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { BackToDashboardButton } from '../components/BackToDashboardButton';
import type { UseGameStateResult } from '../hooks/useGameState';
import type { Theme } from '../hooks/useTheme';

type NetworkPageProps = {
  game: UseGameStateResult;
  theme: Theme;
  onToggleTheme: () => void;
};

export function NetworkPage({ game, theme, onToggleTheme }: NetworkPageProps) {
  const { state, isLoading, error, isConnected } = game;
  const flights = state?.activeFlights || [];

  return (
    <PageShell>
      <SiteHeader isConnected={isConnected} theme={theme} onToggleTheme={onToggleTheme} />

      <div className="mb-6">
        <BackToDashboardButton />
      </div>

      <section className="bg-gradient-to-br from-bg-alt/95 to-panel-dark/95 rounded-[34px] p-6 sm:p-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(6,6,10,0.7)]">
        <div className="mb-6">
          <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-0.5">Global Network</p>
          <h2 className="mt-1 text-3xl">Active flight visualization</h2>
        </div>

        {isLoading && <p className="text-text-muted">Loading active flights...</p>}
        {!isLoading && error && !isConnected && <p className="text-danger">{error}</p>}

        <MapPanel activeFlights={flights} />
      </section>
    </PageShell>
  );
}

export default NetworkPage;
