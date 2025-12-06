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
import { problemLogger } from './problemLogger';
import { getAdaptiveEngine } from './adaptive';

// Kit costs from hackitall2025 API specification
const KIT_COSTS: Record<keyof PerClassAmount, number> = {
  first: 200,           // First Class: $200/kit
  business: 150,        // Business: $150/kit
  premiumEconomy: 100,  // Premium Economy: $100/kit
  economy: 50           // Economy: $50/kit
};

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
        // Log deadline info o singură dată per clasă
        problemLogger.infoDeadline(
          { day: currentDay, hour: currentHour },
          kitClass,
          hoursRemaining,
          leadTime
        );
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
      return 0;
    }

    const threshold = this.config.thresholds[kitClass];
    const emergencyThreshold = this.config.emergencyThresholds[kitClass];
    const maxTotalPurchase = this.config.maxTotalPurchase[kitClass];
    const apiLimit = this.config.apiLimits[kitClass];
    const maxPerOrder = this.config.maxPerOrder[kitClass];

    // ADAPTIVE PURCHASING: Get multiplier EARLY so it affects all purchase decisions
    const adaptive = getAdaptiveEngine();
    const purchaseMultiplier = adaptive.getPurchaseMultiplier(kitClass);

    // Apply multiplier to maxPerOrder for ALL purchase paths
    const adjustedMaxPerOrder = Math.ceil(maxPerOrder * purchaseMultiplier);

    // FIX 23: END-GAME BURST PURCHASING
    // Buy aggressively before lead time deadline to prevent end-game UNFULFILLED spike
    // Lead times: First=48h, Business=36h, PE=24h, Economy=12h
    const hoursRemaining = (29 - currentDay) * 24 + (23 - currentHour);
    const LEAD_TIMES: Record<string, number> = {
      first: 48,
      business: 36,
      premiumEconomy: 24,
      economy: 12
    };

    const leadTime = LEAD_TIMES[kitClass];
    // Burst window: when we're within 12 hours of the lead time deadline
    const isNearDeadline = hoursRemaining >= leadTime && hoursRemaining <= leadTime + 12;

    if (isNearDeadline) {
      const maxToBuy = maxTotalPurchase - this.totalPurchased[kitClass];
      // Apply adaptive multiplier to burst purchasing too
      const burstAmount = Math.min(adjustedMaxPerOrder * 2, maxToBuy, apiLimit, maxRoom);

      if (burstAmount > 0) {
        return burstAmount;
      }
    }

    // EARLY-GAME (Day 0-2): Aggressive purchasing to build up stock BEFORE flights depart
    // This prevents NEGATIVE_INVENTORY penalties which cost $5342/kit!
    const isEarlyGame = currentDay <= 2;

    if (isEarlyGame) {
      // Day 0-2: Purchase at EVERY HOUR if below 50% capacity
      // Use adaptive multiplier for early game too
      if (currentStock < capacity * 0.5) {
        const maxToBuy = maxTotalPurchase - this.totalPurchased[kitClass];
        const earlyGameAmount = Math.min(adjustedMaxPerOrder, maxToBuy, apiLimit, maxRoom);

        if (earlyGameAmount > 0) {
          return earlyGameAmount;
        }
      }
      // If we have enough stock for early game, continue to regular logic
    }

    // EMERGENCY MODE: If stock is critically low, purchase immediately
    if (currentStock < emergencyThreshold) {
      // Log low stock warning (o dată pe zi per clasă)
      problemLogger.warnLowStock(
        { day: currentDay, hour: currentHour, kitClass },
        currentStock,
        emergencyThreshold
      );

      const maxToBuy = maxTotalPurchase - this.totalPurchased[kitClass];
      // Apply adaptive multiplier to emergency purchases
      const adjustedThreshold = Math.ceil(threshold * purchaseMultiplier);
      const emergencyAmount = Math.min(adjustedThreshold, maxToBuy, apiLimit, maxRoom);

      if (emergencyAmount > 0) {
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

    // Calculate deficit with buffer AND adaptive multiplier (already calculated above)
    const baseDeficit = Math.max(0, (demand * this.config.demandBuffer) - totalExpected);
    const deficit = Math.ceil(baseDeficit * purchaseMultiplier);

    // Calculate purchase amount (respect all limits) - use adjustedMaxPerOrder
    const maxToBuy = maxTotalPurchase - this.totalPurchased[kitClass];
    const toPurchase = Math.min(deficit, adjustedMaxPerOrder, maxToBuy, apiLimit, maxRoom);

    if (toPurchase > 100) {
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
        this.inventoryManager.addStock('HUB1', kitClass, order[kitClass]);
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
   * Get total acquisition cost (purchase cost) for all kits bought
   * Formula: Σ(k) (kitsPurchased(k) × cost(k))
   */
  getTotalPurchaseCost(): number {
    return this.totalPurchased.first * KIT_COSTS.first
         + this.totalPurchased.business * KIT_COSTS.business
         + this.totalPurchased.premiumEconomy * KIT_COSTS.premiumEconomy
         + this.totalPurchased.economy * KIT_COSTS.economy;
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
