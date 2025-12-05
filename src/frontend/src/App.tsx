import { useGameState } from './hooks/useGameState';
import { StatsGrid } from './components/StatsGrid';
import { InventoryPanel } from './components/InventoryPanel';
import { MapPanel } from './components/MapPanel';
import { EventsPanel } from './components/EventsPanel';
import { SimControls } from './components/SimControls';

function App() {
  const { state, isLoading, error, isConnected, startGame } = useGameState(1000);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[length:24px_24px] p-10">
        <div className="flex flex-col items-center justify-center min-h-[200px] text-text-muted">
          <div className="w-10 h-10 border-3 border-border border-t-accent rounded-full animate-spin mb-4" />
          <p>Connecting to backend...</p>
        </div>
      </div>
    );
  }

  if (error && !isConnected) {
    return (
      <div className="min-h-screen bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[length:24px_24px] p-10">
        <header className="flex justify-between items-center gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="text-3xl text-accent">◆</span>
            <div>
              <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-0.5">SkyKit Optimizer</p>
              <h1 className="m-0 text-xl">Rotable Kit Logistics Optimizer</h1>
            </div>
          </div>
        </header>

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
      </div>
    );
  }

  // Default empty state
  const gameState = state || {
    day: 0,
    hour: 0,
    round: 0,
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

  return (
    <div className="min-h-screen bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[length:24px_24px] p-10">
      <header className="flex justify-between items-center gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="text-3xl text-accent">◆</span>
          <div>
            <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-0.5">SkyKit Optimizer</p>
            <h1 className="m-0 text-xl">Rotable Kit Logistics Optimizer</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-success animate-pulse-opacity' : 'bg-text-muted'}`} />
          <span className="text-text-muted text-sm">
            {isConnected ? 'Connected to backend' : 'Disconnected'}
          </span>
        </div>
      </header>

      <section className="bg-gradient-to-br from-bg-alt/95 to-panel-dark/95 rounded-[34px] p-10 mb-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02),0_30px_80px_rgba(6,6,10,0.7)]">
        <div className="mb-6">
          <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-0.5">Live Simulation Dashboard</p>
          <h2 className="mt-1 mb-6 text-4xl">Day {gameState.day} · Hour {gameState.hour}</h2>
        </div>

        <StatsGrid
          stats={gameState.stats}
          day={gameState.day}
          hour={gameState.hour}
        />

        <div className="grid grid-cols-[300px_minmax(280px,1fr)_350px] gap-5 mb-6 max-xl:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
          <InventoryPanel airports={gameState.airports} />
          <MapPanel activeFlights={gameState.activeFlights} />
          <EventsPanel
            events={gameState.events}
            penalties={gameState.recentPenalties}
          />
        </div>

        <SimControls
          isRunning={gameState.isRunning}
          isComplete={gameState.isComplete}
          round={gameState.stats.roundsCompleted}
          onStartGame={startGame}
        />
      </section>
    </div>
  );
}

export default App;
