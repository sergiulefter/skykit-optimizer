import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SimControls } from '../components/SimControls';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { getDashboardNavLinks } from '../data/navLinks';
import type { UseGameStateResult } from '../hooks/useGameState';
import type { Theme } from '../hooks/useTheme';
import type { Language } from '../hooks/useLanguage';
import { pickLanguage } from '../i18n/utils';

type HomePageProps = {
  game: UseGameStateResult;
  theme: Theme;
  onToggleTheme: () => void;
  language: Language;
  onToggleLanguage: () => void;
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

const formatCost = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export function HomePage({ game, theme, onToggleTheme, language, onToggleLanguage }: HomePageProps) {
  const { state, isLoading, error, isConnected, startGame } = game;
  const t = <T,>(values: { en: T; ro: T }) => pickLanguage(language, values);
  const [isCompactNav, setIsCompactNav] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);

  if (isLoading) {
    return (
      <PageShell>
        <SiteHeader
          isConnected={isConnected}
          theme={theme}
          onToggleTheme={onToggleTheme}
          language={language}
          onToggleLanguage={onToggleLanguage}
        />
        <div className="flex flex-col items-center justify-center min-h-[200px] text-text-muted">
          <div className="w-10 h-10 border-[3px] border-border border-t-accent rounded-full animate-spin mb-4" />
          <p>{t({ en: 'Connecting to backend...', ro: 'Se conectează la backend...' })}</p>
        </div>
      </PageShell>
    );
  }

  if (error && !isConnected) {
    return (
      <PageShell>
        <SiteHeader
          isConnected={isConnected}
          theme={theme}
          onToggleTheme={onToggleTheme}
          language={language}
          onToggleLanguage={onToggleLanguage}
        />
        <section className="bg-gradient-to-br from-bg-alt/95 to-panel-dark/95 rounded-[34px] p-10 mb-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(6,6,10,0.7)]">
          <div>
            <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-0.5">{t({ en: 'Connection error', ro: 'Eroare de conexiune' })}</p>
            <h2 className="mt-1 mb-6 text-4xl">{t({ en: 'Cannot connect to backend', ro: 'Nu ne putem conecta la backend' })}</h2>
          </div>
          <p className="text-text-muted text-sm">
            {t({
              en: 'Make sure the backend server is running on',
              ro: 'Asigură-te că serverul backend rulează pe'
            })}{' '}
            <code className="bg-panel px-2 py-1 rounded">http://localhost:3001</code>
          </p>
          <p className="text-text-muted text-sm mt-4">
            {t({ en: 'Run', ro: 'Rulează' })}{' '}
            <code className="bg-panel px-2 py-1 rounded">npm run backend</code>{' '}
            {t({ en: 'to start the backend server.', ro: 'pentru a porni serviciul backend.' })}
          </p>
          <p className="text-danger text-sm mt-4">
            {t({ en: 'Error', ro: 'Eroare' })}: {error}
          </p>
        </section>
      </PageShell>
    );
  }

  const gameState = state || defaultGameState;
  const navLinks = getDashboardNavLinks(language);

  const progress = Math.max(0, Math.min(1, gameState.stats.roundsCompleted / 720 || 0));

  const loadingCost = gameState.stats.transportCost;
  const processingCost = gameState.stats.processingCost;
  const acquisitionCost = gameState.stats.purchaseCost;
  const penaltyCost = gameState.stats.penaltyCost;
  const knownCostTotal = loadingCost + processingCost + penaltyCost + acquisitionCost;
  const transportCost = Math.max(0, gameState.stats.totalCost - knownCostTotal);

  const metricBlocks = [
    {
      label: t({ en: 'Total cost', ro: 'Cost total' }),
      value: formatCost(gameState.stats.totalCost),
      detail: t({ en: 'Cumulative spend across the sim', ro: 'Cheltuială cumulată în simulare' })
    },
    {
      label: t({ en: 'Penalties', ro: 'Penalizări' }),
      value: formatCost(penaltyCost),
      detail: t({
        en: `${gameState.stats.totalPenalties} incidents logged`,
        ro: `${gameState.stats.totalPenalties} incidente înregistrate`
      })
    },
    {
      label: t({ en: 'Loading cost', ro: 'Cost de încărcare' }),
      value: formatCost(loadingCost),
      detail: t({ en: 'Aircraft loading & handling', ro: 'Încărcare și manipulare aeronave' })
    },
    {
      label: t({ en: 'Transport cost', ro: 'Cost de transport' }),
      value: formatCost(transportCost),
      detail: t({ en: 'Transit & routing estimate', ro: 'Estimare transport și rutare' })
    },
    {
      label: t({ en: 'Processing cost', ro: 'Cost de procesare' }),
      value: formatCost(processingCost),
      detail: t({ en: 'Kit conditioning & QA', ro: 'Conditionare și QA pentru kituri' })
    },
    {
      label: t({ en: 'Acquisition cost', ro: 'Cost de achiziție' }),
      value: formatCost(acquisitionCost),
      detail: t({ en: 'Fresh kits purchased', ro: 'Kiturile proaspăt cumpărate' })
    }
  ];

  const navButtonBase = 'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition';
  const navButtonDark =
    'border border-[#3b82f6]/70 text-[#cfe0ff] shadow-[0_0_18px_rgba(56,189,248,0.25)] hover:border-[#7dd3fc] hover:text-white';
  const navButtonLight = 'border border-border text-text-muted hover:text-text hover:border-accent';
  const navButtonClass = `${navButtonBase} ${theme === 'dark' ? navButtonDark : navButtonLight}`;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(max-width: 1065px)');
    const update = () => setIsCompactNav(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isCompactNav && isNavOpen) {
      setIsNavOpen(false);
    }
  }, [isCompactNav, isNavOpen]);

  const toggleNav = () => setIsNavOpen(prev => !prev);

  return (
    <PageShell>
      <SiteHeader
        isConnected={isConnected}
        theme={theme}
        onToggleTheme={onToggleTheme}
        language={language}
        onToggleLanguage={onToggleLanguage}
      />

      {!isCompactNav ? (
        <nav className="flex flex-wrap gap-3 mb-8">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={navButtonClass}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : (
        <div className="mb-8 w-full">
          <button
            type="button"
            onClick={toggleNav}
            aria-expanded={isNavOpen}
            aria-controls="dashboard-mobile-nav"
            className="flex w-full items-center justify-between rounded-[28px] border border-border/70 bg-panel/70 px-5 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-text hover:border-accent transition"
          >
            <span>{isNavOpen ? t({ en: 'Close navigation', ro: 'Închide navigarea' }) : t({ en: 'Open navigation', ro: 'Deschide navigarea' })}</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-panel-dark/60">
              <span className="flex flex-col gap-1.5">
                <span className={`block h-0.5 w-6 rounded-full bg-text transition-transform ${isNavOpen ? 'translate-y-[5px] rotate-45' : ''}`} />
                <span className={`block h-0.5 w-6 rounded-full bg-text transition-opacity ${isNavOpen ? 'opacity-0' : 'opacity-100'}`} />
                <span className={`block h-0.5 w-6 rounded-full bg-text transition-transform ${isNavOpen ? '-translate-y-[5px] -rotate-45' : ''}`} />
              </span>
            </span>
          </button>
          {isNavOpen && (
            <div
              id="dashboard-mobile-nav"
              className="mt-4 flex flex-col gap-3 rounded-[28px] border border-border/70 bg-gradient-to-br from-panel-dark/80 to-panel/80 p-4 shadow-[0_25px_60px_rgba(5,6,10,0.5)]"
            >
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsNavOpen(false)}
                  className="flex items-center justify-between rounded-[22px] border border-border/60 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-text hover:border-accent transition"
                >
                  <span>{link.label}</span>
                  <span className="text-xs text-text-muted">{'>'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <section className="relative overflow-hidden rounded-[34px] border border-border/70 bg-gradient-to-br from-bg-alt/70 via-panel/80 to-panel-dark/80 p-6 sm:p-10 mb-12 dashboard-aurora">
        <div className="pointer-events-none absolute inset-0 opacity-40 grid-overlay animate-float" />
        <div className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 bg-accent/20 blur-[120px] animate-gradient" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 bg-accent-2/25 blur-[120px] animate-gradient" />

        <div className="relative z-10 space-y-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="uppercase tracking-[0.4em] text-[11px] text-text-muted flex items-center gap-2">
                <span className="inline-flex h-1 w-10 rounded-full bg-accent" /> {t({ en: 'Live simulation', ro: 'Simulare live' })}
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                {t({ en: `Skykit Ops Control · Day ${gameState.day}`, ro: `Skykit Ops Control · Ziua ${gameState.day}` })}
              </h2>
              <p className="text-text-muted text-base max-w-2xl mt-3">
                {t({
                  en: 'Monitor the optimizer pulse, track penalties, and trigger reruns with a refined cinematic dash that keeps navigation simple but visuals alive.',
                  ro: 'Monitorizează pulsul optimizerului, urmărește penalizările și declanșează noi rulări într-un tablou cinematic care păstrează navigarea simplă, dar vizualurile vii.'
                })}
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="glass-card rounded-full px-4 py-2 border border-border/70 animate-border-glow">
                  {t({ en: `Current hour · ${gameState.hour}:00`, ro: `Ora curentă · ${gameState.hour}:00` })}
                </span>
                <span className="glass-card rounded-full px-4 py-2 border border-border/70">
                  {t({ en: `Active flights · ${gameState.activeFlights.length}`, ro: `Zboruri active · ${gameState.activeFlights.length}` })}
                </span>
                <span className="glass-card rounded-full px-4 py-2 border border-border/70">
                  {t({ en: `Airports · ${gameState.airports.length}`, ro: `Aeroporturi · ${gameState.airports.length}` })}
                </span>
              </div>
            </div>

            <div className="glass-card float-card rounded-[24px] px-6 py-5 w-full max-w-sm">
              <p className="uppercase tracking-[0.3em] text-xs text-text-muted mb-3">{t({ en: 'Connection', ro: 'Conexiune' })}</p>
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-success shadow-[0_0_14px_rgba(74,223,134,0.7)]' : 'bg-danger shadow-[0_0_14px_rgba(255,90,95,0.5)]'}`} />
                <div>
                  <p className="m-0 text-lg font-semibold">{isConnected ? t({ en: 'Backend channel live', ro: 'Canal backend activ' }) : t({ en: 'Backend offline', ro: 'Backend offline' })}</p>
                  <p className="m-0 text-sm text-text-muted">{isConnected ? t({ en: 'Real-time metrics streaming', ro: 'Metrici în timp real' }) : t({ en: 'Retry connection to sync data', ro: 'Reîncearcă legătura pentru a sincroniza datele' })}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="glass-card float-card rounded-[24px] p-6 border border-border/70">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{t({ en: 'Status', ro: 'Stare' })}</p>
                <span className="text-sm font-mono text-text-muted">{t({ en: `Round ${gameState.stats.roundsCompleted} / 720`, ro: `Runda ${gameState.stats.roundsCompleted} / 720` })}</span>
              </div>
              <p className="text-2xl font-semibold mb-6">
                {gameState.isComplete
                  ? t({ en: 'Simulation complete', ro: 'Simulare finalizată' })
                  : gameState.isRunning
                  ? t({ en: 'Running scenario', ro: 'Scenariu în desfășurare' })
                  : gameState.isStarting
                  ? t({ en: 'Spin-up in progress', ro: 'Pornire în curs' })
                  : t({ en: 'Awaiting start', ro: 'În așteptarea startului' })}
              </p>
              <div className="relative h-2 rounded-full bg-border">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent via-accent-2 to-warning animate-gradient"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-text-muted">
                {t({ en: `${(progress * 100).toFixed(1)}% complete`, ro: `${(progress * 100).toFixed(1)}% finalizat` })}
              </p>
            </div>

            <div className="glass-card float-card rounded-[24px] p-6 border border-border/70 space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{t({ en: 'Insights', ro: 'Perspective' })}</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">{t({ en: 'Events logged', ro: 'Evenimente înregistrate' })}</span>
                  <strong className="text-lg">{gameState.events.length}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">{t({ en: 'Recent penalties', ro: 'Penalizări recente' })}</span>
                  <strong className="text-lg">{gameState.recentPenalties.length}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-sm">{t({ en: 'Avg cost / round', ro: 'Cost mediu / rundă' })}</span>
                  <strong className="text-lg">{formatCost(gameState.stats.roundsCompleted ? gameState.stats.totalCost / gameState.stats.roundsCompleted : 0)}</strong>
                </div>
              </div>
            </div>

            <div className="glass-card float-card rounded-[24px] p-6 border border-border/70">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted mb-5">{t({ en: 'Timeline', ro: 'Cronologie' })}</p>
              <div className="space-y-4">
                {[{ label: t({ en: 'Morning sort', ro: 'Sortare matinală' }), time: '08:00', active: gameState.hour < 12 }, { label: t({ en: 'Peak ops', ro: 'Vârf operațional' }), time: '16:00', active: gameState.hour >= 12 && gameState.hour < 20 }, { label: t({ en: 'Overnight recovery', ro: 'Recuperare de noapte' }), time: '23:00', active: gameState.hour >= 20 || gameState.hour < 5 }].map(stage => (
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
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{t({ en: 'Key metrics', ro: 'Indicatori cheie' })}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {metricBlocks.map(metric => (
                <div
                  key={metric.label}
                  className="glass-card float-card rounded-[22px] p-5 border border-border/60 flex items-center justify-between backdrop-blur-xl"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{metric.label}</p>
                    <p className="text-2xl font-semibold mt-1">{metric.value}</p>
                    {metric.detail && (
                      <p className="text-xs text-text-muted mt-1 tracking-[0.15em] uppercase">{metric.detail}</p>
                    )}
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
            language={language}
          />
        </div>
      </section>
    </PageShell>
  );
}

export default HomePage;
