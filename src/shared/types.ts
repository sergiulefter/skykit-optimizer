// Shared types between backend and frontend

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
  // FIX 25: Comparable score (excluding END_OF_GAME_UNFULFILLED_FLIGHT_KITS)
  comparableScore: number;
  endOfGameFlightPenalty: number;
}

export interface GameStateSnapshot {
  // Current time
  day: number;
  hour: number;
  round: number; // day * 24 + hour

  // Game status
  isStarting: boolean;  // True while eval-platform is starting
  isRunning: boolean;
  isComplete: boolean;

  // Statistics
  stats: GameStats;

  // Airport inventories
  airports: AirportStock[];

  // Active flights
  activeFlights: FlightInfo[];

  // Recent events (last 50)
  events: GameEvent[];

  // Recent penalties (last 20)
  recentPenalties: PenaltyInfo[];

  // ALL penalties grouped by day
  penaltiesByDay: PenaltiesByDay;
}
