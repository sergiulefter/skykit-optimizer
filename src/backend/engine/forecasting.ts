/**
 * Demand Forecasting Module
 * Predicts future kit demand based on known flights and flight plans
 */

import {
  PerClassAmount,
  FlightEvent,
  FlightPlan,
  KIT_CLASSES
} from '../types';

export class DemandForecaster {
  private flightPlans: FlightPlan[];

  constructor(flightPlans: FlightPlan[]) {
    this.flightPlans = flightPlans;
  }

  /**
   * Calculate upcoming demand for a specific airport and kit class
   */
  calculateDemandForAirport(
    airportCode: string,
    currentDay: number,
    currentHour: number,
    withinHours: number,
    kitClass: keyof PerClassAmount,
    knownFlights: Map<string, FlightEvent>
  ): number {
    let demand = 0;

    const targetDay = currentDay + Math.floor((currentHour + withinHours) / 24);
    const targetHour = (currentHour + withinHours) % 24;

    // Use known flights if available (more accurate)
    for (const flight of knownFlights.values()) {
      if (flight.originAirport === airportCode) {
        const departsInWindow = (flight.departure.day < targetDay) ||
                               (flight.departure.day === targetDay && flight.departure.hour <= targetHour);
        const departsAfterNow = (flight.departure.day > currentDay) ||
                               (flight.departure.day === currentDay && flight.departure.hour >= currentHour);

        if (departsInWindow && departsAfterNow) {
          demand += flight.passengers[kitClass];
        }
      }
    }

    // Also use flight plan for forecasting beyond known flights
    let checkHour = currentHour;
    let checkDay = currentDay;

    for (let h = 0; h < withinHours; h++) {
      const weekdayIndex = checkDay % 7;

      for (const plan of this.flightPlans) {
        if (plan.departCode === airportCode &&
            plan.scheduledHour === checkHour &&
            plan.weekdays[weekdayIndex]) {
          // Estimate demand based on typical load
          const estimate = this.getTypicalDemandEstimate(kitClass);
          demand += estimate;
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

  /**
   * Calculate total upcoming demand for all kit classes
   */
  calculateTotalDemand(
    airportCode: string,
    currentDay: number,
    currentHour: number,
    withinHours: number,
    knownFlights: Map<string, FlightEvent>
  ): PerClassAmount {
    const demand: PerClassAmount = { first: 0, business: 0, premiumEconomy: 0, economy: 0 };

    for (const kitClass of KIT_CLASSES) {
      demand[kitClass] = this.calculateDemandForAirport(
        airportCode,
        currentDay,
        currentHour,
        withinHours,
        kitClass,
        knownFlights
      );
    }

    return demand;
  }

  /**
   * Calculate demand from static flight plan (for forecasting before SCHEDULED events)
   */
  calculateScheduledDemand(
    airportCode: string,
    currentDay: number,
    currentHour: number,
    withinHours: number
  ): PerClassAmount {
    const demand: PerClassAmount = { first: 0, business: 0, premiumEconomy: 0, economy: 0 };

    let checkHour = currentHour;
    let checkDay = currentDay;

    for (let h = 0; h < withinHours; h++) {
      const weekdayIndex = checkDay % 7;

      for (const plan of this.flightPlans) {
        if (plan.departCode === airportCode &&
            plan.scheduledHour === checkHour &&
            plan.weekdays[weekdayIndex]) {
          // Estimate passengers based on typical aircraft capacity
          for (const kitClass of KIT_CLASSES) {
            demand[kitClass] += this.getTypicalDemandEstimate(kitClass);
          }
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

  /**
   * Get typical demand estimate for a kit class
   */
  private getTypicalDemandEstimate(kitClass: keyof PerClassAmount): number {
    switch (kitClass) {
      case 'first': return 10;
      case 'business': return 50;
      case 'premiumEconomy': return 25;
      case 'economy': return 250;
      default: return 0;
    }
  }

  /**
   * Get flight distance from flight plan
   */
  getFlightDistance(origin: string, destination: string): number {
    for (const plan of this.flightPlans) {
      if (plan.departCode === origin && plan.arrivalCode === destination) {
        return plan.distanceKm;
      }
    }
    return 0;
  }

  /**
   * Get all flight plans
   */
  getFlightPlans(): FlightPlan[] {
    return this.flightPlans;
  }
}
