/**
 * Engine Module Barrel Export
 * Re-exports all engine components for easy importing
 */

// Main state coordinator
export { GameState } from './state';

// Modular components
export { InventoryManager } from './inventory';
export { DemandForecaster } from './forecasting';
export { FlightLoader } from './flightLoader';
export { PurchasingManager } from './purchasing';

// Types and configurations
export {
  InFlightKits,
  ProcessingKits,
  PurchaseConfig,
  LoadingConfig,
  DEFAULT_PURCHASE_CONFIG,
  DEFAULT_LOADING_CONFIG
} from './types';
