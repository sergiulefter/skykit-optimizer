/**
 * Game State Module
 * Central coordinator for the optimization engine
 * Uses modular components for inventory, forecasting, purchasing, and flight loading
 */

import {
  PerClassAmount,
  FlightEvent,
  Airport,
  Aircraft,
  FlightPlan,
  FlightLoadDto
} from '../types';
import { InventoryManager } from './inventory';
import { DemandForecaster } from './forecasting';
import { FlightLoader } from './flightLoader';
import { PurchasingManager } from './purchasing';
import {
  PurchaseConfig,
  LoadingConfig,
  DEFAULT_PURCHASE_CONFIG,
  DEFAULT_LOADING_CONFIG
} from './types';

export class GameState {
  // Current time
  currentDay: number = 0;
  currentHour: number = 0;

  // Core components (modular)
  private inventoryManager: InventoryManager;
  private demandForecaster: DemandForecaster;
  private flightLoader: FlightLoader;
  private purchasingManager: PurchasingManager;


  // Known flights (from SCHEDULED/CHECKED_IN events)
  knownFlights: Map<string, FlightEvent> = new Map();

  // FIX 25: Track flights we've already loaded to avoid duplicates and catch missed flights
  private loadedFlights: Set<string> = new Set();

  // Flights that are CHECKED_IN and ready to depart this hour
  private flightsReadyToDepart: FlightEvent[] = [];

  // Expose airportStocks for backward compatibility with server.ts
  get airportStocks(): Map<string, PerClassAmount> {
    return this.inventoryManager.getAllStocks();
  }

  constructor(
    initialStocks: Map<string, PerClassAmount>,
    aircraftTypes: Map<string, Aircraft>,
    airports: Map<string, Airport>,
    flightPlans: FlightPlan[],
    purchaseConfig: PurchaseConfig = DEFAULT_PURCHASE_CONFIG,
    loadingConfig: LoadingConfig = DEFAULT_LOADING_CONFIG
  ) {
    // Initialize modular components
    this.inventoryManager = new InventoryManager(initialStocks, airports);
    this.demandForecaster = new DemandForecaster(flightPlans);
    this.flightLoader = new FlightLoader(
      this.inventoryManager,
      this.demandForecaster,
      aircraftTypes,
      loadingConfig
    );
    // NOTE: Economy load factor is now calculated PER-FLIGHT in calculateEconomyLoadFactorForFlight()
    // No startup computation needed - each flight gets its own factor based on route economics

    this.purchasingManager = new PurchasingManager(
      this.inventoryManager,
      this.demandForecaster,
      airports.get('HUB1'),
      purchaseConfig
    );
  }

  // ==================== TIME MANAGEMENT ====================

  /**
   * Update time and prepare for this round
   */
  setTime(day: number, hour: number): void {
    this.currentDay = day;
    this.currentHour = hour;

    // Process any kits that finished processing and are now available
    this.inventoryManager.processReadyKits(day, hour);

    // Find all flights departing at this exact time OR missed flights
    this.flightsReadyToDepart = [];
    const currentTime = day * 24 + hour;

    for (const flight of this.knownFlights.values()) {
      if (flight.eventType === 'CHECKED_IN' || flight.eventType === 'SCHEDULED') {
        // ORIGINAL: exact time match
        const isDepartingNow = flight.departure.day === day && flight.departure.hour === hour;

        // FIX 25: Include "missed" flights - zboruri cu departure în trecut dar nevăzute încă
        const departureTime = flight.departure.day * 24 + flight.departure.hour;
        const wasMissed = departureTime < currentTime && !this.loadedFlights.has(flight.flightId);

        if (isDepartingNow || wasMissed) {
          if (wasMissed) {
            console.log(`[FIX 25] Found missed flight ${flight.flightNumber} (departure D${flight.departure.day}H${flight.departure.hour}, now D${day}H${hour})`);
          }
          this.flightsReadyToDepart.push(flight);
        }
      }
    }
  }

  // ==================== FLIGHT EVENT PROCESSING ====================

  /**
   * Process flight events from API response
   */
  processFlightUpdates(updates: FlightEvent[]): void {
    for (const event of updates) {
      // Always update/store the flight info
      this.knownFlights.set(event.flightId, event);

      // Record observed passenger counts for adaptive demand forecasting
      // This helps estimate demand on new datasets with different passenger distributions
      if (event.eventType === 'SCHEDULED' || event.eventType === 'CHECKED_IN') {
        this.demandForecaster.recordObservedDemand(event.passengers);
      }

      if (event.eventType === 'LANDED') {
        // Flight landed - process via inventory manager
        this.inventoryManager.processLandedFlight(event);
      }
    }
  }

  // ==================== CORE OPERATIONS ====================

  /**
   * Calculate what kits to load on departing flights
   */
  calculateFlightLoads(): FlightLoadDto[] {
    return this.flightLoader.calculateFlightLoads(
      this.flightsReadyToDepart,
      this.currentDay,
      this.currentHour,
      this.knownFlights
    );
  }

  /**
   * Calculate purchase order for hub
   */
  calculatePurchaseOrder(): PerClassAmount | undefined {
    return this.purchasingManager.calculatePurchaseOrder(
      this.currentDay,
      this.currentHour,
      this.knownFlights
    );
  }

  /**
   * Apply purchased kits to HUB1 stock immediately
   */
  applyPurchasedKits(order: PerClassAmount): void {
    this.purchasingManager.applyPurchasedKits(order);
  }

  // ==================== STOCK QUERIES ====================

  /**
   * Get stock at an airport
   */
  getStock(airportCode: string): PerClassAmount | undefined {
    return this.inventoryManager.getStock(airportCode);
  }

  /**
   * Get expected stock including in-flight and processing kits
   */
  getExpectedStock(airportCode: string, withinHours: number = 24): PerClassAmount {
    return this.inventoryManager.getExpectedStock(
      airportCode,
      this.currentDay,
      this.currentHour,
      withinHours
    );
  }

  // ==================== DEMAND FORECASTING ====================

  /**
   * Calculate upcoming demand for all kit classes at an airport
   */
  calculateUpcomingDemand(airportCode: string, withinHours: number): PerClassAmount {
    return this.demandForecaster.calculateTotalDemand(
      airportCode,
      this.currentDay,
      this.currentHour,
      withinHours,
      this.knownFlights
    );
  }

  /**
   * Calculate scheduled demand (from flight plans only)
   */
  calculateScheduledDemand(airportCode: string, withinHours: number): PerClassAmount {
    return this.demandForecaster.calculateScheduledDemand(
      airportCode,
      this.currentDay,
      this.currentHour,
      withinHours
    );
  }

  // ==================== CONFIGURATION ====================

  /**
   * Update purchasing configuration
   */
  updatePurchaseConfig(config: Partial<PurchaseConfig>): void {
    this.purchasingManager.updateConfig(config);
  }

  /**
   * Update loading configuration
   */
  updateLoadingConfig(config: Partial<LoadingConfig>): void {
    this.flightLoader.updateConfig(config);
  }

  /**
   * Get current purchasing configuration
   */
  getPurchaseConfig(): PurchaseConfig {
    return this.purchasingManager.getConfig();
  }

  /**
   * Get current loading configuration
   */
  getLoadingConfig(): LoadingConfig {
    return this.flightLoader.getConfig();
  }

  // ==================== COMPONENT ACCESS (for advanced use) ====================

  /**
   * Get inventory manager (for direct manipulation if needed)
   */
  getInventoryManager(): InventoryManager {
    return this.inventoryManager;
  }

  /**
   * Get demand forecaster
   */
  getDemandForecaster(): DemandForecaster {
    return this.demandForecaster;
  }

  /**
   * Get flight loader
   */
  getFlightLoader(): FlightLoader {
    return this.flightLoader;
  }

  /**
   * Get purchasing manager
   */
  getPurchasingManager(): PurchasingManager {
    return this.purchasingManager;
  }

  // ==================== IN-FLIGHT TRACKING (for server.ts) ====================

  /**
   * Get in-flight kits (for server display)
   */
  getInFlightKits() {
    return this.inventoryManager.getInFlightKits();
  }

  /**
   * Get processing kits (for server display)
   */
  getProcessingKits() {
    return this.inventoryManager.getProcessingKits();
  }

  // ==================== COST TRACKING ====================

  /**
   * Get cumulative transport cost (loading kits onto flights)
   */
  getTransportCost(): number {
    return this.inventoryManager.getTransportCost();
  }

  /**
   * Get cumulative processing cost (processing kits at airports)
   */
  getProcessingCost(): number {
    return this.inventoryManager.getProcessingCost();
  }

  /**
   * Get cumulative purchase cost (acquisition cost for bought kits)
   */
  getPurchaseCost(): number {
    return this.purchasingManager.getTotalPurchaseCost();
  }

  /**
   * Reset cost tracking (useful for new game)
   */
  resetCosts(): void {
    this.inventoryManager.resetCosts();
  }

  // ==================== FIX 25: FLIGHT LOAD TRACKING ====================

  /**
   * Mark a flight as loaded (prevents re-processing)
   */
  markFlightAsLoaded(flightId: string): void {
    this.loadedFlights.add(flightId);
  }

  /**
   * Mark multiple flights as loaded
   */
  markFlightsAsLoaded(flightIds: string[]): void {
    for (const id of flightIds) {
      this.loadedFlights.add(id);
    }
  }

  /**
   * Check if a flight has been loaded
   */
  isFlightLoaded(flightId: string): boolean {
    return this.loadedFlights.has(flightId);
  }

  /**
   * Get count of loaded flights
   */
  getLoadedFlightsCount(): number {
    return this.loadedFlights.size;
  }

  // ==================== DEBUG ====================

  /**
   * Get flights ready to depart (for logging)
   */
  getFlightsReadyToDepart(): FlightEvent[] {
    return this.flightsReadyToDepart;
  }

  /**
   * Get airport data (for logging)
   */
  getAirport(airportCode: string): Airport | undefined {
    return this.inventoryManager.getAirport(airportCode);
  }

  /**
   * Get in-flight kits to a specific airport (for debugging)
   */
  getInFlightKitsToAirport(airportCode: string, kitClass: keyof PerClassAmount): number {
    return this.inventoryManager.getInFlightKitsToAirport(airportCode, kitClass);
  }

  /**
   * Get processing kits at a specific airport (for debugging)
   */
  getProcessingKitsAtAirport(airportCode: string, kitClass: keyof PerClassAmount): number {
    return this.inventoryManager.getProcessingKitsAtAirport(airportCode, kitClass);
  }
}
