import {
  PerClassAmount,
  FlightEvent,
  Airport,
  Aircraft,
  FlightPlan,
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

  // Static flight plan for demand forecasting
  flightPlans: FlightPlan[];

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
    airports: Map<string, Airport>,
    flightPlans: FlightPlan[]
  ) {
    this.airportStocks = initialStocks;
    this.aircraftTypes = aircraftTypes;
    this.airports = airports;
    this.flightPlans = flightPlans;
  }

  // Update time and find flights departing NOW
  setTime(day: number, hour: number): void {
    this.currentDay = day;
    this.currentHour = hour;

    // Process any kits that finished processing and are now available
    this.processReadyKits();

    // Find all flights departing at this exact time
    // Include both CHECKED_IN (preferred - has real passenger count) and SCHEDULED (fallback)
    // This ensures we don't miss flights that never transition to CHECKED_IN
    this.flightsReadyToDepart = [];
    for (const flight of this.knownFlights.values()) {
      if ((flight.eventType === 'CHECKED_IN' || flight.eventType === 'SCHEDULED') &&
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

    // Sort flights by priority: longer distance = higher penalty if unfulfilled
    // UNFULFILLED_KIT_FACTOR_PER_DISTANCE = 0.003, so distance matters
    const sortedFlights = [...this.flightsReadyToDepart].sort((a, b) => {
      // Get distance from flight plan for priority
      const distA = this.getFlightDistance(a.originAirport, a.destinationAirport);
      const distB = this.getFlightDistance(b.originAirport, b.destinationAirport);
      // Higher distance = higher priority (sort descending)
      return distB - distA;
    });

    for (const flight of sortedFlights) {
      const originStock = this.airportStocks.get(flight.originAirport);
      const aircraft = this.aircraftTypes.get(flight.aircraftType);

      if (!originStock || !aircraft) {
        console.warn(`[STATE] Missing data for flight ${flight.flightNumber} from ${flight.originAirport}`);
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

  // Get distance for a route from flight plan
  private getFlightDistance(origin: string, destination: string): number {
    for (const plan of this.flightPlans) {
      if (plan.departCode === origin && plan.arrivalCode === destination) {
        return plan.distanceKm;
      }
    }
    return 0; // Unknown route
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

    // Get expected stock including incoming kits (within 6 hours - shorter window)
    const expectedStock = this.getExpectedStock('HUB1', 6);

    // Calculate demand from BOTH known flights AND flight plan schedule
    const knownDemand = this.calculateUpcomingDemand('HUB1', 72);
    const scheduledDemand = this.calculateScheduledDemand('HUB1', 72);

    // Use the higher of known vs scheduled (scheduled is more complete early in game)
    const demand: PerClassAmount = {
      first: Math.max(knownDemand.first, scheduledDemand.first),
      business: Math.max(knownDemand.business, scheduledDemand.business),
      premiumEconomy: Math.max(knownDemand.premiumEconomy, scheduledDemand.premiumEconomy),
      economy: Math.max(knownDemand.economy, scheduledDemand.economy)
    };

    const order: PerClassAmount = {
      first: 0,
      business: 0,
      premiumEconomy: 0,
      economy: 0
    };

    for (const kitClass of KIT_CLASSES) {
      const current = expectedStock[kitClass];
      const kitDemand = demand[kitClass];
      const capacity = hub.capacity[kitClass];

      // MORE AGGRESSIVE: Target 200% of demand to ensure sufficient buffer
      // Also target higher capacity utilization (90% instead of 80%)
      const target = Math.min(kitDemand * 2.0, capacity * 0.9);
      const deficit = target - current;

      if (deficit > 0) {
        // Cap order at remaining capacity to avoid OVER_CAPACITY_STOCK penalty
        const currentStock = hubStock[kitClass];
        const remainingCapacity = capacity - currentStock;
        order[kitClass] = Math.min(Math.ceil(deficit), Math.max(0, remainingCapacity));
      }
    }

    // Apply API limits (from Java validation)
    // first, business, economy: max 42000
    // premiumEconomy: max 1000
    order.first = Math.min(order.first, 42000);
    order.business = Math.min(order.business, 42000);
    order.premiumEconomy = Math.min(order.premiumEconomy, 1000);
    order.economy = Math.min(order.economy, 42000);

    const totalOrder = order.first + order.business + order.premiumEconomy + order.economy;
    return totalOrder > 0 ? order : undefined;
  }

  // Calculate demand from static flight plan (for forecasting before SCHEDULED events arrive)
  private calculateScheduledDemand(airportCode: string, withinHours: number): PerClassAmount {
    const demand: PerClassAmount = { first: 0, business: 0, premiumEconomy: 0, economy: 0 };

    // Calculate the time window
    let checkHour = this.currentHour;
    let checkDay = this.currentDay;

    for (let h = 0; h < withinHours; h++) {
      // Get weekday (0 = Monday, 6 = Sunday) for the check day
      // Day 0 in game = some weekday, we need to figure out the pattern
      const weekdayIndex = checkDay % 7;

      for (const plan of this.flightPlans) {
        if (plan.departCode === airportCode &&
            plan.scheduledHour === checkHour &&
            plan.weekdays[weekdayIndex]) {
          // This flight is scheduled to depart at this time
          // Estimate passengers based on typical aircraft capacity
          // Use average aircraft capacity as estimate (we don't know exact aircraft yet)
          demand.first += 10;      // Avg first class
          demand.business += 50;   // Avg business
          demand.premiumEconomy += 25;  // Avg premium economy
          demand.economy += 250;   // Avg economy
        }
      }

      checkHour++;
      if (checkHour >= 24) {
        checkHour = 0;
        checkDay++;
      }
    }

    return demand;
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
