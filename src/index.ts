import { ApiClient } from './api/client';
import { HourRequestDto } from './types';
import { loadAircraftTypes, loadAirports, getInitialStocks } from './data/loader';
import { GameState } from './engine/state';

const TOTAL_DAYS = 30;
const HOURS_PER_DAY = 24;

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

  // Initialize game state
  const gameState = new GameState(initialStocks, aircraftTypes, airports);

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

    for (let day = 0; day < TOTAL_DAYS; day++) {
      for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
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

        // Process flight updates for next round
        gameState.processFlightUpdates(response.flightUpdates);

        // Log progress every day at midnight
        if (hour === 0) {
          const costDelta = response.totalCost - lastCost;
          console.log(`[DAY ${day.toString().padStart(2, '0')}] Cost: ${response.totalCost.toFixed(2)} (+${costDelta.toFixed(2)}) | Flights: ${gameState.knownFlights.size} | Departing: ${gameState.flightsReadyToDepart.length}`);
          lastCost = response.totalCost;
        }

        // Log penalties (limit to avoid spam)
        if (response.penalties.length > 0 && response.penalties.length <= 5) {
          for (const penalty of response.penalties) {
            console.log(`  ⚠️  ${penalty.code}: ${penalty.penalty.toFixed(2)}`);
          }
        } else if (response.penalties.length > 5) {
          const total = response.penalties.reduce((sum, p) => sum + p.penalty, 0);
          console.log(`  ⚠️  ${response.penalties.length} penalties, total: ${total.toFixed(2)}`);
        }
      }
    }

    // 3. End session
    console.log('\n[GAME] Ending session...');
    const finalResult = await client.endSession();

    console.log('\n===========================================');
    console.log(`       FINAL SCORE: ${finalResult.totalCost.toFixed(2)}`);
    console.log('===========================================\n');

    // Summary of final penalties
    if (finalResult.penalties.length > 0) {
      console.log(`Final penalties (${finalResult.penalties.length}):`);
      const penaltyCounts: Record<string, { count: number; total: number }> = {};

      for (const penalty of finalResult.penalties) {
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

  } catch (error) {
    console.error('\n[ERROR] Game failed:', error);
    process.exit(1);
  }
}

// Run the game
main().catch(console.error);
