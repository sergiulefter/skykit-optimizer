/**
 * Engine-specific types and interfaces
 */

import { PerClassAmount } from '../types';

// Track kits that are in-flight (loaded on a plane, not yet landed)
export interface InFlightKits {
  flightId: string;
  destinationAirport: string;
  kits: PerClassAmount;
  arrivalDay: number;
  arrivalHour: number;
}

// Track kits that are processing at an airport (arrived but not yet available)
export interface ProcessingKits {
  airportCode: string;
  kits: PerClassAmount;
  readyDay: number;
  readyHour: number;
}

// Configuration for purchasing strategy
export interface PurchaseConfig {
  // Thresholds - when stock falls below, trigger purchase
  thresholds: Record<string, number>;

  // Emergency thresholds - when stock is critically low
  emergencyThresholds: Record<string, number>;

  // Maximum per single order (for pacing)
  maxPerOrder: Record<string, number>;

  // Maximum total purchases per class
  maxTotalPurchase: Record<string, number>;

  // API limits per request
  apiLimits: Record<string, number>;

  // Purchase interval in hours (how often to check for regular purchases)
  purchaseInterval: number;

  // Buffer multiplier for demand forecasting
  demandBuffer: number;

  // How many hours ahead to forecast
  forecastHours: number;
}

// Configuration for flight loading strategy
export interface LoadingConfig {
  // Safety buffer to keep at each airport (avoid negative inventory)
  safetyBuffer: {
    hub: number;
    spoke: number;
  };

  // How many hours ahead to look for demand at destinations
  destinationForecastHours: number;

  // Whether to load extra kits for destination deficit
  enableExtraLoadingToSpokes: boolean;

  // Whether to return surplus kits to hub
  enableReturnToHub: boolean;
}

// Default configurations
export const DEFAULT_PURCHASE_CONFIG: PurchaseConfig = {
  thresholds: {
    first: 1800,        // FIX 23: Was 1200, increased to reduce UNFULFILLED
    business: 6000,
    premiumEconomy: 4000,  // FIX 23: Was 2500, increased to reduce UNFULFILLED
    economy: 70000         // FIX 23: Was 50000, increased to reduce UNFULFILLED (51% of penalties!)
  },
  emergencyThresholds: {
    first: 400,         // FIX 8: Was 300, increased
    business: 2000,
    premiumEconomy: 400,   // FIX 8: Was 300, increased
    economy: 10000
  },
  maxPerOrder: {
    first: 1000,        // FIX 23: Was 700, increased to reduce UNFULFILLED
    business: 3000,
    premiumEconomy: 1000,  // FIX 23: Was 700, increased to reduce UNFULFILLED
    economy: 15000         // FIX 23: Was 10000, increased to reduce UNFULFILLED
  },
  maxTotalPurchase: {
    first: 50000,
    business: 100000,
    premiumEconomy: 30000,
    economy: 200000
  },
  apiLimits: {
    first: 42000,
    business: 42000,
    premiumEconomy: 3000,  // FIX 1.2: Was 1000, aligned with threshold to prevent burst purchases
    economy: 42000
  },
  purchaseInterval: 6,
  demandBuffer: 1.0,  // FIX 1.1: Was 1.1, reduced to prevent over-purchasing
  forecastHours: 48
};

export const DEFAULT_LOADING_CONFIG: LoadingConfig = {
  safetyBuffer: {
    hub: 100,
    spoke: 20
  },
  destinationForecastHours: 24,  // FIX 2.1: Was 48, reduced to prevent spoke overflow
  enableExtraLoadingToSpokes: true,
  enableReturnToHub: true
};
