import { ApiClient } from './api/client';
import { HourRequestDto, HourResponseDto, PenaltyDto } from './types';
import { loadAircraftTypes, loadAirports, getInitialStocks, loadFlightPlan } from './data/loader';
import { GameState } from './engine/state';
import {
  startServer,
  registerGameCallback,
  setGameState,
  setGameRunning,
  setGameComplete,
  updateStats,
  addEvent,
  addPenalty,
  clearState
} from './server';
import { startEvalPlatform, stopEvalPlatform } from './evalPlatform';
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
  airportStock?: { first: number; business: number; premiumEconomy: number; economy: number };
  airportCapacity?: { first: number; business: number; premiumEconomy: number; economy: number };
}

let penaltyLogs: PenaltyLogEntry[] = [];

function parsePenaltyReason(reason: string): { airportCode?: string; kitClass?: string; kitsOverCapacity?: number } {
  const airportMatch = reason.match(/Airport (\w+)/);
  const classMatch = reason.match(/(First|Business|Premium Economy|Economy) Class/);
  const kitsMatch = reason.match(/inventory of (\d+) kits.*capacity of (\d+)/);

  return {
    airportCode: airportMatch ? airportMatch[1] : undefined,
    kitClass: classMatch ? classMatch[1].toLowerCase().replace(' ', '') : undefined,
    kitsOverCapacity: kitsMatch ? parseInt(kitsMatch[1]) - parseInt(kitsMatch[2]) : undefined
  };
}

function logPenaltyToFile(penalty: PenaltyDto, gameState: GameState) {
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

  if (parsed.airportCode) {
    const stock = gameState.getStock(parsed.airportCode);
    const airport = gameState.getAirport(parsed.airportCode);
    if (stock) entry.airportStock = { ...stock };
    if (airport) entry.airportCapacity = { ...airport.capacity };
  }

  penaltyLogs.push(entry);
}

function writePenaltyLogs() {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logDir, `penalties-${timestamp}.json`);

  const summary: Record<string, { count: number; total: number; byDay: Record<number, number> }> = {};
  for (const entry of penaltyLogs) {
    if (!summary[entry.code]) summary[entry.code] = { count: 0, total: 0, byDay: {} };
    summary[entry.code].count++;
    summary[entry.code].total += entry.amount;
    summary[entry.code].byDay[entry.day] = (summary[entry.code].byDay[entry.day] || 0) + 1;
  }

  const byAirport: Record<string, { count: number; total: number; classes: Record<string, number> }> = {};
  for (const entry of penaltyLogs) {
    if (entry.code === 'INVENTORY_EXCEEDS_CAPACITY' && entry.airportCode) {
      if (!byAirport[entry.airportCode]) byAirport[entry.airportCode] = { count: 0, total: 0, classes: {} };
      byAirport[entry.airportCode].count++;
      byAirport[entry.airportCode].total += entry.amount;
      if (entry.kitClass) {
        byAirport[entry.airportCode].classes[entry.kitClass] = (byAirport[entry.airportCode].classes[entry.kitClass] || 0) + 1;
      }
    }
  }

  const output = {
    timestamp: new Date().toISOString(),
    totalPenalties: penaltyLogs.length,
    summary,
    byAirport,
    inventoryExceedsCapacity: penaltyLogs.filter(p => p.code === 'INVENTORY_EXCEEDS_CAPACITY'),
    otherPenaltiesSample: penaltyLogs.filter(p => p.code !== 'INVENTORY_EXCEEDS_CAPACITY').slice(0, 50)
  };

  fs.writeFileSync(logFile, JSON.stringify(output, null, 2));
  console.log(`\n[LOG] Penalty logs written to: ${logFile}`);

  console.log('\n========== PENALTY SUMMARY ==========');
  for (const [code, data] of Object.entries(summary)) {
    console.log(`${code}: ${data.count} penalties, $${(data.total / 1000000).toFixed(2)}M`);
    if (code === 'INVENTORY_EXCEEDS_CAPACITY') {
      const days = Object.entries(data.byDay).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
      console.log(`  By day: ${days.map(([d, c]) => `D${d}:${c}`).join(', ')}`);
    }
  }

  if (Object.keys(byAirport).length > 0) {
    console.log('\nTop 10 airports with INVENTORY_EXCEEDS_CAPACITY:');
    const sorted = Object.entries(byAirport).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    for (const [airport, data] of sorted) {
      const classes = Object.entries(data.classes).map(([c, n]) => `${c}:${n}`).join(', ');
      console.log(`  ${airport}: ${data.count} penalties (${classes})`);
    }
  }
  console.log('=====================================\n');
}

// Pre-loaded data
let aircraftTypes: ReturnType<typeof loadAircraftTypes>;
let airports: ReturnType<typeof loadAirports>;
let flightPlans: ReturnType<typeof loadFlightPlan>;

async function runGame() {
  console.log('===========================================');
  console.log('       SkyKit Optimizer v1.0');
  console.log('   SAP Hackathon - Rotables Optimization');
  console.log('===========================================\n');

  // Step 1: Start eval platform
  addEvent({ type: 'flight', text: 'Starting eval platform...', timestamp: new Date().toISOString() });

  try {
    await startEvalPlatform();
    addEvent({ type: 'flight', text: 'Eval platform started!', timestamp: new Date().toISOString() });
  } catch (err) {
    addEvent({ type: 'warning', text: `Failed to start eval platform: ${err}`, timestamp: new Date().toISOString() });
    throw err;
  }

  // Small delay to ensure platform is fully ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get fresh initial stocks for this run
  const initialStocks = getInitialStocks(airports);

  // Initialize game state with flight plan for demand forecasting
  const gameState = new GameState(initialStocks, aircraftTypes, airports, flightPlans);

  // Share game state with server
  setGameState(gameState, airports);
  clearState();

  // Initialize API client
  const client = new ApiClient();

  try {
    // 1. Start session
    console.log('\n[GAME] Starting new session...');
    await client.startSession();
    setGameRunning(true);
    addEvent({ type: 'flight', text: 'Game session started', timestamp: new Date().toISOString() });
    console.log('');

    // 2. Game loop - 720 rounds (30 days × 24 hours)
    console.log('[GAME] Starting game loop...\n');

    let lastCost = 0;
    let lastResponse: HourResponseDto | null = null;
    let previousResponse: HourResponseDto | null = null;

    for (let day = 0; day < TOTAL_DAYS; day++) {
      for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
        // CRITICAL: Process PREVIOUS round's flight events FIRST
        if (previousResponse) {
          gameState.processFlightUpdates(previousResponse.flightUpdates);

          // Track penalties for frontend AND file logging
          for (const penalty of previousResponse.penalties) {
            addPenalty({
              code: penalty.code,
              amount: penalty.penalty,
              reason: penalty.reason,
              flightId: penalty.flightId,
              flightNumber: penalty.flightNumber,
              issuedDay: penalty.issuedDay,
              issuedHour: penalty.issuedHour
            });
            // Log to file for analysis
            logPenaltyToFile(penalty, gameState);
          }

          // Add flight events for frontend
          for (const update of previousResponse.flightUpdates) {
            if (update.eventType === 'LANDED') {
              addEvent({
                type: 'flight',
                text: `Flight ${update.flightNumber} landed at ${update.destinationAirport}`,
                timestamp: new Date().toISOString()
              });
            }
          }
        }

        // Update game state time
        gameState.setTime(day, hour);

        // Build request with flight loads
        const flightLoads = gameState.calculateFlightLoads();
        const purchaseOrder = gameState.calculatePurchaseOrder();

        const request: HourRequestDto = {
          day,
          hour,
          flightLoads,
          kitPurchasingOrders: purchaseOrder
        };

        // Play the round
        const response = await client.playRound(request);

        // CRITICAL: Apply purchased kits to local stock immediately
        // The server adds them instantly, so we must sync our local state
        if (purchaseOrder) {
          gameState.applyPurchasedKits(purchaseOrder);
        }
        lastResponse = response;
        previousResponse = response;

        // Update stats for frontend
        const roundNum = day * 24 + hour + 1;
        updateStats({
          totalCost: response.totalCost,
          penaltyCost: response.penalties.reduce((sum, p) => sum + p.penalty, 0),
          totalPenalties: response.penalties.length,
          roundsCompleted: roundNum
        });

        // Log progress every day at midnight
        if (hour === 0) {
          const costDelta = response.totalCost - lastCost;
          console.log(`[DAY ${day.toString().padStart(2, '0')}] Cost: ${response.totalCost.toFixed(2)} (+${costDelta.toFixed(2)}) | Flights: ${gameState.knownFlights.size} | Departing: ${gameState.getFlightsReadyToDepart().length} | Loads sent: ${flightLoads.length}`);
          lastCost = response.totalCost;
        }

        // DEBUG: Extra detailed logging for days 25-29
        if (day >= 25) {
          console.log(`[DEBUG D${day}H${hour}] Cost: $${(response.totalCost / 1000000).toFixed(2)}M | Penalties: ${response.penalties.length} | Loads sent: ${flightLoads.length}`);

          // Log what we loaded
          if (flightLoads.length > 0) {
            let totalEC = 0;
            for (const load of flightLoads) {
              totalEC += load.loadedKits.economy;
            }
            console.log(`  [DEBUG] Total economy kits loaded this round: ${totalEC}`);
          }

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
            console.log(`  [PENALTY] ${penalty.code}: ${penalty.penalty.toFixed(2)}`);
          }
        } else if (day < 25 && response.penalties.length > 5) {
          const total = response.penalties.reduce((sum, p) => sum + p.penalty, 0);
          console.log(`  [PENALTIES] ${response.penalties.length} penalties, total: ${total.toFixed(2)}`);
        }
      }
    }

    // Process the final round's events
    if (previousResponse) {
      gameState.processFlightUpdates(previousResponse.flightUpdates);
    }

    // 3. End session
    console.log('\n[GAME] Ending session...');
    const finalResult = await client.endSession();
    setGameRunning(false);
    setGameComplete(true);

    const result = finalResult || lastResponse;

    console.log('\n===========================================');
    console.log(`       FINAL SCORE: ${result?.totalCost.toFixed(2) || 'N/A'}`);
    console.log('===========================================\n');

    addEvent({
      type: 'flight',
      text: `Game completed! Final score: ${result?.totalCost.toFixed(2) || 'N/A'}`,
      timestamp: new Date().toISOString()
    });

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
    setGameRunning(false);
    addEvent({
      type: 'warning',
      text: `Game error: ${error}`,
      timestamp: new Date().toISOString()
    });
    // Still try to write logs even on error
    if (penaltyLogs.length > 0) {
      writePenaltyLogs();
    }
  } finally {
    // Step 3: Stop eval platform (so it's ready for next run)
    console.log('\n[EVAL] Stopping eval platform for next run...');
    addEvent({ type: 'flight', text: 'Stopping eval platform...', timestamp: new Date().toISOString() });
    await stopEvalPlatform();
    addEvent({ type: 'flight', text: 'Eval platform stopped. Ready for next simulation!', timestamp: new Date().toISOString() });

    // Reset game complete flag so we can start again
    setGameComplete(false);
    // Clear penalty logs for next run
    penaltyLogs = [];
  }
}

async function main() {
  console.log('[INIT] Loading data from CSV files...');
  aircraftTypes = loadAircraftTypes();
  airports = loadAirports();
  flightPlans = loadFlightPlan();

  // Initialize empty game state for API
  const initialStocks = getInitialStocks(airports);
  const emptyGameState = new GameState(initialStocks, aircraftTypes, airports, flightPlans);
  setGameState(emptyGameState, airports);

  // Register the game callback
  registerGameCallback(runGame);

  // Start HTTP server
  await startServer();

  console.log('\n[SERVER] Ready! Use the frontend button or POST /api/game/start to begin simulation.');
  console.log('[SERVER] The eval platform will be started/stopped automatically.');
  console.log('[SERVER] Press Ctrl+C to exit.\n');
}

main().catch(console.error);
