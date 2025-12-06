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

    // Find all flights departing at this exact time
    this.flightsReadyToDepart = [];
    for (const flight of this.knownFlights.values()) {
      if ((flight.eventType === 'CHECKED_IN' || flight.eventType === 'SCHEDULED') &&
          flight.departure.day === day &&
          flight.departure.hour === hour) {
        this.flightsReadyToDepart.push(flight);
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

  // ==================== DEBUG ====================

  /**
   * Get flights ready to depart (for logging)
   */
  getFlightsReadyToDepart(): FlightEvent[] {
    return this.flightsReadyToDepart;
  }

  /**
   * Debug: print current stocks
   */
  printStocks(): void {
    this.inventoryManager.printStocks();
  }

  /**
   * Get airport data (for logging)
   */
  getAirport(airportCode: string): Airport | undefined {
    return this.inventoryManager.getAirport(airportCode);
  }
}
