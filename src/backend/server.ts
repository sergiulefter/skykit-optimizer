import express, { Request, Response } from 'express';
import cors from 'cors';
import { GameState } from './engine/state';
import { Airport } from './types';
import {
  GameStateSnapshot,
  AirportStock,
  FlightInfo,
  PenaltyInfo,
  GameEvent,
  GameStats,
  PenaltiesByDay
} from '../shared/types';

const PORT = 3001;

// Singleton game state reference (set by game loop)
let currentGameState: GameState | null = null;
let currentStats: GameStats = {
  totalCost: 0,
  transportCost: 0,
  processingCost: 0,
  purchaseCost: 0,
  penaltyCost: 0,
  totalPenalties: 0,
  roundsCompleted: 0,
  comparableScore: 0,
  endOfGameFlightPenalty: 0
};
let recentEvents: GameEvent[] = [];
let recentPenalties: PenaltyInfo[] = [];
let penaltiesByDay: PenaltiesByDay = {};  // ALL penalties grouped by day
let isGameRunning = false;
let isGameComplete = false;
let isGameStarting = false;  // True while eval-platform is starting
let airportsData: Map<string, Airport> = new Map();

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', gameRunning: isGameRunning });
});

// Get full game state snapshot
app.get('/api/state', (_req: Request, res: Response) => {
  if (!currentGameState) {
    res.json({
      day: 0,
      hour: 0,
      round: 0,
      isStarting: isGameStarting,
      isRunning: false,
      isComplete: false,
      stats: currentStats,
      airports: [],
      activeFlights: [],
      events: recentEvents.slice(-50),
      recentPenalties: [],
      penaltiesByDay: penaltiesByDay
    } as GameStateSnapshot);
    return;
  }

  const snapshot: GameStateSnapshot = {
    day: currentGameState.currentDay,
    hour: currentGameState.currentHour,
    round: currentGameState.currentDay * 24 + currentGameState.currentHour,
    isStarting: isGameStarting,
    isRunning: isGameRunning,
    isComplete: isGameComplete,
    stats: currentStats,
    airports: getAirportStocks(),
    activeFlights: getActiveFlights(),
    events: recentEvents.slice(-50),
    recentPenalties: recentPenalties.slice(-20),
    penaltiesByDay: penaltiesByDay
  };

  res.json(snapshot);
});

// Get just airports
app.get('/api/airports', (_req: Request, res: Response) => {
  res.json(getAirportStocks());
});

// Get just stats
app.get('/api/stats', (_req: Request, res: Response) => {
  res.json(currentStats);
});

// Get just events
app.get('/api/events', (_req: Request, res: Response) => {
  res.json(recentEvents.slice(-50));
});

// Get just penalties
app.get('/api/penalties', (_req: Request, res: Response) => {
  res.json(recentPenalties.slice(-20));
});

// Helper: Convert game state airports to API format
function getAirportStocks(): AirportStock[] {
  if (!currentGameState) return [];

  const result: AirportStock[] = [];

  for (const [code, stock] of currentGameState.airportStocks) {
    const airportInfo = airportsData.get(code);
    const capacity = airportInfo?.capacity || { first: 0, business: 0, premiumEconomy: 0, economy: 0 };

    // Calculate if low stock (any class below 20% capacity)
    const isLowStock =
      (capacity.first > 0 && stock.first < capacity.first * 0.2) ||
      (capacity.business > 0 && stock.business < capacity.business * 0.2) ||
      (capacity.premiumEconomy > 0 && stock.premiumEconomy < capacity.premiumEconomy * 0.2) ||
      (capacity.economy > 0 && stock.economy < capacity.economy * 0.2);

    result.push({
      code,
      name: airportInfo?.name || code,
      isHub: airportInfo?.isHub || false,
      stock: { ...stock },
      capacity: { ...capacity },
      isLowStock
    });
  }

  // Sort: HUB first, then by code
  result.sort((a, b) => {
    if (a.isHub && !b.isHub) return -1;
    if (!a.isHub && b.isHub) return 1;
    return a.code.localeCompare(b.code);
  });

  return result;
}

// Helper: Convert known flights to API format
function getActiveFlights(): FlightInfo[] {
  if (!currentGameState) return [];

  const result: FlightInfo[] = [];

  for (const flight of currentGameState.knownFlights.values()) {
    // Only include non-landed flights
    if (flight.eventType !== 'LANDED') {
      result.push({
        flightId: flight.flightId,
        flightNumber: flight.flightNumber,
        origin: flight.originAirport,
        destination: flight.destinationAirport,
        departureDay: flight.departure.day,
        departureHour: flight.departure.hour,
        arrivalDay: flight.arrival.day,
        arrivalHour: flight.arrival.hour,
        passengers: { ...flight.passengers },
        aircraftType: flight.aircraftType,
        status: flight.eventType
      });
    }
  }

  return result;
}

// === Game control callback ===
let startGameCallback: (() => Promise<void>) | null = null;

// Start game endpoint
app.post('/api/game/start', async (_req: Request, res: Response) => {
  if (isGameStarting) {
    res.status(400).json({ error: 'Game is already starting (eval-platform loading)' });
    return;
  }
  if (isGameRunning) {
    res.status(400).json({ error: 'Game is already running' });
    return;
  }
  if (!startGameCallback) {
    res.status(500).json({ error: 'Game not initialized' });
    return;
  }

  // Mark as starting immediately
  isGameStarting = true;

  // Start game in background
  res.json({ status: 'started', message: 'Game simulation started' });

  // Run game asynchronously
  startGameCallback().catch(err => {
    console.error('[GAME] Error:', err);
    addEvent({ type: 'warning', text: `Game error: ${err}`, timestamp: new Date().toISOString() });
  }).finally(() => {
    isGameStarting = false;
  });
});

// Register the game start callback
export function registerGameCallback(callback: () => Promise<void>): void {
  startGameCallback = callback;
}

// === API for game loop to update state ===

export function setGameState(state: GameState, airports: Map<string, Airport>): void {
  currentGameState = state;
  airportsData = airports;
}

export function updateStats(stats: Partial<GameStats>): void {
  currentStats = { ...currentStats, ...stats };
}

export function addEvent(event: GameEvent): void {
  recentEvents.push(event);
  // Keep only last 100 events in memory
  if (recentEvents.length > 100) {
    recentEvents = recentEvents.slice(-100);
  }
}

export function addPenalty(penalty: PenaltyInfo): void {
  recentPenalties.push(penalty);
  // Keep only last 50 penalties in memory for recentPenalties
  if (recentPenalties.length > 50) {
    recentPenalties = recentPenalties.slice(-50);
  }

  // Also store in penaltiesByDay (ALL penalties, no limit)
  const day = penalty.issuedDay;
  if (!penaltiesByDay[day]) {
    penaltiesByDay[day] = [];
  }
  penaltiesByDay[day].push(penalty);
}

export function setGameRunning(running: boolean): void {
  isGameRunning = running;
}

export function setGameComplete(complete: boolean): void {
  isGameComplete = complete;
}

export function clearState(): void {
  recentEvents = [];
  recentPenalties = [];
  penaltiesByDay = {};  // Reset all penalties by day
  currentStats = {
    totalCost: 0,
    transportCost: 0,
    processingCost: 0,
    purchaseCost: 0,
    penaltyCost: 0,
    totalPenalties: 0,
    roundsCompleted: 0,
    comparableScore: 0,
    endOfGameFlightPenalty: 0
  };
  isGameRunning = false;
  isGameComplete = false;
}

// Start Express server
export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`[SERVER] API server running on http://localhost:${PORT}`);
      console.log(`[SERVER] Frontend can connect to /api/state for game updates`);
      resolve();
    });
  });
}
