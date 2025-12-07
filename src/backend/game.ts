import { ApiClient } from './api/client';
import { HourRequestDto, HourResponseDto, PenaltyDto } from './types';
import { loadAircraftTypes, loadAirports, getInitialStocks, loadFlightPlan } from './data/loader';
import { GameState } from './engine/state';
import { calculateDynamicPurchaseConfig, calculateDynamicLoadingConfig } from './engine/types';
import { getAdaptiveEngine, resetAdaptiveEngine } from './engine/adaptive';
import * as fs from 'fs';
import * as path from 'path';

const TOTAL_DAYS = 30;
const HOURS_PER_DAY = 24;

// ============ PENALTY LOGGING SYSTEM ============
interface PenaltyLogEntry {
  day: number;
  hour: number;
  code: string;
  amount: number;
  reason: string;
  flightNumber?: string;
  airportCode?: string;
  kitClass?: string;
  kitsOverCapacity?: number;
  // Snapshot of relevant state at time of penalty
  airportStock?: {
    first: number;
    business: number;
    premiumEconomy: number;
    economy: number;
  };
  airportCapacity?: {
    first: number;
    business: number;
    premiumEconomy: number;
    economy: number;
  };
}

const penaltyLogs: PenaltyLogEntry[] = [];

function parsePenaltyReason(reason: string): { airportCode?: string; kitClass?: string; kitsOverCapacity?: number } {
  // Example: "Airport ABCD has Economy Class inventory of 850 kits which exceeds its capacity of 803"
  const airportMatch = reason.match(/Airport (\w+)/);
  const classMatch = reason.match(/(First|Business|Premium Economy|Economy) Class/);
  const kitsMatch = reason.match(/inventory of (\d+) kits.*capacity of (\d+)/);

  return {
    airportCode: airportMatch ? airportMatch[1] : undefined,
    kitClass: classMatch ? classMatch[1].toLowerCase().replace(' ', '') : undefined,
    kitsOverCapacity: kitsMatch ? parseInt(kitsMatch[1]) - parseInt(kitsMatch[2]) : undefined
  };
}

function logPenalty(penalty: PenaltyDto, gameState: GameState) {
  const parsed = parsePenaltyReason(penalty.reason);

  const entry: PenaltyLogEntry = {
    day: penalty.issuedDay,
    hour: penalty.issuedHour,
    code: penalty.code,
    amount: penalty.penalty,
    reason: penalty.reason,
    flightNumber: penalty.flightNumber,
    ...parsed
  };

  // Add airport state snapshot if we found the airport
  if (parsed.airportCode) {
    const stock = gameState.getStock(parsed.airportCode);
    const airport = gameState.getAirport(parsed.airportCode);
    if (stock) {
      entry.airportStock = { ...stock };
    }
    if (airport) {
      entry.airportCapacity = { ...airport.capacity };
    }
    // FIX 11: Add in-flight and processing kits for debugging
    if (penalty.code === 'INVENTORY_EXCEEDS_CAPACITY') {
      const inFlight = {
        first: gameState.getInFlightKitsToAirport(parsed.airportCode, 'first'),
        business: gameState.getInFlightKitsToAirport(parsed.airportCode, 'business'),
        premiumEconomy: gameState.getInFlightKitsToAirport(parsed.airportCode, 'premiumEconomy'),
        economy: gameState.getInFlightKitsToAirport(parsed.airportCode, 'economy')
      };
      const processing = {
        first: gameState.getProcessingKitsAtAirport(parsed.airportCode, 'first'),
        business: gameState.getProcessingKitsAtAirport(parsed.airportCode, 'business'),
        premiumEconomy: gameState.getProcessingKitsAtAirport(parsed.airportCode, 'premiumEconomy'),
        economy: gameState.getProcessingKitsAtAirport(parsed.airportCode, 'economy')
      };
      (entry as any).inFlightToAirport = inFlight;
      (entry as any).processingAtAirport = processing;
    }
  }

  penaltyLogs.push(entry);
}

function writePenaltyLogs() {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logDir, `overflow-${timestamp}.json`);

  // FOCUS: Only INVENTORY_EXCEEDS_CAPACITY
  const overflowPenalties = penaltyLogs.filter(p => p.code === 'INVENTORY_EXCEEDS_CAPACITY');

  // Group by airport
  const byAirport: Record<string, any[]> = {};
  for (const entry of overflowPenalties) {
    const airport = entry.airportCode || 'UNKNOWN';
    if (!byAirport[airport]) {
      byAirport[airport] = [];
    }
    byAirport[airport].push({
      day: entry.day,
      hour: entry.hour,
      kitClass: entry.kitClass,
      kitsOver: entry.kitsOverCapacity,
      stock: entry.airportStock,
      capacity: entry.airportCapacity,
      inFlight: (entry as any).inFlightToAirport,
      processing: (entry as any).processingAtAirport,
      penalty: entry.amount
    });
  }

  // Summary stats
  const totalOverflow = overflowPenalties.reduce((sum, p) => sum + p.amount, 0);
  const byDay: Record<number, number> = {};
  for (const p of overflowPenalties) {
    byDay[p.day] = (byDay[p.day] || 0) + 1;
  }

  const output = {
    focus: 'INVENTORY_EXCEEDS_CAPACITY',
    totalCount: overflowPenalties.length,
    totalPenalty: totalOverflow,
    totalPenaltyFormatted: `${(totalOverflow / 1000000).toFixed(2)}M`,
    byDay,
    byAirport
  };

  fs.writeFileSync(logFile, JSON.stringify(output, null, 2));
  console.log(`\n[LOG] Overflow analysis written to: ${logFile}`);

  // Console summary - focused on overflow  
  console.log('\n========== OVERFLOW ANALYSIS ==========');
  console.log(`Total overflow penalties: ${overflowPenalties.length}`);
  console.log(`Total penalty cost: $${(totalOverflow / 1000000).toFixed(2)}M`);

  // By day
  const sortedDays = Object.entries(byDay).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  console.log(`By day: ${sortedDays.map(([d, c]) => `D${d}:${c}`).join(', ')}`);

  // Top 10 airports
  if (Object.keys(byAirport).length > 0) {
    console.log('\nTop 10 airports with overflow:');
    const sorted = Object.entries(byAirport).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
    for (const [airport, entries] of sorted) {
      console.log(`  ${airport}: ${entries.length} penalties`);
    }
  }
  console.log('========================================\n');
}

async function main() {
  console.log('===========================================');
  console.log('       SkyKit Optimizer v1.0');
  console.log('   SAP Hackathon - Rotables Optimization');
  console.log('===========================================\n');

  // Load static data from CSVs
  console.log('[INIT] Loading data from CSV files...');
  const aircraftTypes = loadAircraftTypes();
  const airports = loadAirports();
  const initialStocks = getInitialStocks(airports);
  const flightPlans = loadFlightPlan();

  // Calculate dynamic config based on HUB1 capacity
  const hub = airports.get('HUB1');
  const purchaseConfig = hub ? calculateDynamicPurchaseConfig(hub.capacity) : undefined;
  const loadingConfig = hub ? calculateDynamicLoadingConfig(hub.capacity) : undefined;

  // Log data characteristics for debugging on new datasets
  if (hub) {
    console.log('=== DATA CHARACTERISTICS ===');
    console.log(`Hub capacity: FC=${hub.capacity.first}, BC=${hub.capacity.business}, PE=${hub.capacity.premiumEconomy}, EC=${hub.capacity.economy}`);
    console.log(`Airports: ${airports.size} (1 hub + ${airports.size - 1} spokes)`);
    console.log(`Aircraft types: ${aircraftTypes.size}`);
    console.log(`Flight routes: ${flightPlans.length}`);
    if (purchaseConfig) {
      console.log(`Dynamic thresholds: FC=${purchaseConfig.thresholds.first}, BC=${purchaseConfig.thresholds.business}, PE=${purchaseConfig.thresholds.premiumEconomy}, EC=${purchaseConfig.thresholds.economy}`);
    }
    console.log('============================\n');
  }

  // Initialize game state with flight plan for demand forecasting
  const gameState = new GameState(initialStocks, aircraftTypes, airports, flightPlans, purchaseConfig, loadingConfig);

  // FIX 18: Reset adaptive engine for fresh learning
  resetAdaptiveEngine();
  console.log('[INIT] Adaptive learning engine initialized');

  // Initialize API client
  const client = new ApiClient();

  try {
    // 1. Start session
    console.log('\n[GAME] Starting new session...');
    await client.startSession();
    console.log('');

    // 2. Game loop - 720 rounds (30 days × 24 hours)
    console.log('[GAME] Starting game loop...\n');

    let lastCost = 0;
    let lastResponse: HourResponseDto | null = null;
    let previousResponse: HourResponseDto | null = null;

    for (let day = 0; day < TOTAL_DAYS; day++) {
      for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
        // CRITICAL: Process PREVIOUS round's flight events FIRST
        // This ensures we know about CHECKED_IN flights before calculating loads
        // Without this, we'd miss flights that transition SCHEDULED→CHECKED_IN in the current hour
        if (previousResponse) {
          gameState.processFlightUpdates(previousResponse.flightUpdates);
        }

        // Update game state time
        gameState.setTime(day, hour);

        // Build request with flight loads
        const flightLoads = gameState.calculateFlightLoads();
        // Conservative purchasing strategy - only buy when stock is critically low
        const purchaseOrder = gameState.calculatePurchaseOrder();

        const request: HourRequestDto = {
          day,
          hour,
          flightLoads,
          kitPurchasingOrders: purchaseOrder
        };

        // Play the round
        const response = await client.playRound(request);

        // LOG ALL PENALTIES for analysis
        for (const penalty of response.penalties) {
          logPenalty(penalty, gameState);
        }

        // FIX 18: Feed penalties to AdaptiveEngine for learning
        const adaptiveEngine = getAdaptiveEngine();
        adaptiveEngine.recordPenalties(
          response.penalties.map(p => ({ code: p.code, penalty: p.penalty, reason: p.reason })),
          day,
          hour
        );

        // CRITICAL: Apply purchased kits to local stock immediately
        // The server adds them instantly, so we must sync our local state
        if (purchaseOrder) {
          gameState.applyPurchasedKits(purchaseOrder);
        }
        lastResponse = response;
        previousResponse = response;

        // Log progress every day at midnight
        if (hour === 0) {
          const costDelta = response.totalCost - lastCost;
          const adaptiveSummary = adaptiveEngine.getSummary();
          console.log(`[DAY ${day.toString().padStart(2, '0')}] Cost: ${response.totalCost.toFixed(2)} (+${costDelta.toFixed(2)}) | Flights: ${gameState.knownFlights.size} | Mode: ${adaptiveSummary.mode}`);
          lastCost = response.totalCost;

          // Log adaptive state every 5 days
          if (day % 5 === 0 && day > 0) {
            console.log(`  [ADAPTIVE] Buffer: ${(adaptiveSummary.bufferMultiplier * 100).toFixed(0)}% | Economy boost: -${(adaptiveSummary.economyBoost * 100).toFixed(0)}% | Hot airports: ${adaptiveSummary.hotAirports.length}`);
          }
        }

        // DEBUG: Extra detailed logging for days 25-29
        if (day >= 25) {
          console.log(`[DEBUG D${day}H${hour}] Cost: ${response.totalCost.toFixed(2)} | Penalties this round: ${response.penalties.length}`);

          // Group penalties by type
          if (response.penalties.length > 0) {
            const byType: Record<string, { count: number; total: number }> = {};
            for (const p of response.penalties) {
              if (!byType[p.code]) byType[p.code] = { count: 0, total: 0 };
              byType[p.code].count++;
              byType[p.code].total += p.penalty;
            }
            for (const [code, data] of Object.entries(byType)) {
              console.log(`  [DEBUG] ${code}: ${data.count}x = $${(data.total / 1000000).toFixed(2)}M`);
            }
          }

          // Log hub stock for economy
          const hubStock = gameState.getStock('HUB1');
          if (hubStock) {
            console.log(`  [DEBUG] HUB1 stock: EC=${hubStock.economy}, PE=${hubStock.premiumEconomy}, BC=${hubStock.business}, FC=${hubStock.first}`);
          }
        }

        // Log penalties (limit to avoid spam) - only for days < 25
        if (day < 25 && response.penalties.length > 0 && response.penalties.length <= 5) {
          for (const penalty of response.penalties) {
            console.log(`  ⚠️  ${penalty.code}: ${penalty.penalty.toFixed(2)}`);
          }
        } else if (day < 25 && response.penalties.length > 5) {
          const total = response.penalties.reduce((sum, p) => sum + p.penalty, 0);
          console.log(`  ⚠️  ${response.penalties.length} penalties, total: ${total.toFixed(2)}`);
        }
      }
    }

    // Process the final round's events (important for accurate end-of-game state)
    if (previousResponse) {
      gameState.processFlightUpdates(previousResponse.flightUpdates);
    }

    // 3. End session (may return null if server auto-ended after round 720)
    console.log('\n[GAME] Ending session...');
    const finalResult = await client.endSession();

    // Use finalResult if available, otherwise use last response from game loop
    const result = finalResult || lastResponse;

    console.log('\n===========================================');
    console.log(`       FINAL SCORE: ${result?.totalCost.toFixed(2) || 'N/A'}`);
    console.log('===========================================\n');

    // Summary of final penalties
    if (result && result.penalties.length > 0) {
      console.log(`Final penalties (${result.penalties.length}):`);
      const penaltyCounts: Record<string, { count: number; total: number }> = {};

      for (const penalty of result.penalties) {
        if (!penaltyCounts[penalty.code]) {
          penaltyCounts[penalty.code] = { count: 0, total: 0 };
        }
        penaltyCounts[penalty.code].count++;
        penaltyCounts[penalty.code].total += penalty.penalty;
      }

      for (const [code, data] of Object.entries(penaltyCounts)) {
        console.log(`  - ${code}: ${data.count}x = ${data.total.toFixed(2)}`);
      }
    }

    // Write detailed penalty logs to file
    writePenaltyLogs();

  } catch (error) {
    console.error('\n[ERROR] Game failed:', error);
    // Still try to write logs even on error
    if (penaltyLogs.length > 0) {
      writePenaltyLogs();
    }
    process.exit(1);
  }
}

// Run the game
main().catch(console.error);
