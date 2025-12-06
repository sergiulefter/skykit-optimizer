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
import { getAdaptiveEngine } from './adaptive';
import { problemLogger } from './problemLogger';

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
   * Calculate economy load factor for a specific flight based on its economics
   *
   * This is a FIRST-PRINCIPLES calculation that generalizes to any dataset:
   * 1. Calculate transport cost per kit (loading + movement + processing)
   * 2. Calculate penalty per kit if not loaded (0.003 × distance × $50)
   * 3. Use ratio to determine optimal load factor
   *
   * Higher penalty/cost ratio → load more (penalty dominates)
   * Lower penalty/cost ratio → load less (cost matters more)
   *
   * @param flight The flight to calculate for
   * @returns Load factor between 0.70 and 0.90
   */
  private calculateEconomyLoadFactorForFlight(flight: FlightEvent): number {
    // Get route-specific costs from actual game data
    const originAirport = this.inventoryManager.getAirport(flight.originAirport);
    const destAirport = this.inventoryManager.getAirport(flight.destinationAirport);
    const aircraft = this.aircraftTypes.get(flight.aircraftType);

    const distance = this.demandForecaster.getFlightDistance(
      flight.originAirport,
      flight.destinationAirport
    );

    // Calculate cost to transport one economy kit on this flight
    // Uses actual airport costs from CSV data
    const loadingCost = originAirport?.loadingCost?.economy ?? 2.0;
    const fuelRate = aircraft?.costPerKgPerKm ?? 0.001;
    const movementCost = distance * fuelRate * 1.5;  // 1.5kg per economy kit
    const processingCost = destAirport?.processingCost?.economy ?? 4.0;
    const totalCost = loadingCost + movementCost + processingCost;

    // Calculate penalty for NOT loading one economy kit
    // From game rules: 0.003 × distance × kitCost
    const penaltyPerKit = 0.003 * distance * 50;  // $50 = economy kit cost

    // Economic ratio: how much more expensive is the penalty vs the transport cost?
    const ratio = penaltyPerKit / totalCost;

    // Map ratio to load factor using policy thresholds
    // These are POLICY CHOICES, not dataset-specific tuning:
    // - 70% minimum: Never skip more than 30% of economy demand
    // - 90% maximum: Always skip at least 10% (accounts for overflow risk)
    if (ratio >= 80) return 0.90;
    if (ratio >= 50) return 0.85;
    if (ratio >= 30) return 0.80;
    if (ratio >= 15) return 0.75;
    return 0.70;
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
    // - isNearEnd: Day 20+ - STOP extra loading to prevent spoke overflow (was Day 28)
    // - isEndGame: Day 27+ - start returning kits to HUB1
    const isLastDay = currentDay >= 29;
    const isNearEnd = currentDay >= 15;  // Original value - optimizations didn't help
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
   * - Then by PENALTY EXPOSURE (not just distance)
   *
   * Penalty exposure = passengers × distance × class_factor
   * This ensures high-value flights get loaded first when stock is abundant
   */
  private sortFlightsByPriority(flights: FlightEvent[]): FlightEvent[] {
    return [...flights].sort((a, b) => {
      // HUB1 departures first
      if (a.originAirport === 'HUB1' && b.originAirport !== 'HUB1') return -1;
      if (b.originAirport === 'HUB1' && a.originAirport !== 'HUB1') return 1;

      // Then by penalty exposure (higher exposure = higher priority)
      const exposureA = this.calculatePenaltyExposure(a);
      const exposureB = this.calculatePenaltyExposure(b);
      return exposureB - exposureA;
    });
  }

  /**
   * Calculate penalty exposure for a flight
   * Higher exposure = more costly if unfulfilled
   *
   * Formula: sum(passengers[class] × distance × penaltyFactor[class])
   * Penalty factors derived from actual game penalty rates
   */
  private calculatePenaltyExposure(flight: FlightEvent): number {
    const distance = this.demandForecaster.getFlightDistance(
      flight.originAirport,
      flight.destinationAirport
    );

    // Penalty factors per kit class (relative cost if unfulfilled)
    // First class unfulfilled is ~3x more expensive than economy per kit
    const factors: Record<keyof PerClassAmount, number> = {
      first: 0.010,         // Highest penalty per kit
      business: 0.006,
      premiumEconomy: 0.004,
      economy: 0.003        // Lowest but highest volume
    };

    let exposure = 0;
    for (const kitClass of KIT_CLASSES) {
      exposure += flight.passengers[kitClass] * distance * factors[kitClass];
    }

    return exposure;
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
      // FIX 24: ALWAYS return a load, even with 0 kits - otherwise server applies END_OF_GAME_UNFULFILLED_FLIGHT_KITS penalty!
      return {
        flightId: flight.flightId,
        loadedKits: { first: 0, business: 0, premiumEconomy: 0, economy: 0 }
      };
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

    return {
      flightId: flight.flightId,
      loadedKits
    };
  }

  /**
   * Calculate how many kits of a specific class to load on a flight
   *
   * PARTIAL LOADING: Load less than 100% of demand for economy class
   *
   * Why this works:
   * - Economy has lowest penalty per kit (0.003 × dist × $50 vs $200 for First)
   * - Loading has costs (movement, processing) that partially offset penalty savings
   * - Reducing economy loading saves costs while accepting small penalty increase
   *
   * Generalization note: The 80% factor is tuned but the PRINCIPLE generalizes:
   * - Economy should always be reduced more than other classes (lowest penalty)
   * - If a new dataset has very different distances, this factor may need adjustment
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
    // Load factors per class - economy is calculated PER-FLIGHT based on route economics
    // First/Business/PE stay at 100% because their unfulfilled penalties are high
    // Economy gets dynamic factor based on penalty/cost ratio for THIS specific flight
    const economyFactor = kitClass === 'economy'
      ? this.calculateEconomyLoadFactorForFlight(flight)
      : 1.0;

    const LOAD_FACTOR: Record<keyof PerClassAmount, number> = {
      first: 1.0,           // $200 kit cost - high penalty, load 100%
      business: 1.0,        // $150 kit cost - high penalty, load 100%
      premiumEconomy: 1.0,  // $100 kit cost - medium penalty, load 100%
      economy: economyFactor  // Calculated per-flight from first principles
    };

    const rawDemand = flight.passengers[kitClass];
    const demand = Math.floor(rawDemand * LOAD_FACTOR[kitClass]);
    const rawAvailable = originStock[kitClass];

    // Safety buffer to avoid negative inventory
    // Buffer can be absolute (100, 20) or percentage (0.01, 0.03) - detect and apply accordingly
    const isHub = flight.originAirport === 'HUB1';
    const originAirport = this.inventoryManager.getAirport(flight.originAirport);
    const airportCapacity = originAirport ? originAirport.capacity[kitClass] : 1000;

    const bufferConfig = isHub ? this.config.safetyBuffer.hub : this.config.safetyBuffer.spoke;
    const isPercentage = bufferConfig < 1; // Values < 1 are percentages
    const baseBuffer = isPercentage
      ? Math.max(5, Math.floor(airportCapacity * bufferConfig))
      : bufferConfig;

    // EARLY-GAME: Use larger buffer (5% of capacity or 500 min) to protect HUB1 stock
    const earlyGameBuffer = Math.max(500, Math.floor(airportCapacity * 0.05));
    const safetyBuffer = isHub && isEarlyGame ? earlyGameBuffer : baseBuffer;
    const available = Math.max(0, rawAvailable - safetyBuffer);
    const capacity = aircraft.kitCapacity[kitClass];

    // Load passenger demand first - NEVER exceed available stock
    let toLoad = Math.min(demand, available, capacity);

    // FIX 14: Check destination capacity for ALL flights (not just TO HUB1)
    // CRITICAL: Server counts landed kits IMMEDIATELY in stock!
    // Our processing queue doesn't reflect server reality for capacity checks
    const destStock = this.inventoryManager.getStock(flight.destinationAirport);
    const destAirport = this.inventoryManager.getAirport(flight.destinationAirport);
    if (destStock && destAirport) {
      const destCapacity = destAirport.capacity[kitClass];
      const destInFlight = this.inventoryManager.getInFlightKitsToAirport(flight.destinationAirport, kitClass);
      // Don't use processingKits - server adds landed kits to stock immediately!
      const destTotal = destStock[kitClass] + destInFlight;

      // FIX 15+18: Dynamic buffer using AdaptiveEngine
      // Base buffers per class, then adjusted by adaptive learning
      let baseBuffer: number;
      if (flight.destinationAirport === 'HUB1') {
        baseBuffer = 0.95;  // HUB1 can handle more
      } else if (kitClass === 'economy') {
        baseBuffer = 0.70;  // 70% for Economy (most problematic)
      } else if (kitClass === 'premiumEconomy') {
        baseBuffer = 0.80;  // 80% for PE
      } else {
        baseBuffer = 0.85;  // 85% for First/Business
      }

      // FIX 18: Apply adaptive adjustment based on learned patterns
      const adaptive = getAdaptiveEngine();
      const bufferPercent = adaptive.getBufferPercent(
        flight.destinationAirport,
        kitClass,
        baseBuffer
      );

      const destRoom = Math.max(0, destCapacity * bufferPercent - destTotal);

      if (toLoad > destRoom) {
        // Log overflow warning doar dacă destination aproape de capacity
        const expectedTotal = destTotal + toLoad;
        problemLogger.warnOverflow(
          { day: currentDay, hour: currentHour, airport: flight.destinationAirport, kitClass },
          destStock[kitClass],
          expectedTotal,
          destCapacity
        );
        toLoad = Math.max(0, destRoom);
      }
    }

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
    // Hard cutoff at Day 15 - tapering tested but performed worse
    if (this.config.enableExtraLoadingToSpokes &&
        flight.originAirport === 'HUB1' &&
        toLoad < capacity &&
        available > toLoad &&
        !isNearEnd) {
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

    // NOTE: Spoke-to-spoke redistribution code removed - network is pure hub-and-spoke
    // All flights are either HUB1→Spoke or Spoke→HUB1, no spoke-to-spoke routes exist

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
    // NOTE: Kits are consumed at DEPARTURE, not arrival. When passengers board
    // a flight at SpokeX, they need kits at SpokeX. So we forecast departures FROM spoke.
    const destDemand = this.demandForecaster.calculateDemandForAirport(
      flight.destinationAirport,
      currentDay,
      currentHour,
      forecastHours,
      kitClass,
      knownFlights
    );

    // Calculate what will be available at destination
    // Include processing kits in calculation (they count toward capacity)
    const destCurrent = destStock[kitClass];
    const inFlightToDestination = this.inventoryManager.getInFlightKitsToAirport(flight.destinationAirport, kitClass);
    const processingAtDest = this.inventoryManager.getProcessingKitsAtAirport(flight.destinationAirport, kitClass);
    const destExpected = destCurrent + inFlightToDestination + processingAtDest;

    // Calculate actual deficit
    const destDeficit = Math.max(0, destDemand - destExpected);

    // Check capacity constraint - include processing kits!
    const destCapacity = destAirport.capacity[kitClass];
    const totalAtDest = destCurrent + inFlightToDestination + processingAtDest;
    const destRoom = Math.max(0, destCapacity - totalAtDest);

    // Default thresholds for extra loading
    let saturationThreshold = 0.85;
    let roomCheckThreshold = 0.20;
    let maxExtraPercent = 0.05;

    // Economy extra loading disabled - causes overflow without reducing UNFULFILLED
    if (kitClass === 'economy') {
      return 0;  // NO extra Economy kits to spokes
    }

    if (kitClass === 'premiumEconomy') {
      // PE also has some issues - use moderate thresholds
      saturationThreshold = 0.75;
      roomCheckThreshold = 0.30;
      maxExtraPercent = 0.02;
    }

    // Hard stop if spoke is already at saturation threshold
    if (totalAtDest > destCapacity * saturationThreshold) {
      return 0;
    }

    // Don't send if room is less than room check threshold
    if (destRoom < destCapacity * roomCheckThreshold) {
      return 0;
    }

    // Calculate how many extra we can load
    const remainingCapacity = capacity - alreadyLoaded;
    const remainingStock = available - alreadyLoaded;

    // Hard cap at maxExtraPercent of destination capacity AND 30% of available room
    const maxExtraByCapacity = Math.floor(destCapacity * maxExtraPercent);
    const maxExtraByRoom = Math.floor(destRoom * 0.3);
    const safeExtra = Math.min(destDeficit, maxExtraByCapacity, maxExtraByRoom, destRoom, remainingCapacity, remainingStock);

    return safeExtra;
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
