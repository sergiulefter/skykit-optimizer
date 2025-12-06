import { ApiClient } from './api/client';
import { HourRequestDto, HourResponseDto } from './types';
import { loadAircraftTypes, loadAirports, getInitialStocks, loadFlightPlan } from './data/loader';
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
  const flightPlans = loadFlightPlan();

  // Initialize game state with flight plan for demand forecasting
  const gameState = new GameState(initialStocks, aircraftTypes, airports, flightPlans);

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
          console.log(`[DAY ${day.toString().padStart(2, '0')}] Cost: ${response.totalCost.toFixed(2)} (+${costDelta.toFixed(2)}) | Flights: ${gameState.knownFlights.size} | Departing: ${gameState.getFlightsReadyToDepart().length} | Loads sent: ${flightLoads.length}`);
          lastCost = response.totalCost;
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

  } catch (error) {
    console.error('\n[ERROR] Game failed:', error);
    process.exit(1);
  }
}

// Run the game
main().catch(console.error);
