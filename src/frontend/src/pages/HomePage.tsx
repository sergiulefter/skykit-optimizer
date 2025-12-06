import { Link } from 'react-router-dom';
import { SimControls } from '../components/SimControls';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import type { UseGameStateResult } from '../hooks/useGameState';
import type { Theme } from '../hooks/useTheme';

type HomePageProps = {
  game: UseGameStateResult;
  theme: Theme;
  onToggleTheme: () => void;
};

const defaultGameState = {
  day: 0,
  hour: 0,
  round: 0,
  isStarting: false,
  isRunning: false,
  isComplete: false,
  stats: {
    totalCost: 0,
    transportCost: 0,
    processingCost: 0,
    purchaseCost: 0,
    penaltyCost: 0,
    totalPenalties: 0,
    roundsCompleted: 0
  },
  airports: [],
  activeFlights: [],
  events: [],
  recentPenalties: []
};

const navLinks = [
  { to: '/inventory', label: 'Airport Inventory' },
  { to: '/network', label: 'Global Network' },
  { to: '/events', label: 'Events & Penalties' }
];

const formatCost = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function HomePage({ game, theme, onToggleTheme }: HomePageProps) {
  const { state, isLoading, error, isConnected, startGame } = game;

  if (isLoading) {
    return (
      <PageShell>
        <SiteHeader isConnected={isConnected} theme={theme} onToggleTheme={onToggleTheme} />
        <div className="flex flex-col items-center justify-center min-h-[200px] text-text-muted">
          <div className="w-10 h-10 border-[3px] border-border border-t-accent rounded-full animate-spin mb-4" />
          <p>Connecting to backend...</p>
        </div>
      </PageShell>
    );
  }

  if (error && !isConnected) {
    return (
      <PageShell>
        <SiteHeader isConnected={isConnected} theme={theme} onToggleTheme={onToggleTheme} />
        <section className="bg-gradient-to-br from-bg-alt/95 to-panel-dark/95 rounded-[34px] p-10 mb-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(6,6,10,0.7)]">
          <div>
            <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-0.5">Connection Error</p>
            <h2 className="mt-1 mb-6 text-4xl">Cannot connect to backend</h2>
          </div>
          <p className="text-text-muted text-sm">
            Make sure the backend server is running on <code className="bg-panel px-2 py-1 rounded">http://localhost:3001</code>
          </p>
          <p className="text-text-muted text-sm mt-4">
            Run <code className="bg-panel px-2 py-1 rounded">npm run backend</code> to start the backend server.
          </p>
          <p className="text-danger text-sm mt-4">
            Error: {error}
          </p>
        </section>
      </PageShell>
    );
  }

  const gameState = state || defaultGameState;

  const progress = Math.max(0, Math.min(1, gameState.stats.roundsCompleted / 720 || 0));

  const metricBlocks = [
    { label: 'Total Cost', value: formatCost(gameState.stats.totalCost) },
    { label: 'Transport', value: formatCost(gameState.stats.transportCost) },
    { label: 'Processing', value: formatCost(gameState.stats.processingCost) },
    { label: 'Penalties', value: `${gameState.stats.totalPenalties} • ${formatCost(gameState.stats.penaltyCost)}` }
  ];

  const planePath = 'M24 2L28.5 14H42L37 24L42 34H28.5L24 46L19.5 34H6L11 24L6 14H19.5Z';
  const trailPath = 'M4 24H16';

  const flightPaths = [
    { id: 'alpha', className: 'flight-plane flight-plane--one', style: { animationDelay: '2s' }, color: 'var(--color-accent)' },
    { id: 'bravo', className: 'flight-plane flight-plane--two', style: { animationDelay: '8s' }, color: 'var(--color-accent-2)' },
    { id: 'charlie', className: 'flight-plane flight-plane--three', style: { animationDelay: '4s' }, color: 'var(--color-warning)' },
    { id: 'delta', className: 'flight-plane flight-plane--four', style: { animationDelay: '12s' }, color: 'rgba(255,255,255,0.65)' }
  ];

  return (
    <PageShell>
      <SiteHeader isConnected={isConnected} theme={theme} onToggleTheme={onToggleTheme} />

      <nav className="flex flex-wrap gap-3 mb-6">
        {navLinks.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-text-muted transition hover:text-text hover:border-accent"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <section className="relative overflow-hidden rounded-[34px] border border-border/70 bg-gradient-to-br from-bg-alt/70 via-panel/80 to-panel-dark/80 p-6 sm:p-10 mb-12 dashboard-aurora">
        <div className="pointer-events-none absolute inset-0 opacity-40 grid-overlay animate-float" />
        <div className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 bg-accent/20 blur-[120px] animate-gradient" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 bg-accent-2/25 blur-[120px] animate-gradient" />
        <div className="air-traffic" aria-hidden>
          {flightPaths.map(flight => (
            <svg
              key={flight.id}
              viewBox="0 0 48 48"
              className={flight.className}
              style={{ ...flight.style, color: flight.color }}
            >
              <path d={planePath} />
              <path d={trailPath} className="trail" />
            </svg>
          ))}
        </div>

        <div className="relative z-10 space-y-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="uppercase tracking-[0.4em] text-[11px] text-text-muted flex items-center gap-2">
                <span className="inline-flex h-1 w-10 rounded-full bg-accent" /> Live Simulation
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                Skykit Ops Control · Day {gameState.day}
              </h2>
              <p className="text-text-muted text-base max-w-2xl mt-3">
                Monitor the optimizer pulse, track penalties, and trigger reruns with a refined cinematic dash that
                keeps navigation simple but visuals alive.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="glass-card rounded-full px-4 py-2 border border-border/70 animate-border-glow">
                  Current Hour · {gameState.hour}:00
                </span>
                <span className="glass-card rounded-full px-4 py-2 border border-border/70">
                  Active Flights · {gameState.activeFlights.length}
                </span>
                <span className="glass-card rounded-full px-4 py-2 border border-border/70">
                  Airports · {gameState.airports.length}
                </span>
              </div>
            </div>

            <div className="glass-card rounded-[24px] px-6 py-5 w-full max-w-sm animate-float">
              <p className="uppercase tracking-[0.3em] text-xs text-text-muted mb-3">Connection</p>
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-success shadow-[0_0_14px_rgba(74,223,134,0.7)]' : 'bg-danger shadow-[0_0_14px_rgba(255,90,95,0.5)]'}`} />
                <div>
                  <p className="m-0 text-lg font-semibold">{isConnected ? 'Backend Channel Live' : 'Backend Offline'}</p>
                  <p className="m-0 text-sm text-text-muted">{isConnected ? 'Real-time metrics streaming' : 'Retry connection to sync data'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="glass-card rounded-[24px] p-6 border border-border/70">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Status</p>
                <span className="text-sm font-mono text-text-muted">Round {gameState.stats.roundsCompleted} / 720</span>
              </div>
              <p className="text-2xl font-semibold mb-6">
                {gameState.isComplete ? 'Simulation complete' : gameState.isRunning ? 'Running scenario' : gameState.isStarting ? 'Spin-up in progress' : 'Awaiting start'}
              </p>
              <div className="relative h-2 rounded-full bg-border">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent via-accent-2 to-warning animate-gradient"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-text-muted">{(progress * 100).toFixed(1)}% complete</p>
            </div>

            <div className="glass-card rounded-[24px] p-6 border border-border/70 space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Insights</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">Events Logged</span>
                  <strong className="text-lg">{gameState.events.length}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">Recent Penalties</span>
                  <strong className="text-lg">{gameState.recentPenalties.length}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">Avg Cost / Round</span>
                  <strong className="text-lg">{formatCost(gameState.stats.roundsCompleted ? gameState.stats.totalCost / gameState.stats.roundsCompleted : 0)}</strong>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-[24px] p-6 border border-border/70">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted mb-5">Timeline</p>
              <div className="space-y-4">
                {[{ label: 'Morning Sort', time: '08:00', active: gameState.hour < 12 }, { label: 'Peak Ops', time: '16:00', active: gameState.hour >= 12 && gameState.hour < 20 }, { label: 'Overnight Recovery', time: '23:00', active: gameState.hour >= 20 || gameState.hour < 5 }].map(stage => (
                  <div key={stage.label} className="flex items-center justify-between text-sm">
                    <span className={`flex items-center gap-2 ${stage.active ? 'text-text' : 'text-text-muted'}`}>
                      <span className={`h-1.5 w-4 rounded-full ${stage.active ? 'bg-accent animate-pulse-opacity' : 'bg-border'}`} />
                      {stage.label}
                    </span>
                    <span className="text-text-muted font-mono">{stage.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Key Metrics</p>
            <div className="grid gap-4 md:grid-cols-2">
              {metricBlocks.map(metric => (
                <div key={metric.label} className="glass-card rounded-[22px] p-5 border border-border/60 flex items-center justify-between backdrop-blur-xl">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{metric.label}</p>
                    <p className="text-2xl font-semibold mt-1">{metric.value}</p>
                  </div>
                  <span className="h-12 w-12 rounded-full border border-border/50 flex items-center justify-center text-sm text-text-muted">
                    •
                  </span>
                </div>
              ))}
            </div>
          </div>

          <SimControls
            isStarting={gameState.isStarting}
            isRunning={gameState.isRunning}
            isComplete={gameState.isComplete}
            round={gameState.stats.roundsCompleted}
            onStartGame={startGame}
          />
        </div>
      </section>
    </PageShell>
  );
}

export default HomePage;
