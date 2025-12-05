import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse } from 'csv-parse/sync';
import { Aircraft, Airport, FlightPlan, PerClassAmount } from '../types';

// Dynamic path based on current user's home directory and OS
// Windows: ~/Desktop/HackitAll2025/eval-platform/src/main/resources/liquibase/data
// Ubuntu:  ~/repos/hackitall2025/eval-platform/src/main/resources/liquibase/data
function getDataPath(): string {
  const homeDir = os.homedir();
  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    return path.join(homeDir, 'Desktop', 'HackitAll2025', 'eval-platform', 'src', 'main', 'resources', 'liquibase', 'data');
  } else {
    // Ubuntu/Linux path
    return path.join(homeDir, 'repos', 'hackitall2025', 'eval-platform', 'src', 'main', 'resources', 'liquibase', 'data');
  }
}

const DATA_PATH = getDataPath();

export function loadAircraftTypes(): Map<string, Aircraft> {
  const filePath = path.join(DATA_PATH, 'aircraft_types.csv');
  const content = fs.readFileSync(filePath, 'utf-8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const aircraftMap = new Map<string, Aircraft>();

  for (const row of records) {
    const aircraft: Aircraft = {
      typeCode: row.type_code,
      seats: {
        first: parseInt(row.fc_seats) || 0,
        business: parseInt(row.bc_seats) || 0,
        premiumEconomy: parseInt(row.pe_seats) || 0,
        economy: parseInt(row.ec_seats) || 0
      },
      kitCapacity: {
        first: parseInt(row.fc_kits_cap) || 0,
        business: parseInt(row.bc_kits_cap) || 0,
        premiumEconomy: parseInt(row.pe_kits_cap) || 0,
        economy: parseInt(row.ec_kits_cap) || 0
      },
      costPerKgPerKm: parseFloat(row.cost_per_kg_per_km) || 0
    };
    aircraftMap.set(aircraft.typeCode, aircraft);
  }

  console.log(`[DATA] Loaded ${aircraftMap.size} aircraft types`);
  return aircraftMap;
}

export function loadAirports(): Map<string, Airport> {
  const filePath = path.join(DATA_PATH, 'airports_with_stocks.csv');
  const content = fs.readFileSync(filePath, 'utf-8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const airportMap = new Map<string, Airport>();

  for (const row of records) {
    const airport: Airport = {
      code: row.code,
      name: row.name,
      isHub: row.code === 'HUB1',
      processingTime: {
        first: parseInt(row.fc_processing_time) || 0,
        business: parseInt(row.bc_processing_time) || 0,
        premiumEconomy: parseInt(row.pe_processing_time) || 0,
        economy: parseInt(row.ec_processing_time) || 0
      },
      processingCost: {
        first: parseFloat(row.fc_processing_cost) || 0,
        business: parseFloat(row.bc_processing_cost) || 0,
        premiumEconomy: parseFloat(row.pe_processing_cost) || 0,
        economy: parseFloat(row.ec_processing_cost) || 0
      },
      loadingCost: {
        first: parseFloat(row.fc_loading_cost) || 0,
        business: parseFloat(row.bc_loading_cost) || 0,
        premiumEconomy: parseFloat(row.pe_loading_cost) || 0,
        economy: parseFloat(row.ec_loading_cost) || 0
      },
      initialStock: {
        first: parseInt(row.fc_initial_stock) || 0,
        business: parseInt(row.bc_initial_stock) || 0,
        premiumEconomy: parseInt(row.pe_initial_stock) || 0,
        economy: parseInt(row.ec_initial_stock) || 0
      },
      capacity: {
        first: parseInt(row.fc_capacity) || 0,
        business: parseInt(row.bc_capacity) || 0,
        premiumEconomy: parseInt(row.pe_capacity) || 0,
        economy: parseInt(row.ec_capacity) || 0
      }
    };
    airportMap.set(airport.code, airport);
  }

  console.log(`[DATA] Loaded ${airportMap.size} airports`);
  return airportMap;
}

export function loadFlightPlan(): FlightPlan[] {
  const filePath = path.join(DATA_PATH, 'flight_plan.csv');
  const content = fs.readFileSync(filePath, 'utf-8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const flightPlans: FlightPlan[] = [];

  for (const row of records) {
    const flightPlan: FlightPlan = {
      departCode: row.depart_code,
      arrivalCode: row.arrival_code,
      scheduledHour: parseInt(row.scheduled_hour) || 0,
      scheduledArrivalHour: parseInt(row.scheduled_arrival_hour) || 0,
      arrivalNextDay: row.arrival_next_day === '1',
      distanceKm: parseInt(row.distance_km) || 0,
      weekdays: [
        row.Mon === '1',
        row.Tue === '1',
        row.Wed === '1',
        row.Thu === '1',
        row.Fri === '1',
        row.Sat === '1',
        row.Sun === '1'
      ]
    };
    flightPlans.push(flightPlan);
  }

  console.log(`[DATA] Loaded ${flightPlans.length} flight plans`);
  return flightPlans;
}

// Helper to get initial stocks for all airports
export function getInitialStocks(airports: Map<string, Airport>): Map<string, PerClassAmount> {
  const stocks = new Map<string, PerClassAmount>();

  for (const [code, airport] of airports) {
    stocks.set(code, { ...airport.initialStock });
  }

  return stocks;
}
