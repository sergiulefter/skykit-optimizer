/**
 * Flight Loading Module
 * Calculates optimal kit loading for departing flights
 */

import {
  PerClassAmount,
  FlightEvent,
  Airport,
  Aircraft,
  KIT_CLASSES,
  FlightLoadDto,
  copyPerClass
} from '../types';
import { LoadingConfig, DEFAULT_LOADING_CONFIG } from './types';
import { InventoryManager } from './inventory';
import { DemandForecaster } from './forecasting';

export class FlightLoader {
  private inventoryManager: InventoryManager;
  private demandForecaster: DemandForecaster;
  private aircraftTypes: Map<string, Aircraft>;
  private config: LoadingConfig;

  constructor(
    inventoryManager: InventoryManager,
    demandForecaster: DemandForecaster,
    aircraftTypes: Map<string, Aircraft>,
    config: LoadingConfig = DEFAULT_LOADING_CONFIG
  ) {
    this.inventoryManager = inventoryManager;
    this.demandForecaster = demandForecaster;
    this.aircraftTypes = aircraftTypes;
    this.config = config;
  }

  /**
   * Calculate what kits to load on all departing flights
   */
  calculateFlightLoads(
    flightsReadyToDepart: FlightEvent[],
    currentDay: number,
    currentHour: number,
    knownFlights: Map<string, FlightEvent>
  ): FlightLoadDto[] {
    const loads: FlightLoadDto[] = [];

    // EARLY-GAME FLAGS:
    // - isEarlyGame: Day 0-2 - don't send extra kits to spokes, preserve HUB1 stock
    const isEarlyGame = currentDay <= 2;

    // END-GAME FLAGS:
    // - isLastDay: Day 29 - game ends, don't send extra kits anywhere
    // - isNearEnd: Day 28+ - reduce extra loading significantly
    // - isEndGame: Day 27+ - start returning kits to HUB1
    const isLastDay = currentDay >= 29;
    const isNearEnd = currentDay >= 28;
    const isEndGame = currentDay >= 27;

    // Sort flights by priority
    const sortedFlights = this.sortFlightsByPriority(flightsReadyToDepart);

    for (const flight of sortedFlights) {
      const load = this.calculateSingleFlightLoad(
        flight,
        currentDay,
        currentHour,
        knownFlights,
        isEndGame,
        isNearEnd,
        isLastDay,
        isEarlyGame
      );

      if (load) {
        loads.push(load);
      }
    }

    return loads;
  }

  /**
   * Sort flights by priority for loading
   * - HUB1 departures first (distribute kits to spokes)
   * - Then by distance (higher penalty if unfulfilled)
   */
  private sortFlightsByPriority(flights: FlightEvent[]): FlightEvent[] {
    return [...flights].sort((a, b) => {
      // HUB1 departures first
      if (a.originAirport === 'HUB1' && b.originAirport !== 'HUB1') return -1;
      if (b.originAirport === 'HUB1' && a.originAirport !== 'HUB1') return 1;

      // Then by distance
      const distA = this.demandForecaster.getFlightDistance(a.originAirport, a.destinationAirport);
      const distB = this.demandForecaster.getFlightDistance(b.originAirport, b.destinationAirport);
      return distB - distA;
    });
  }

  /**
   * Calculate load for a single flight
   */
  private calculateSingleFlightLoad(
    flight: FlightEvent,
    currentDay: number,
    currentHour: number,
    knownFlights: Map<string, FlightEvent>,
    isEndGame: boolean,
    isNearEnd: boolean,
    isLastDay: boolean,
    isEarlyGame: boolean
  ): FlightLoadDto | null {
    const originStock = this.inventoryManager.getStock(flight.originAirport);
    const aircraft = this.aircraftTypes.get(flight.aircraftType);

    if (!originStock || !aircraft) {
      console.warn(`[FLIGHT_LOADER] Missing data for flight ${flight.flightNumber} from ${flight.originAirport}`);
      return null;
    }

    const loadedKits: PerClassAmount = {
      first: 0,
      business: 0,
      premiumEconomy: 0,
      economy: 0
    };

    for (const kitClass of KIT_CLASSES) {
      const toLoad = this.calculateKitsToLoad(
        flight,
        kitClass,
        originStock,
        aircraft,
        currentDay,
        currentHour,
        knownFlights,
        isEndGame,
        isNearEnd,
        isLastDay,
        isEarlyGame
      );

      loadedKits[kitClass] = toLoad;

      // Deduct from stock - this MUST happen for subsequent flights to see reduced stock
      if (!this.inventoryManager.deductStock(flight.originAirport, kitClass, toLoad)) {
        console.error(`[FLIGHT_LOADER] Failed to deduct ${toLoad} ${kitClass} from ${flight.originAirport}`);
      }
    }

    // Track this flight's kits as in-flight
    this.inventoryManager.trackInFlightKits(
      flight.flightId,
      flight.destinationAirport,
      loadedKits,
      flight.arrival.day,
      flight.arrival.hour
    );

    // Debug logging for end-game
    const totalLoaded = loadedKits.first + loadedKits.business + loadedKits.premiumEconomy + loadedKits.economy;
    if (totalLoaded > 0 && currentDay >= 25) {
      console.log(`  [LOAD] Flight ${flight.flightNumber} ${flight.originAirport}→${flight.destinationAirport}: EC=${loadedKits.economy}, BC=${loadedKits.business}, PE=${loadedKits.premiumEconomy}, FC=${loadedKits.first}`);
    }

    return {
      flightId: flight.flightId,
      loadedKits
    };
  }

  /**
   * Calculate how many kits of a specific class to load on a flight
   */
  private calculateKitsToLoad(
    flight: FlightEvent,
    kitClass: keyof PerClassAmount,
    originStock: PerClassAmount,
    aircraft: Aircraft,
    currentDay: number,
    currentHour: number,
    knownFlights: Map<string, FlightEvent>,
    isEndGame: boolean,
    isNearEnd: boolean,
    isLastDay: boolean,
    isEarlyGame: boolean
  ): number {
    const demand = flight.passengers[kitClass];
    const rawAvailable = originStock[kitClass];

    // Safety buffer to avoid negative inventory
    // EARLY-GAME: Use larger buffer (500) to protect HUB1 stock
    const isHub = flight.originAirport === 'HUB1';
    const baseBuffer = isHub ? this.config.safetyBuffer.hub : this.config.safetyBuffer.spoke;
    const safetyBuffer = isHub && isEarlyGame ? 500 : baseBuffer;
    const available = Math.max(0, rawAvailable - safetyBuffer);
    const capacity = aircraft.kitCapacity[kitClass];

    // Load passenger demand first - NEVER exceed available stock
    let toLoad = Math.min(demand, available, capacity);

    // DAY 29 (isLastDay): Don't send ANY extra kits - game is ending
    // Just load what's needed for passenger demand
    if (isLastDay) {
      // CRITICAL SAFETY CHECK: Never go negative
      return Math.min(toLoad, rawAvailable);
    }

    // EARLY-GAME (Day 0-2): Don't send extra kits to spokes - preserve HUB1 stock!
    // This prevents HUB1 from going negative while purchases are still ramping up
    if (isEarlyGame && flight.originAirport === 'HUB1') {
      // Only load passenger demand, no extra for spoke deficits
      return Math.min(toLoad, rawAvailable);
    }

    // OPTIMIZATION: For flights FROM HUB1, load extra kits for destination deficit
    // BUT: On Day 28+ (isNearEnd), significantly reduce or stop extra loading
    if (this.config.enableExtraLoadingToSpokes &&
        flight.originAirport === 'HUB1' &&
        toLoad < capacity &&
        available > toLoad &&
        !isNearEnd) {  // STOP extra loading on Day 28+
      const extraKits = this.calculateExtraKitsForDestination(
        flight,
        kitClass,
        toLoad,
        available,
        capacity,
        currentDay,
        currentHour,
        knownFlights
      );
      toLoad += extraKits;
    }

    // OPTIMIZATION: For flights TO HUB1, load extra kits to bring back
    if (this.config.enableReturnToHub &&
        flight.destinationAirport === 'HUB1' &&
        toLoad < capacity &&
        available > toLoad) {
      const extraKits = this.calculateExtraKitsForHubReturn(
        flight,
        kitClass,
        toLoad,
        available,
        capacity,
        currentDay,
        currentHour,
        knownFlights,
        isEndGame
      );
      toLoad += extraKits;
    }

    // CRITICAL SAFETY CHECK: Never go negative
    if (toLoad > rawAvailable) {
      console.error(`[BUG PREVENTED] Would go negative! ${kitClass}: toLoad=${toLoad}, rawAvailable=${rawAvailable}, flight=${flight.flightNumber}`);
      toLoad = Math.max(0, rawAvailable);
    }

    return Math.min(toLoad, rawAvailable);
  }

  /**
   * Calculate extra kits to send to destination based on their deficit
   */
  private calculateExtraKitsForDestination(
    flight: FlightEvent,
    kitClass: keyof PerClassAmount,
    alreadyLoaded: number,
    available: number,
    capacity: number,
    currentDay: number,
    currentHour: number,
    knownFlights: Map<string, FlightEvent>
  ): number {
    const destStock = this.inventoryManager.getStock(flight.destinationAirport);
    const destAirport = this.inventoryManager.getAirport(flight.destinationAirport);

    if (!destStock || !destAirport) return 0;

    // GAME-END AWARE: Calculate remaining hours until game ends (Day 29, Hour 23)
    const remainingHours = Math.max(0, (29 - currentDay) * 24 + (23 - currentHour));

    // If less than 12 hours remaining, don't send extra kits
    if (remainingHours < 12) {
      return 0;
    }

    // Adjust forecast hours based on remaining game time
    const forecastHours = Math.min(this.config.destinationForecastHours, remainingHours);

    // Calculate destination's demand within adjusted forecast window
    const destDemand = this.demandForecaster.calculateDemandForAirport(
      flight.destinationAirport,
      currentDay,
      currentHour,
      forecastHours,
      kitClass,
      knownFlights
    );

    // Calculate what will be available at destination
    const destCurrent = destStock[kitClass];
    const inFlightToDestination = this.inventoryManager.getInFlightKitsToAirport(flight.destinationAirport, kitClass);
    const processingAtDestination = this.inventoryManager.getProcessingKitsAtAirport(flight.destinationAirport, kitClass);
    const destExpected = destCurrent + inFlightToDestination + processingAtDestination;

    // Calculate actual deficit
    const destDeficit = Math.max(0, destDemand - destExpected);

    // Check capacity constraint - SAFETY: Don't send if room < 100
    const destCapacity = destAirport.capacity[kitClass];
    const destRoom = Math.max(0, destCapacity - destCurrent - inFlightToDestination - processingAtDestination);

    if (destRoom < 100) {
      return 0;  // Spoke is near capacity, don't risk overflow
    }

    // Calculate how many extra we can load
    const remainingCapacity = capacity - alreadyLoaded;
    const remainingStock = available - alreadyLoaded;

    return Math.min(destDeficit, destRoom, remainingCapacity, remainingStock);
  }

  /**
   * Calculate extra kits to return to hub
   */
  private calculateExtraKitsForHubReturn(
    flight: FlightEvent,
    kitClass: keyof PerClassAmount,
    alreadyLoaded: number,
    available: number,
    capacity: number,
    currentDay: number,
    currentHour: number,
    knownFlights: Map<string, FlightEvent>,
    isEndGame: boolean
  ): number {
    // Check HUB1 capacity before sending kits back
    const hubStock = this.inventoryManager.getStock('HUB1');
    const hubAirport = this.inventoryManager.getAirport('HUB1');

    if (!hubStock || !hubAirport) return 0;

    const hubCurrentStock = hubStock[kitClass];
    const hubCapacity = hubAirport.capacity[kitClass];
    const hubInFlight = this.inventoryManager.getInFlightKitsToAirport('HUB1', kitClass);
    const hubProcessing = this.inventoryManager.getProcessingKitsAtAirport('HUB1', kitClass);
    const hubExpected = hubCurrentStock + hubInFlight + hubProcessing;
    const hubRoom = Math.max(0, hubCapacity - hubExpected);

    const remainingCapacity = capacity - alreadyLoaded;

    if (isEndGame) {
      // END-GAME: Send kits back, but respect HUB1 capacity
      return Math.min(remainingCapacity, available - alreadyLoaded, hubRoom);
    } else {
      // Normal mode: only send surplus
      const upcomingDemand = this.demandForecaster.calculateDemandForAirport(
        flight.originAirport,
        currentDay,
        currentHour,
        this.config.destinationForecastHours,
        kitClass,
        knownFlights
      );
      const currentStock = available - alreadyLoaded;
      const surplus = Math.max(0, currentStock - upcomingDemand);

      if (surplus > 0 && hubRoom > 0) {
        return Math.min(remainingCapacity, surplus, hubRoom);
      }
    }

    return 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoadingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoadingConfig {
    return this.config;
  }
}
