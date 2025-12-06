// === Clase comune ===
export interface PerClassAmount {
  first: number;
  business: number;
  premiumEconomy: number;
  economy: number;
}

export interface ReferenceHour {
  day: number;
  hour: number;
}

// === Date statice (din CSV) ===
export interface Aircraft {
  typeCode: string;
  seats: PerClassAmount;
  kitCapacity: PerClassAmount;
  costPerKgPerKm: number;
}

export interface Airport {
  code: string;
  name: string;
  isHub: boolean;
  processingTime: PerClassAmount;
  processingCost: PerClassAmount;
  loadingCost: PerClassAmount;
  initialStock: PerClassAmount;
  capacity: PerClassAmount;
}

export interface FlightPlan {
  departCode: string;
  arrivalCode: string;
  scheduledHour: number;
  scheduledArrivalHour: number;
  arrivalNextDay: boolean;
  distanceKm: number;
  weekdays: boolean[];
}

// === API Types ===
export interface FlightLoadDto {
  flightId: string;
  loadedKits: PerClassAmount;
}

export interface HourRequestDto {
  day: number;
  hour: number;
  flightLoads: FlightLoadDto[];
  kitPurchasingOrders?: PerClassAmount;
}

export type FlightEventType = 'SCHEDULED' | 'CHECKED_IN' | 'LANDED';

export interface FlightEvent {
  eventType: FlightEventType;
  flightNumber: string;
  flightId: string;
  originAirport: string;
  destinationAirport: string;
  departure: ReferenceHour;
  arrival: ReferenceHour;
  passengers: PerClassAmount;
  aircraftType: string;
  distance: number;  // Distance in km (scheduled for SCHEDULED/CHECKED_IN, actual for LANDED)
}

export interface PenaltyDto {
  code: string;
  flightId?: string;
  flightNumber?: string;
  issuedDay: number;
  issuedHour: number;
  penalty: number;
  reason: string;
}

export interface HourResponseDto {
  day: number;
  hour: number;
  flightUpdates: FlightEvent[];
  penalties: PenaltyDto[];
  totalCost: number;
}

// === Game State ===
export interface ProcessingKit {
  airportCode: string;
  kits: PerClassAmount;
  readyAt: ReferenceHour;
}

export interface GameState {
  currentDay: number;
  currentHour: number;
  sessionId: string;
  totalCost: number;
  airportStocks: Map<string, PerClassAmount>;
  processingKits: ProcessingKit[];
  knownFlights: Map<string, FlightEvent>;
  departingFlights: FlightEvent[];
}

// === Helpers ===
export const EMPTY_PER_CLASS: PerClassAmount = {
  first: 0,
  business: 0,
  premiumEconomy: 0,
  economy: 0
};

export const KIT_CLASSES = ['first', 'business', 'premiumEconomy', 'economy'] as const;
export type KitClass = typeof KIT_CLASSES[number];

// Helper function to create a copy of PerClassAmount
export function copyPerClass(source: PerClassAmount): PerClassAmount {
  return {
    first: source.first,
    business: source.business,
    premiumEconomy: source.premiumEconomy,
    economy: source.economy
  };
}

// Helper function to add two PerClassAmount objects
export function addPerClass(a: PerClassAmount, b: PerClassAmount): PerClassAmount {
  return {
    first: a.first + b.first,
    business: a.business + b.business,
    premiumEconomy: a.premiumEconomy + b.premiumEconomy,
    economy: a.economy + b.economy
  };
}

// Helper function to subtract two PerClassAmount objects
export function subtractPerClass(a: PerClassAmount, b: PerClassAmount): PerClassAmount {
  return {
    first: a.first - b.first,
    business: a.business - b.business,
    premiumEconomy: a.premiumEconomy - b.premiumEconomy,
    economy: a.economy - b.economy
  };
}
