import { useState } from 'react';
import type { AirportStock } from '../hooks/useGameState';

interface InventoryPanelProps {
  airports: AirportStock[];
}

export function InventoryPanel({ airports }: InventoryPanelProps) {
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

  const filteredAirports = showOnlyLowStock
    ? airports.filter(a => a.isLowStock)
    : airports;

  const displayAirports = filteredAirports.slice(0, 15);

  return (
    <div className="bg-panel rounded-[20px] border border-border p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="m-0 text-lg">Airport Inventory</h3>
        <label className="text-xs text-text-muted flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyLowStock}
            onChange={(e) => setShowOnlyLowStock(e.target.checked)}
            className="accent-accent"
          />
          Show only low stock
        </label>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-xs text-text-muted tracking-[0.15em] uppercase text-left p-3 border-b border-white/5">Code</th>
            <th className="text-xs text-text-muted tracking-[0.15em] uppercase text-left p-3 border-b border-white/5">F</th>
            <th className="text-xs text-text-muted tracking-[0.15em] uppercase text-left p-3 border-b border-white/5">B</th>
            <th className="text-xs text-text-muted tracking-[0.15em] uppercase text-left p-3 border-b border-white/5">PE</th>
            <th className="text-xs text-text-muted tracking-[0.15em] uppercase text-left p-3 border-b border-white/5">E</th>
          </tr>
        </thead>
        <tbody>
          {displayAirports.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center p-3 text-text-muted">
                {showOnlyLowStock ? 'All airports healthy' : 'No airports loaded'}
              </td>
            </tr>
          ) : (
            displayAirports.map((airport) => (
              <tr key={airport.code} className={airport.isLowStock ? 'text-warning font-semibold' : ''}>
                <td className="p-3 border-b border-white/5 text-sm">{airport.code}</td>
                <td className="p-3 border-b border-white/5 text-sm">{airport.stock.first}</td>
                <td className="p-3 border-b border-white/5 text-sm">{airport.stock.business}</td>
                <td className="p-3 border-b border-white/5 text-sm">{airport.stock.premiumEconomy}</td>
                <td className="p-3 border-b border-white/5 text-sm">{airport.stock.economy}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {filteredAirports.length > 15 && (
        <p className="text-text-muted text-sm mt-2 text-center">
          +{filteredAirports.length - 15} more airports
        </p>
      )}
    </div>
  );
}

export default InventoryPanel;
