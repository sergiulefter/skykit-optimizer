# SkyKit Optimizer Frontend

This lightweight UI mirrors the visual design from the hackathon plan and screenshots. It can be opened directly in a browser (no build step required) from `frontend/index.html`.

## How it maps to the plan

| Plan item | Implementation |
| --- | --- |
| **Task 4.1 – Setup Frontend** | Created a dedicated `frontend/` workspace with semantic HTML, modular CSS, and a small data-driven script (`app.js`). |
| **Task 4.2 – Dashboard Principal** | Implemented the live simulation dashboard (stat tiles, inventory table, world map panel, real-time log, and Events/Penalties feed). |
| **Task 4.3 – Vizualizare Timp Real** | Added interactive controls: low-stock filtering, timeline tab switching, and CTA buttons that deep-link to the dashboard/results sections. Data objects simulate real-time updates per round. |
| **Task 4.4 – Polish & Animații** | Applied the glassmorphism/dark aesthetic from the mockups, gradients, rounded cards, and hover transitions for CTAs and navigation chips. |

## Usage

1. Open `frontend/index.html` in any modern browser.
2. Use the “Start Simulation” button to jump to the live dashboard and monitor data points.
3. Toggle “Show only low stock airports” to focus on critical locations or switch between Events/Penalties for incident review.
4. Scroll down to the final results section for scorecards, charts, worst flights table, and optimization recommendations.

The data is static but structured so it can be swapped with live API results from the optimizer engine in later phases.
