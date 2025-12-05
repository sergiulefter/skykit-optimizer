const liveStatsData = [
  { label: 'Total Cost', value: '$1,203,450' },
  { label: 'Transport Cost', value: '$450,120' },
  { label: 'Processing Cost', value: '$150,800' },
  { label: 'New Kits Purchased', value: '32' },
  { label: 'Penalties', value: '$35,500', accent: 'negative' },
  { label: 'Round / Day', value: '5 / 12' }
];

const inventoryData = [
  { code: 'JFK', first: 12, business: 8, premiumEconomy: 5, economy: 20 },
  { code: 'LHR', first: 5, business: 10, premiumEconomy: 3, economy: 15 },
  { code: 'FRA', first: 18, business: 15, premiumEconomy: 10, economy: 25 },
  { code: 'DXB', first: 3, business: 5, premiumEconomy: 2, economy: 8, low: true },
  { code: 'HKG', first: 20, business: 18, premiumEconomy: 12, economy: 28 }
];

const eventTimeline = {
  events: [
    { type: 'flight', text: 'Flight BA245 departed LHR for JFK with 5 kits.' },
    { type: 'flight', text: 'Flight LH400 arrived at JFK from FRA. Unloading 8 kits.' },
    { type: 'purchase', text: 'Purchase order for 10 “E” kits approved at DXB.' },
    { type: 'warning', text: 'Low stock warning for "PE" kits at LHR.' },
    { type: 'flight', text: 'Flight EK201 departed DXB for HKG.' },
    { type: 'penalty', text: 'Penalty incurred at DXB for stockout. Cost: $5,000.' },
    { type: 'flight', text: 'Flight AF006 arrived at JFK from CDG.' }
  ],
  penalties: [
    { type: 'penalty', text: 'Flight LH400 had 14 passengers without Economy kits. $7,952 penalty.' },
    { type: 'penalty', text: 'Inventory dipped below zero at DXB. $5,342 penalty.' },
    { type: 'penalty', text: 'Incorrect flight load submitted for UA834. $5,000 penalty.' }
  ]
};

const resultsSummary = [
  { label: 'Final Score', value: '8,520' },
  { label: 'Total Cost', value: '$1,230,450' },
  { label: 'Other Costs', value: '$300,100' },
  { label: 'Penalty Counts', value: '112' }
];

const worstFlights = [
  { id: 'LH400', route: 'FRA → JFK', penalty: '$15,200', reason: 'Kit Unavailability' },
  { id: 'UA834', route: 'SFO → LHR', penalty: '$12,800', reason: 'Late Delivery' },
  { id: 'DL209', route: 'ATL → CDG', penalty: '$11,500', reason: 'Kit Unavailability' },
  { id: 'AA100', route: 'JFK → LHR', penalty: '$9,750', reason: 'Damaged Component' },
  { id: 'EK201', route: 'DXB → JFK', penalty: '$8,900', reason: 'Kit Unavailability' }
];

const recommendations = [
  {
    title: 'Increase Stock at JFK Hub',
    text: 'Multiple high-penalty flights originated from or were destined for JFK. Increasing the safety stock for critical rotables at this location could prevent future shortages.'
  },
  {
    title: 'Adjust Reorder Point for Kit XYZ',
    text: 'The simulation data shows frequent stockouts for kit XYZ. Consider adjusting the reorder point to 15 units instead of 10 to better match demand.'
  },
  {
    title: 'Review SFO → LHR Logistics Chain',
    text: 'The UA834 flight consistently incurs penalties for late delivery. An analysis of the shipping partner and route timings for this specific lane is recommended.'
  }
];

const renderStats = () => {
  const container = document.getElementById('live-stats');
  container.innerHTML = liveStatsData
    .map(
      ({ label, value, accent }) => `
        <article class="stat-card ${accent ?? ''}">
          <h3>${label}</h3>
          <p>${value}</p>
        </article>
      `
    )
    .join('');
};

const renderInventory = (onlyLow = false) => {
  const tbody = document.getElementById('inventory-table');
  const rows = inventoryData
    .filter((row) => (onlyLow ? row.low : true))
    .map(
      (row) => `
        <tr class="${row.low ? 'low' : ''}">
          <td>${row.code}</td>
          <td>${row.first}</td>
          <td>${row.business}</td>
          <td>${row.premiumEconomy}</td>
          <td>${row.economy}</td>
        </tr>
      `
    )
    .join('');
  tbody.innerHTML = rows || `<tr><td colspan="5">All airports are healthy ⚡</td></tr>`;
};

const eventBadgeMap = {
  flight: { label: '✈', className: 'badge' },
  purchase: { label: '⬆', className: 'badge' },
  warning: { label: '⚠', className: 'badge warning' },
  penalty: { label: '$', className: 'badge danger' }
};

const renderTimeline = (type = 'events') => {
  const list = document.getElementById('events-list');
  const data = eventTimeline[type];
  list.innerHTML = data
    .map(({ type: badgeType, text }) => {
      const badge = eventBadgeMap[badgeType];
      return `
        <div class="event-item">
          <span class="${badge.className}">${badge.label}</span>
          <p>${text}</p>
        </div>
      `;
    })
    .join('');
};

const renderResults = () => {
  const grid = document.getElementById('results-grid');
  grid.innerHTML = resultsSummary
    .map(
      ({ label, value }) => `
        <article class="result-card">
          <h3>${label}</h3>
          <strong>${value}</strong>
        </article>
      `
    )
    .join('');

  const flightsBody = document.getElementById('worst-flights');
  flightsBody.innerHTML = worstFlights
    .map(
      (flight) => `
        <tr>
          <td>${flight.id}</td>
          <td>${flight.route}</td>
          <td class="negative">${flight.penalty}</td>
          <td>${flight.reason}</td>
        </tr>
      `
    )
    .join('');

  const recList = document.getElementById('recommendations');
  recList.innerHTML =
    '<div class="panel-header"><h3>Optimization Recommendations</h3></div>' +
    recommendations
      .map(
        (rec, index) => `
          <article class="recommendation">
            <span>${index + 1}</span>
            <div>
              <h4>${rec.title}</h4>
              <p>${rec.text}</p>
            </div>
          </article>
        `
      )
      .join('');
};

const initInteractions = () => {
  const lowStockToggle = document.getElementById('low-stock-toggle');
  lowStockToggle.addEventListener('change', (event) => renderInventory(event.target.checked));
  document.getElementById('start-simulation').addEventListener('click', () => {
    document.getElementById('live-dashboard').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('open-dashboard').addEventListener('click', () => {
    document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      renderTimeline(button.dataset.panel);
    });
  });

  const simLog = document.getElementById('sim-log');
  simLog.textContent =
    '[LOG] Simulation started. Round 5, Day 12. Initializing flight paths... | Monitoring airport capacities... | Penalty incurred: Stockout at DXB ($5,000).';
};

const bootstrap = () => {
  renderStats();
  renderInventory();
  renderTimeline();
  renderResults();
  initInteractions();
};

document.addEventListener('DOMContentLoaded', bootstrap);
