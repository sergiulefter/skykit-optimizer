/**
 * Inventory Management Module
 * Handles stock tracking, processing kits, and in-flight kit management
 */

import {
  PerClassAmount,
  FlightEvent,
  Airport,
  KIT_CLASSES,
  copyPerClass
} from '../types';
import { InFlightKits, ProcessingKits } from './types';

export class InventoryManager {
  // Inventory at each airport (available kits)
  private airportStocks: Map<string, PerClassAmount>;

  // Airport data for capacity checks
  private airports: Map<string, Airport>;

  // Track kits currently on planes (in-flight)
  private inFlightKits: Map<string, InFlightKits> = new Map();

  // Track kits being processed at airports (not yet available)
  private processingKits: ProcessingKits[] = [];

  constructor(
    initialStocks: Map<string, PerClassAmount>,
    airports: Map<string, Airport>
  ) {
    this.airportStocks = initialStocks;
    this.airports = airports;
  }

  // ==================== GETTERS ====================

  getStock(airportCode: string): PerClassAmount | undefined {
    return this.airportStocks.get(airportCode);
  }

  getAirport(airportCode: string): Airport | undefined {
    return this.airports.get(airportCode);
  }

  getInFlightKits(): Map<string, InFlightKits> {
    return this.inFlightKits;
  }

  getProcessingKits(): ProcessingKits[] {
    return this.processingKits;
  }

  getAllStocks(): Map<string, PerClassAmount> {
    return this.airportStocks;
  }

  // ==================== IN-FLIGHT TRACKING ====================

  /**
   * Get total kits of a class currently in-flight to a specific airport
   */
  getInFlightKitsToAirport(airportCode: string, kitClass: keyof PerClassAmount): number {
    let total = 0;
    for (const inflight of this.inFlightKits.values()) {
      if (inflight.destinationAirport === airportCode) {
        total += inflight.kits[kitClass];
      }
    }
    return total;
  }

  /**
   * Get total kits of a class currently processing at a specific airport
   */
  getProcessingKitsAtAirport(airportCode: string, kitClass: keyof PerClassAmount): number {
    let total = 0;
    for (const processing of this.processingKits) {
      if (processing.airportCode === airportCode) {
        total += processing.kits[kitClass];
      }
    }
    return total;
  }

  /**
   * Track kits as in-flight when loaded onto a plane
   */
  trackInFlightKits(
    flightId: string,
    destinationAirport: string,
    kits: PerClassAmount,
    arrivalDay: number,
    arrivalHour: number
  ): void {
    this.inFlightKits.set(flightId, {
      flightId,
      destinationAirport,
      kits: copyPerClass(kits),
      arrivalDay,
      arrivalHour
    });
  }

  // ==================== STOCK OPERATIONS ====================

  /**
   * Deduct kits from airport stock
   * Returns true if successful, false if would go negative
   */
  deductStock(airportCode: string, kitClass: keyof PerClassAmount, amount: number): boolean {
    const stock = this.airportStocks.get(airportCode);
    if (!stock) return false;

    if (stock[kitClass] < amount) {
      console.error(`[INVENTORY] Would go negative! ${airportCode}.${kitClass}: has ${stock[kitClass]}, trying to deduct ${amount}`);
      return false;
    }

    stock[kitClass] -= amount;
    return true;
  }

  /**
   * Add kits to airport stock (respecting capacity)
   * Returns how many were actually added
   */
  addStock(airportCode: string, kitClass: keyof PerClassAmount, amount: number): number {
    const stock = this.airportStocks.get(airportCode);
    const airport = this.airports.get(airportCode);
    if (!stock) return 0;

    if (airport) {
      const capacity = airport.capacity[kitClass];
      const toAdd = Math.min(amount, Math.max(0, capacity - stock[kitClass]));
      stock[kitClass] += toAdd;
      return toAdd;
    } else {
      stock[kitClass] += amount;
      return amount;
    }
  }

  /**
   * Force set stock for an airport (use with caution)
   */
  setStock(airportCode: string, kitClass: keyof PerClassAmount, value: number): void {
    const stock = this.airportStocks.get(airportCode);
    if (stock) {
      stock[kitClass] = Math.max(0, value);
    }
  }

  // ==================== PROCESSING ====================

  /**
   * Process kits that have finished processing and are now available
   */
  processReadyKits(currentDay: number, currentHour: number): void {
    const stillProcessing: ProcessingKits[] = [];

    for (const processing of this.processingKits) {
      const isReady = (currentDay > processing.readyDay) ||
                      (currentDay === processing.readyDay && currentHour >= processing.readyHour);

      if (isReady) {
        // Add kits to airport stock (with capacity check)
        const stock = this.airportStocks.get(processing.airportCode);
        const airport = this.airports.get(processing.airportCode);

        if (stock) {
          for (const kitClass of KIT_CLASSES) {
            if (airport) {
              const capacity = airport.capacity[kitClass];
              const toAdd = Math.min(processing.kits[kitClass], capacity - stock[kitClass]);
              stock[kitClass] += Math.max(0, toAdd);
            } else {
              stock[kitClass] += processing.kits[kitClass];
            }
          }
        }
      } else {
        stillProcessing.push(processing);
      }
    }

    this.processingKits = stillProcessing;
  }

  /**
   * Process LANDED flight event - move kits from in-flight to stock/processing
   */
  processLandedFlight(event: FlightEvent): void {
    const inflight = this.inFlightKits.get(event.flightId);
    if (!inflight) return;

    const airport = this.airports.get(event.destinationAirport);

    if (airport) {
      // Calculate processing time
      const maxProcessingTime = Math.max(
        airport.processingTime.first,
        airport.processingTime.business,
        airport.processingTime.premiumEconomy,
        airport.processingTime.economy
      );

      // Calculate ready time
      let readyHour = event.arrival.hour + maxProcessingTime;
      let readyDay = event.arrival.day;
      while (readyHour >= 24) {
        readyHour -= 24;
        readyDay++;
      }

      // HUB or fast processing: add directly to stock
      if (airport.isHub || maxProcessingTime <= 2) {
        const stock = this.airportStocks.get(event.destinationAirport);
        if (stock) {
          for (const kitClass of KIT_CLASSES) {
            const capacity = airport.capacity[kitClass];
            const toAdd = Math.min(inflight.kits[kitClass], capacity - stock[kitClass]);
            stock[kitClass] += Math.max(0, toAdd);
          }
        }
      } else {
        // Queue for processing
        this.processingKits.push({
          airportCode: event.destinationAirport,
          kits: copyPerClass(inflight.kits),
          readyDay,
          readyHour
        });
      }
    } else {
      // Airport not found - add directly
      const stock = this.airportStocks.get(event.destinationAirport);
      if (stock) {
        for (const kitClass of KIT_CLASSES) {
          stock[kitClass] += inflight.kits[kitClass];
        }
      }
    }

    // Remove from in-flight tracking
    this.inFlightKits.delete(event.flightId);
  }

  // ==================== EXPECTED STOCK ====================

  /**
   * Calculate expected stock including in-flight and processing kits
   */
  getExpectedStock(
    airportCode: string,
    currentDay: number,
    currentHour: number,
    withinHours: number = 24
  ): PerClassAmount {
    const current = this.airportStocks.get(airportCode);
    const result: PerClassAmount = current ? copyPerClass(current) : {
      first: 0, business: 0, premiumEconomy: 0, economy: 0
    };

    const targetDay = currentDay + Math.floor((currentHour + withinHours) / 24);
    const targetHour = (currentHour + withinHours) % 24;

    // Add kits that will arrive from in-flight
    for (const inflight of this.inFlightKits.values()) {
      if (inflight.destinationAirport === airportCode) {
        const willArrive = (inflight.arrivalDay < targetDay) ||
                          (inflight.arrivalDay === targetDay && inflight.arrivalHour <= targetHour);
        if (willArrive) {
          for (const kitClass of KIT_CLASSES) {
            result[kitClass] += inflight.kits[kitClass];
          }
        }
      }
    }

    // Add kits that will finish processing
    for (const processing of this.processingKits) {
      if (processing.airportCode === airportCode) {
        const willBeReady = (processing.readyDay < targetDay) ||
                           (processing.readyDay === targetDay && processing.readyHour <= targetHour);
        if (willBeReady) {
          for (const kitClass of KIT_CLASSES) {
            result[kitClass] += processing.kits[kitClass];
          }
        }
      }
    }

    return result;
  }

  // ==================== DEBUG ====================

  printStocks(): void {
    console.log('\n[INVENTORY] Current stocks:');
    for (const [code, stock] of this.airportStocks) {
      const total = stock.first + stock.business + stock.premiumEconomy + stock.economy;
      if (total > 0 || code === 'HUB1') {
        console.log(`  ${code}: FC=${stock.first}, BC=${stock.business}, PE=${stock.premiumEconomy}, EC=${stock.economy}`);
      }
    }
    console.log(`  In-flight: ${this.inFlightKits.size} flights`);
    console.log(`  Processing: ${this.processingKits.length} batches`);
  }
}
