import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:3001';

// Types matching shared/types.ts
export interface PerClassAmount {
  first: number;
  business: number;
  premiumEconomy: number;
  economy: number;
}

export interface AirportStock {
  code: string;
  name: string;
  isHub: boolean;
  stock: PerClassAmount;
  capacity: PerClassAmount;
  isLowStock: boolean;
}

export interface FlightInfo {
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDay: number;
  departureHour: number;
  arrivalDay: number;
  arrivalHour: number;
  passengers: PerClassAmount;
  aircraftType: string;
  status: 'SCHEDULED' | 'CHECKED_IN' | 'LANDED';
}

export interface PenaltyInfo {
  code: string;
  amount: number;
  reason: string;
  flightId?: string;
  flightNumber?: string;
  issuedDay: number;
  issuedHour: number;
}

// Penalties grouped by day (day number -> array of penalties)
export interface PenaltiesByDay {
  [day: number]: PenaltyInfo[];
}

export interface GameEvent {
  type: 'flight' | 'purchase' | 'warning' | 'penalty';
  text: string;
  timestamp: string;
}

export interface GameStats {
  totalCost: number;
  transportCost: number;
  processingCost: number;
  purchaseCost: number;
  penaltyCost: number;
  totalPenalties: number;
  roundsCompleted: number;
  comparableScore: number;
  endOfGameFlightPenalty: number;
}

export interface GameStateSnapshot {
  day: number;
  hour: number;
  round: number;
  isStarting: boolean;
  isRunning: boolean;
  isComplete: boolean;
  stats: GameStats;
  airports: AirportStock[];
  activeFlights: FlightInfo[];
  events: GameEvent[];
  recentPenalties: PenaltyInfo[];
  penaltiesByDay: PenaltiesByDay;
}

export interface UseGameStateResult {
  state: GameStateSnapshot | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => Promise<void>;
  startGame: () => Promise<{ success: boolean; message: string }>;
}

export function useGameState(pollInterval: number = 1000): UseGameStateResult {
  const [state, setState] = useState<GameStateSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/state`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data: GameStateSnapshot = await response.json();
      setState(data);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchState();

    // Set up polling
    const interval = setInterval(fetchState, pollInterval);

    return () => clearInterval(interval);
  }, [fetchState, pollInterval]);

  const startGame = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, message: data.error || 'Failed to start game' };
      }
      return { success: true, message: data.message || 'Game started' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to start game' };
    }
  }, []);

  return {
    state,
    isLoading,
    error,
    isConnected,
    refresh: fetchState,
    startGame
  };
}

export default useGameState;
