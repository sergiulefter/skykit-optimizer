import {
  PerClassAmount,
  FlightEvent,
  Airport,
  Aircraft,
  KIT_CLASSES,
  FlightLoadDto
} from '../types';

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
  // Key: flightId, Value: FlightEvent
  knownFlights: Map<string, FlightEvent> = new Map();

  // Flights that are CHECKED_IN and ready to depart this hour
  // These need kit loading decisions
  flightsReadyToDepart: FlightEvent[] = [];

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

    // Find all flights that depart at this exact time
    // We look for CHECKED_IN flights (they have final passenger counts)
    this.flightsReadyToDepart = [];
    for (const flight of this.knownFlights.values()) {
      if (flight.departure.day === day && flight.departure.hour === hour) {
        // This flight departs NOW - we need to load kits
        this.flightsReadyToDepart.push(flight);
      }
    }
  }

  // Process flight events from API response
  processFlightUpdates(updates: FlightEvent[]): void {
    for (const event of updates) {
      // Always update/store the flight info
      this.knownFlights.set(event.flightId, event);

      if (event.eventType === 'LANDED') {
        // Flight landed - kits arrived at destination
        // Add kits back to destination airport stock (simplified - ignoring processing time)
        const destStock = this.airportStocks.get(event.destinationAirport);
        if (destStock) {
          // The kits that were on the plane arrive at destination
          // For now, we don't track in-flight kits, so we skip this
        }
      }
    }
  }

  // Calculate what kits to load on departing flights
  calculateFlightLoads(): FlightLoadDto[] {
    const loads: FlightLoadDto[] = [];

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

  // Calculate purchase order for hub (simple strategy: maintain buffer)
  calculatePurchaseOrder(): PerClassAmount | undefined {
    const hubStock = this.airportStocks.get('HUB1');
    if (!hubStock) return undefined;

    const hub = this.airports.get('HUB1');
    if (!hub) return undefined;

    // Simple strategy: if stock is below 50% capacity, order to fill to 75%
    const order: PerClassAmount = {
      first: 0,
      business: 0,
      premiumEconomy: 0,
      economy: 0
    };

    for (const kitClass of KIT_CLASSES) {
      const current = hubStock[kitClass];
      const capacity = hub.capacity[kitClass];
      const threshold = capacity * 0.5;
      const target = capacity * 0.75;

      if (current < threshold) {
        order[kitClass] = Math.ceil(target - current);
      }
    }

    // Only return if we're actually ordering something
    const totalOrder = order.first + order.business + order.premiumEconomy + order.economy;
    return totalOrder > 0 ? order : undefined;
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
  }
}
