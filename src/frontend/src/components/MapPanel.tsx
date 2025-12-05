import type { FlightInfo } from '../hooks/useGameState';

interface MapPanelProps {
  activeFlights: FlightInfo[];
}

export function MapPanel({ activeFlights }: MapPanelProps) {
  const scheduledCount = activeFlights.filter(f => f.status === 'SCHEDULED').length;
  const checkedInCount = activeFlights.filter(f => f.status === 'CHECKED_IN').length;

  return (
    <div className="relative rounded-[20px] border border-border min-h-[360px] overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(46,180,255,0.5),transparent_55%),radial-gradient(circle_at_60%_60%,rgba(46,255,180,0.4),transparent_50%),#60a5fa]">
      <div className="absolute inset-6 rounded-[20px] p-6 bg-gradient-to-br from-blue-400/40 to-blue-500/25 border border-white/10 z-10">
        <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-0.5">Global Network</p>
        <p className="text-text-muted text-sm">Real-time kit allocation across 161 airports.</p>
        <div className="mt-8 space-y-2">
          <p className="my-2">
            <span className="text-success">{scheduledCount}</span> scheduled flights
          </p>
          <p className="my-2">
            <span className="text-success">{checkedInCount}</span> checked-in flights
          </p>
          <p className="my-2">
            <strong>{activeFlights.length}</strong> total active
          </p>
        </div>
      </div>
    </div>
  );
}

export default MapPanel;
