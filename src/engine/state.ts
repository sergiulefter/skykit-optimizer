import {
  PerClassAmount,
  FlightEvent,
  Airport,
  Aircraft,
  KIT_CLASSES,
  FlightLoadDto,
  copyPerClass
} from '../types';

// Track kits that are in-flight (loaded on a plane, not yet landed)
interface InFlightKits {
  flightId: string;
  destinationAirport: string;
  kits: PerClassAmount;
  arrivalDay: number;
  arrivalHour: number;
}

// Track kits that are processing at an airport (arrived but not yet available)
interface ProcessingKits {
  airportCode: string;
  kits: PerClassAmount;
  readyDay: number;
  readyHour: number;
}

export class GameState {
  // Current time
  currentDay: number = 0;
  currentHour: number = 0;

  // Inventory at each airport (available kits)
  airportStocks: Map<string, PerClassAmount>;

  // Aircraft data for capacity checks
  aircraftTypes: Map<string, Aircraft>;

  // Airport data
  airports: Map<string, Airport>;

  // Known flights (from SCHEDULED/CHECKED_IN events)
  knownFlights: Map<string, FlightEvent> = new Map();

  // Flights that are CHECKED_IN and ready to depart this hour
  flightsReadyToDepart: FlightEvent[] = [];

  // NEW: Track kits currently on planes (in-flight)
  inFlightKits: Map<string, InFlightKits> = new Map();

  // NEW: Track kits being processed at airports (not yet available)
  processingKits: ProcessingKits[] = [];

  constructor(
    initialStocks: Map<string, PerClassAmount>,
    aircraftTypes: Map<string, Aircraft>,
    airports: Map<string, Airport>
  ) {
    this.airportStocks = initialStocks;
    this.aircraftTypes = aircraftTypes;
    this.airports = airports;
  }

  // Update time and find flights departing NOW
  setTime(day: number, hour: number): void {
    this.currentDay = day;
    this.currentHour = hour;

    // Process any kits that finished processing and are now available
    this.processReadyKits();

    // Find all CHECKED_IN flights departing at this exact time
    this.flightsReadyToDepart = [];
    for (const flight of this.knownFlights.values()) {
      if (flight.eventType === 'CHECKED_IN' &&
          flight.departure.day === day &&
          flight.departure.hour === hour) {
        this.flightsReadyToDepart.push(flight);
      }
    }
  }

  // Process kits that have finished processing and are now available
  private processReadyKits(): void {
    const stillProcessing: ProcessingKits[] = [];

    for (const processing of this.processingKits) {
      // Check if processing is complete
      const isReady = (this.currentDay > processing.readyDay) ||
                      (this.currentDay === processing.readyDay && this.currentHour >= processing.readyHour);

      if (isReady) {
        // Add kits to airport stock (with capacity check)
        const stock = this.airportStocks.get(processing.airportCode);
        const airport = this.airports.get(processing.airportCode);
        if (stock) {
          for (const kitClass of KIT_CLASSES) {
            if (airport) {
              // Cap at capacity to avoid OVER_CAPACITY_STOCK penalty
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

  // Process flight events from API response
  processFlightUpdates(updates: FlightEvent[]): void {
    for (const event of updates) {
      // Always update/store the flight info
      this.knownFlights.set(event.flightId, event);

      if (event.eventType === 'LANDED') {
        // Flight landed - retrieve the in-flight kits
        const inflight = this.inFlightKits.get(event.flightId);
        if (inflight) {
          // Get airport processing time
          const airport = this.airports.get(event.destinationAirport);

          if (airport) {
            // Calculate when kits will be ready (after processing)
            // Use the maximum processing time among all classes for simplicity
            // Or process each class separately with its own time
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

            // For HUB1, processing is fast - add directly to stock
            // For spoke airports with very long processing times, queue for processing
            if (airport.isHub || maxProcessingTime <= 2) {
              // Fast processing - add directly to stock (with capacity check)
              const stock = this.airportStocks.get(event.destinationAirport);
              if (stock) {
                for (const kitClass of KIT_CLASSES) {
                  // Cap at capacity to avoid OVER_CAPACITY_STOCK penalty (777/unit)
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
            // Airport not found - add directly to avoid losing kits
            // Note: Without airport data we can't check capacity, but this shouldn't happen
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
      }
    }
  }

  // Calculate what kits to load on departing flights
  calculateFlightLoads(): FlightLoadDto[] {
    const loads: FlightLoadDto[] = [];

    // Sort flights by some priority (e.g., by demand or distance)
    // For now, process in order received
    for (const flight of this.flightsReadyToDepart) {
      const originStock = this.airportStocks.get(flight.originAirport);
      const aircraft = this.aircraftTypes.get(flight.aircraftType);

      if (!originStock || !aircraft) {
        console.warn(`[STATE] Missing data for flight ${flight.flightNumber}`);
        continue;
      }

      // Calculate how many kits to load for each class
      const loadedKits: PerClassAmount = {
        first: 0,
        business: 0,
        premiumEconomy: 0,
        economy: 0
      };

      for (const kitClass of KIT_CLASSES) {
        const demand = flight.passengers[kitClass];
        const available = originStock[kitClass];
        const capacity = aircraft.kitCapacity[kitClass];

        // Load the minimum of: demand, available stock, aircraft capacity
        const toLoad = Math.min(demand, available, capacity);
        loadedKits[kitClass] = toLoad;

        // Deduct from stock
        originStock[kitClass] -= toLoad;
      }

      // Track this flight's kits as in-flight
      this.inFlightKits.set(flight.flightId, {
        flightId: flight.flightId,
        destinationAirport: flight.destinationAirport,
        kits: copyPerClass(loadedKits),
        arrivalDay: flight.arrival.day,
        arrivalHour: flight.arrival.hour
      });

      loads.push({
        flightId: flight.flightId,
        loadedKits
      });
    }

    return loads;
  }

  // Get stock at an airport
  getStock(airportCode: string): PerClassAmount | undefined {
    return this.airportStocks.get(airportCode);
  }

  // Calculate expected stock including in-flight and processing kits
  getExpectedStock(airportCode: string, withinHours: number = 24): PerClassAmount {
    const current = this.airportStocks.get(airportCode);
    const result: PerClassAmount = current ? copyPerClass(current) : {
      first: 0, business: 0, premiumEconomy: 0, economy: 0
    };

    const targetDay = this.currentDay + Math.floor((this.currentHour + withinHours) / 24);
    const targetHour = (this.currentHour + withinHours) % 24;

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

  // Calculate purchase order for hub with improved strategy
  calculatePurchaseOrder(): PerClassAmount | undefined {
    const hubStock = this.airportStocks.get('HUB1');
    if (!hubStock) return undefined;

    const hub = this.airports.get('HUB1');
    if (!hub) return undefined;

    // Get expected stock including incoming kits
    const expectedStock = this.getExpectedStock('HUB1', 12);

    // Calculate demand from upcoming flights (next 48 hours)
    const upcomingDemand = this.calculateUpcomingDemand('HUB1', 48);

    const order: PerClassAmount = {
      first: 0,
      business: 0,
      premiumEconomy: 0,
      economy: 0
    };

    for (const kitClass of KIT_CLASSES) {
      const current = expectedStock[kitClass];
      const demand = upcomingDemand[kitClass];
      const capacity = hub.capacity[kitClass];

      // Target: have enough for demand plus 50% buffer, up to capacity
      const target = Math.min(demand * 1.5, capacity * 0.8);
      const deficit = target - current;

      if (deficit > 0) {
        // Cap order at remaining capacity to avoid OVER_CAPACITY_STOCK penalty
        const currentStock = hubStock[kitClass];
        const remainingCapacity = capacity - currentStock;
        order[kitClass] = Math.min(Math.ceil(deficit), Math.max(0, remainingCapacity));
      }
    }

    const totalOrder = order.first + order.business + order.premiumEconomy + order.economy;
    return totalOrder > 0 ? order : undefined;
  }

  // Calculate upcoming demand for an airport within the given hours
  private calculateUpcomingDemand(airportCode: string, withinHours: number): PerClassAmount {
    const demand: PerClassAmount = { first: 0, business: 0, premiumEconomy: 0, economy: 0 };

    const targetDay = this.currentDay + Math.floor((this.currentHour + withinHours) / 24);
    const targetHour = (this.currentHour + withinHours) % 24;

    for (const flight of this.knownFlights.values()) {
      if (flight.originAirport === airportCode) {
        // Check if flight departs within the time window
        const departsInWindow = (flight.departure.day < targetDay) ||
                               (flight.departure.day === targetDay && flight.departure.hour <= targetHour);
        const departsAfterNow = (flight.departure.day > this.currentDay) ||
                               (flight.departure.day === this.currentDay && flight.departure.hour >= this.currentHour);

        if (departsInWindow && departsAfterNow) {
          for (const kitClass of KIT_CLASSES) {
            demand[kitClass] += flight.passengers[kitClass];
          }
        }
      }
    }

    return demand;
  }

  // Debug: print current stocks
  printStocks(): void {
    console.log('\n[STATE] Current stocks:');
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
