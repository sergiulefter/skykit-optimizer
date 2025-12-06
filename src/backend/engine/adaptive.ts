/**
 * Adaptive Strategy Engine
 * Implements dynamic adaptation based on real-time penalty feedback
 *
 * This module uses reinforcement-learning inspired techniques to:
 * 1. Monitor penalty trends over time
 * 2. Dynamically adjust buffer percentages and safety margins
 * 3. Learn from historical performance per airport
 */

import { PerClassAmount, FlightEvent, KIT_CLASSES } from '../types';
import { LoadingConfig } from './types';

// Strategy modes based on penalty performance
type StrategyMode = 'aggressive' | 'balanced' | 'conservative';

// Penalty types we track
type PenaltyType = 'INVENTORY_EXCEEDS_CAPACITY' | 'FLIGHT_UNFULFILLED' | 'NEGATIVE_INVENTORY';

interface PenaltyRecord {
  day: number;
  hour: number;
  type: PenaltyType;
  amount: number;
  airportCode?: string;
  kitClass?: string;
}

interface AirportPerformance {
  overflowCount: number;
  unfulfilledCount: number;
  lastOverflowDay: number;
  riskScore: number;  // 0-1, higher = more risky
}

/**
 * AdaptiveEngine - Core adaptive strategy component
 *
 * Uses concepts from:
 * - Reinforcement Learning: reward/penalty feedback loop
 * - Time-series analysis: trend detection
 * - Risk management: per-airport risk scoring
 */
export class AdaptiveEngine {
  // Penalty history (rolling window)
  private penaltyHistory: PenaltyRecord[] = [];
  private readonly HISTORY_WINDOW = 72;  // 3 days of history

  // Per-round penalty totals for trend detection
  private roundPenalties: number[] = [];
  private readonly TREND_WINDOW = 72;  // 3 zile pentru trend analysis stabil

  // Current strategy mode
  private strategyMode: StrategyMode = 'balanced';

  // Per-airport performance tracking (learning from experience)
  private airportPerformance: Map<string, AirportPerformance> = new Map();

  // Dynamic buffer adjustments
  private bufferMultiplier = 1.0;  // Applied to all buffers
  private economyBufferBoost = 0;  // Extra reduction for economy (0-0.15)

  // Configuration reference for updates
  private loadingConfig: LoadingConfig | null = null;

  /**
   * Record penalties from a round for learning
   */
  recordPenalties(
    penalties: Array<{ code: string; penalty: number; reason: string }>,
    day: number,
    hour: number
  ): void {
    let roundTotal = 0;

    for (const p of penalties) {
      roundTotal += p.penalty;

      // Parse and store for analysis
      const record: PenaltyRecord = {
        day,
        hour,
        type: this.classifyPenalty(p.code),
        amount: p.penalty,
        ...this.parseReason(p.reason)
      };

      this.penaltyHistory.push(record);

      // Update airport performance if we have airport info
      if (record.airportCode) {
        this.updateAirportPerformance(record);
      }
    }

    // Track round total for trend analysis
    this.roundPenalties.push(roundTotal);

    // Maintain rolling windows
    while (this.penaltyHistory.length > this.HISTORY_WINDOW * 24) {
      this.penaltyHistory.shift();
    }
    while (this.roundPenalties.length > this.TREND_WINDOW) {
      this.roundPenalties.shift();
    }

    // Analyze and adapt
    this.analyzeAndAdapt(day, hour);
  }

  /**
   * Main adaptation logic - OPȚIUNEA C: doar per-airport learning
   *
   * DEZACTIVAT: Mode switching global (balanced/conservative/aggressive)
   * PĂSTRAT: Per-airport performance tracking pentru risk scoring
   *
   * Motivație: Mode switching-ul cauzează oscilații care destabilizează algoritmul
   * Per-airport learning e util pentru a identifica aeroporturi cu risc de overflow
   */
  private analyzeAndAdapt(_currentDay: number, _currentHour: number): void {
    // DEZACTIVAT: Nu mai facem mode switching global
    // Păstrăm bufferMultiplier și economyBufferBoost la 1.0 și 0
    // Per-airport learning se face în updateAirportPerformance()

    // NOTE: Dacă vrem să reactivăm mode switching în viitor,
    // decomentăm codul de mai jos și ajustăm parametrii

    /*
    // Așteaptă 24 ore de date înainte de prima adaptare
    if (this.roundPenalties.length < 24) return;

    const recent = this.roundPenalties.slice(-12);
    const older = this.roundPenalties.slice(-24, -12);
    const recentAvg = this.average(recent);
    const olderAvg = older.length > 0 ? this.average(older) : recentAvg;

    const previousMode = this.strategyMode;

    if (recentAvg > olderAvg * 1.5) {
      this.strategyMode = 'conservative';
      this.bufferMultiplier = Math.min(1.15, this.bufferMultiplier + 0.02);
    } else if (recentAvg < olderAvg * 0.5 && this.strategyMode !== 'aggressive') {
      this.strategyMode = 'aggressive';
      this.bufferMultiplier = Math.max(0.95, this.bufferMultiplier - 0.01);
    } else {
      this.strategyMode = 'balanced';
      this.bufferMultiplier = this.bufferMultiplier * 0.95 + 1.0 * 0.05;
    }

    if (previousMode !== this.strategyMode) {
      console.log(`[ADAPTIVE] Mode: ${previousMode} → ${this.strategyMode}`);
    }
    */
  }

  /**
   * Update per-airport performance metrics
   */
  private updateAirportPerformance(record: PenaltyRecord): void {
    const code = record.airportCode!;

    let perf = this.airportPerformance.get(code);
    if (!perf) {
      perf = {
        overflowCount: 0,
        unfulfilledCount: 0,
        lastOverflowDay: -1,
        riskScore: 0.5
      };
      this.airportPerformance.set(code, perf);
    }

    if (record.type === 'INVENTORY_EXCEEDS_CAPACITY') {
      perf.overflowCount++;
      perf.lastOverflowDay = record.day;
      // Increase risk score (capped at 1.0)
      perf.riskScore = Math.min(1.0, perf.riskScore + 0.1);
    } else if (record.type === 'FLIGHT_UNFULFILLED') {
      perf.unfulfilledCount++;
      // Slight decrease in risk (we're being too conservative)
      perf.riskScore = Math.max(0.1, perf.riskScore - 0.02);
    }

    // Natural decay of risk score over time
    perf.riskScore *= 0.99;
  }

  /**
   * Get dynamic buffer percentage for a destination
   * This is the main output used by FlightLoader
   */
  getBufferPercent(
    destinationAirport: string,
    kitClass: keyof PerClassAmount,
    baseBuffer: number
  ): number {
    let buffer = baseBuffer;

    // Apply global multiplier based on strategy
    buffer *= this.bufferMultiplier;

    // Apply economy-specific boost
    if (kitClass === 'economy') {
      buffer -= this.economyBufferBoost;
    }

    // Apply airport-specific risk adjustment
    const perf = this.airportPerformance.get(destinationAirport);
    if (perf && perf.riskScore > 0.7) {
      // High-risk airport - reduce buffer further
      buffer -= (perf.riskScore - 0.7) * 0.1;
    }

    // Clamp to reasonable range
    return Math.max(0.5, Math.min(0.95, buffer));
  }

  /**
   * Get risk score for an airport (0-1, higher = more risky for overflow)
   */
  getAirportRiskScore(airportCode: string): number {
    const perf = this.airportPerformance.get(airportCode);
    return perf?.riskScore ?? 0.5;
  }

  /**
   * Check if an airport is "hot" (recent overflow issues)
   */
  isHotAirport(airportCode: string, currentDay: number): boolean {
    const perf = this.airportPerformance.get(airportCode);
    if (!perf) return false;

    // Airport is "hot" if it had overflow in the last 2 days
    return perf.lastOverflowDay >= currentDay - 2 && perf.overflowCount > 3;
  }

  /**
   * Get prioritized kit classes based on unfulfilled penalty costs
   * First class unfulfilled is 4x more expensive than economy
   */
  getPrioritizedClasses(): (keyof PerClassAmount)[] {
    // Always prioritize by penalty cost: first > business > PE > economy
    return ['first', 'business', 'premiumEconomy', 'economy'];
  }

  /**
   * Calculate optimal purchase amounts based on learned patterns
   * NOTE: This method exists but was never called - now integrated with getPurchaseMultiplier
   */
  suggestPurchaseAdjustment(
    kitClass: keyof PerClassAmount,
    currentStock: number,
    threshold: number
  ): number {
    return this.getPurchaseMultiplier(kitClass);
  }

  /**
   * Get purchase multiplier based on recent unfulfilled penalty trends
   * This is the main method used by PurchasingManager to adjust purchase quantities
   *
   * ANALYSIS: Aggressive cold-start purchasing ($760M) performed WORSE than baseline ($752.8M)
   *
   * ROOT CAUSE: UNFULFILLED happens at SPOKES, not HUB1. Buying more kits fills HUB1
   * but doesn't help because kits only reach spokes via flights with passengers.
   * The bottleneck is DISTRIBUTION, not PURCHASING.
   *
   * STRATEGY: Return neutral multiplier (1.0) - purchasing is not the lever to pull
   */
  getPurchaseMultiplier(_kitClass: keyof PerClassAmount): number {
    // After testing, aggressive purchasing doesn't reduce UNFULFILLED
    // because the constraint is kit distribution to spokes, not total kits purchased
    return 1.0;
  }

  /**
   * Get current strategy mode
   */
  getStrategyMode(): StrategyMode {
    return this.strategyMode;
  }

  /**
   * Get summary statistics for logging/debugging
   */
  getSummary(): {
    mode: StrategyMode;
    bufferMultiplier: number;
    economyBoost: number;
    hotAirports: string[];
    recentPenaltyAvg: number;
  } {
    const hotAirports: string[] = [];
    for (const [code, perf] of this.airportPerformance) {
      if (perf.riskScore > 0.7) {
        hotAirports.push(code);
      }
    }

    return {
      mode: this.strategyMode,
      bufferMultiplier: this.bufferMultiplier,
      economyBoost: this.economyBufferBoost,
      hotAirports,
      recentPenaltyAvg: this.roundPenalties.length > 0
        ? this.average(this.roundPenalties.slice(-6))
        : 0
    };
  }

  // ==================== HELPER METHODS ====================

  private classifyPenalty(code: string): PenaltyType {
    if (code === 'INVENTORY_EXCEEDS_CAPACITY') return 'INVENTORY_EXCEEDS_CAPACITY';
    if (code === 'NEGATIVE_INVENTORY') return 'NEGATIVE_INVENTORY';
    return 'FLIGHT_UNFULFILLED';
  }

  private parseReason(reason: string): { airportCode?: string; kitClass?: string } {
    const airportMatch = reason.match(/Airport (\w+)/);
    const classMatch = reason.match(/(First|Business|Premium Economy|Economy)/i);

    let kitClass: string | undefined;
    if (classMatch) {
      const cls = classMatch[1].toLowerCase();
      if (cls === 'premium economy') kitClass = 'premiumEconomy';
      else kitClass = cls;
    }

    return {
      airportCode: airportMatch?.[1],
      kitClass
    };
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

// Singleton instance for global access
let adaptiveEngineInstance: AdaptiveEngine | null = null;

export function getAdaptiveEngine(): AdaptiveEngine {
  if (!adaptiveEngineInstance) {
    adaptiveEngineInstance = new AdaptiveEngine();
  }
  return adaptiveEngineInstance;
}

export function resetAdaptiveEngine(): void {
  adaptiveEngineInstance = new AdaptiveEngine();
}
