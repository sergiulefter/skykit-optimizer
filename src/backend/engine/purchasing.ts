/**
 * Purchasing Module
 * Handles kit purchasing decisions and strategy
 */

import {
  PerClassAmount,
  FlightEvent,
  Airport,
  KIT_CLASSES
} from '../types';
import { PurchaseConfig, DEFAULT_PURCHASE_CONFIG } from './types';
import { InventoryManager } from './inventory';
import { DemandForecaster } from './forecasting';

export class PurchasingManager {
  private inventoryManager: InventoryManager;
  private demandForecaster: DemandForecaster;
  private hubAirport: Airport | undefined;
  private config: PurchaseConfig;

  // Track total purchased kits to prevent over-purchasing
  private totalPurchased: PerClassAmount = {
    first: 0,
    business: 0,
    premiumEconomy: 0,
    economy: 0
  };

  constructor(
    inventoryManager: InventoryManager,
    demandForecaster: DemandForecaster,
    hubAirport: Airport | undefined,
    config: PurchaseConfig = DEFAULT_PURCHASE_CONFIG
  ) {
    this.inventoryManager = inventoryManager;
    this.demandForecaster = demandForecaster;
    this.hubAirport = hubAirport;
    this.config = config;
  }

  /**
   * Calculate purchase order for HUB1
   * Strategy: Buy kits conservatively, respecting HUB1 capacity limits
   * CRITICAL: INVENTORY_EXCEEDS_CAPACITY penalty is $777/kit - avoid at all costs!
   */
  calculatePurchaseOrder(
    currentDay: number,
    currentHour: number,
    knownFlights: Map<string, FlightEvent>
  ): PerClassAmount | undefined {
    // FIX 10: Lead-time aware purchasing cutoffs
    // Kit lead times: First=48h, Business=36h, PE=24h, Economy=12h
    // Game ends at Day 29, Hour 23, so we need kits to arrive before then
    const hoursRemaining = (29 - currentDay) * 24 + (23 - currentHour);

    // Lead times in hours for each class
    const LEAD_TIMES = {
      first: 48,        // 2 days
      business: 36,     // 1.5 days
      premiumEconomy: 24, // 1 day
      economy: 12       // 0.5 days
    };

    // 2. Get hub stock AND capacity
    const hubStock = this.inventoryManager.getStock('HUB1');
    if (!hubStock || !this.hubAirport) return undefined;

    const order: PerClassAmount = { first: 0, business: 0, premiumEconomy: 0, economy: 0 };
    let anyPurchase = false;

    // 3. Calculate for each kit class
    for (const kitClass of KIT_CLASSES) {
      // FIX 10: Skip if not enough time for kit to arrive before game ends
      const leadTime = LEAD_TIMES[kitClass];
      if (hoursRemaining < leadTime) {
        continue;  // Kit won't arrive in time
      }

      const purchaseAmount = this.calculatePurchaseForClass(
        kitClass,
        hubStock,
        currentDay,
        currentHour,
        knownFlights
      );

      if (purchaseAmount > 0) {
        order[kitClass] = purchaseAmount;
        this.totalPurchased[kitClass] += purchaseAmount;
        anyPurchase = true;
      }
    }

    if (!anyPurchase) {
      return undefined;
    }

    return order;
  }

  /**
   * Calculate purchase amount for a specific kit class
   */
  private calculatePurchaseForClass(
    kitClass: keyof PerClassAmount,
    hubStock: PerClassAmount,
    currentDay: number,
    currentHour: number,
    knownFlights: Map<string, FlightEvent>
  ): number {
    if (!this.hubAirport) return 0;

    const currentStock = hubStock[kitClass];
    const inFlight = this.inventoryManager.getInFlightKitsToAirport('HUB1', kitClass);
    const processing = this.inventoryManager.getProcessingKitsAtAirport('HUB1', kitClass);
    const alreadyPurchased = this.totalPurchased[kitClass];
    const totalExpected = currentStock + inFlight + processing + alreadyPurchased;

    // CRITICAL: Get HUB1 capacity and calculate available room
    const capacity = this.hubAirport.capacity[kitClass];
    const maxRoom = Math.max(0, capacity - totalExpected);

    // Skip if no room available
    if (maxRoom <= 0) {
      console.log(`[PURCHASE SKIP] Day ${currentDay} Hour ${currentHour}: No room for ${kitClass} (stock=${currentStock}, purchased=${alreadyPurchased}, capacity=${capacity})`);
      return 0;
    }

    const threshold = this.config.thresholds[kitClass];
    const emergencyThreshold = this.config.emergencyThresholds[kitClass];
    const maxTotalPurchase = this.config.maxTotalPurchase[kitClass];
    const apiLimit = this.config.apiLimits[kitClass];
    const maxPerOrder = this.config.maxPerOrder[kitClass];

    // EARLY-GAME (Day 0-2): Aggressive purchasing to build up stock BEFORE flights depart
    // This prevents NEGATIVE_INVENTORY penalties which cost $5342/kit!
    const isEarlyGame = currentDay <= 2;

    if (isEarlyGame) {
      // Day 0-2: Purchase at EVERY HOUR if below 50% capacity
      // FIX 1.3: Was 70%, reduced to prevent HUB1 overflow for First/PE classes
      if (currentStock < capacity * 0.5) {
        const maxToBuy = maxTotalPurchase - this.totalPurchased[kitClass];
        const earlyGameAmount = Math.min(maxPerOrder, maxToBuy, apiLimit, maxRoom);

        if (earlyGameAmount > 0) {
          console.log(`[PURCHASE EARLY-GAME] Day ${currentDay} Hour ${currentHour}: Ordering ${earlyGameAmount} ${kitClass} kits (stock=${currentStock}, capacity=${capacity})`);
          return earlyGameAmount;
        }
      }
      // If we have enough stock for early game, continue to regular logic
    }

    // EMERGENCY MODE: If stock is critically low, purchase immediately
    if (currentStock < emergencyThreshold) {
      const maxToBuy = maxTotalPurchase - this.totalPurchased[kitClass];
      const emergencyAmount = Math.min(threshold, maxToBuy, apiLimit, maxRoom);

      if (emergencyAmount > 0) {
        console.log(`[PURCHASE EMERGENCY] Day ${currentDay} Hour ${currentHour}: Ordering ${emergencyAmount} ${kitClass} kits (stock was ${currentStock}, room: ${maxRoom})`);
        return emergencyAmount;
      }
      return 0;
    }

    // Regular purchasing: every 2 hours in first 2 days, every 6 hours after
    const purchaseInterval = currentDay < 2 ? 2 : this.config.purchaseInterval;
    if (currentHour % purchaseInterval !== 0) {
      return 0;
    }

    // Skip if above threshold
    if (totalExpected >= threshold) {
      return 0;
    }

    // Calculate demand forecast
    const demand = this.demandForecaster.calculateDemandForAirport(
      'HUB1',
      currentDay,
      currentHour,
      this.config.forecastHours,
      kitClass,
      knownFlights
    );

    // Calculate deficit with buffer
    const deficit = Math.max(0, (demand * this.config.demandBuffer) - totalExpected);

    // Calculate purchase amount (respect all limits)
    const maxToBuy = maxTotalPurchase - this.totalPurchased[kitClass];
    const toPurchase = Math.min(deficit, maxPerOrder, maxToBuy, apiLimit, maxRoom);

    if (toPurchase > 100) {
      console.log(`[PURCHASE] Day ${currentDay} Hour ${currentHour}: Ordering ${toPurchase} ${kitClass} kits (expected: ${totalExpected}, demand: ${demand}, room: ${maxRoom})`);
      return toPurchase;
    }

    return 0;
  }

  /**
   * Apply purchased kits to HUB1 stock immediately
   * The server adds purchased kits to stock immediately, so we must do the same
   */
  applyPurchasedKits(order: PerClassAmount): void {
    const hubStock = this.inventoryManager.getStock('HUB1');
    if (!hubStock || !this.hubAirport) return;

    for (const kitClass of KIT_CLASSES) {
      if (order[kitClass] > 0) {
        const added = this.inventoryManager.addStock('HUB1', kitClass, order[kitClass]);
        if (added > 0) {
          console.log(`[STOCK UPDATE] Applied ${added} ${kitClass} kits to HUB1 (now: ${hubStock[kitClass]})`);
        }
      }
    }
  }

  /**
   * Get total kits purchased so far
   */
  getTotalPurchased(): PerClassAmount {
    return { ...this.totalPurchased };
  }

  /**
   * Reset purchase tracking (for new game)
   */
  resetPurchaseTracking(): void {
    this.totalPurchased = { first: 0, business: 0, premiumEconomy: 0, economy: 0 };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PurchaseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PurchaseConfig {
    return this.config;
  }
}
