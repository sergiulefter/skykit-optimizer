import { useState } from 'react';
import type { GameEvent, PenaltyInfo, PenaltiesByDay } from '../hooks/useGameState';

interface EventsPanelProps {
  events: GameEvent[];
  penalties: PenaltyInfo[];
  penaltiesByDay?: PenaltiesByDay;
}

type TabType = 'events' | 'penalties';

const badgeStyles = {
  base: 'w-8 h-8 rounded-full grid place-items-center text-sm shrink-0',
  flight: 'bg-accent/15 text-accent',
  purchase: 'bg-accent/15 text-accent',
  warning: 'bg-amber-500/15 text-amber-400',
  penalty: 'bg-danger/15 text-danger',
  danger: 'bg-danger/15 text-danger'
};

const eventIcons: Record<string, string> = {
  flight: '✈',
  purchase: '⬆',
  warning: '⚠',
  penalty: '$'
};

export function EventsPanel({ events, penalties, penaltiesByDay }: EventsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('events');

  // Calculate total penalties count from penaltiesByDay
  const totalPenaltiesCount = penaltiesByDay
    ? Object.values(penaltiesByDay).reduce((sum, arr) => sum + arr.length, 0)
    : penalties.length;

  // Get sorted days (descending - newest first)
  const sortedDays = penaltiesByDay
    ? Object.keys(penaltiesByDay).map(Number).sort((a, b) => b - a)
    : [];

  // Calculate day totals
  const getDayTotal = (day: number): number => {
    if (!penaltiesByDay || !penaltiesByDay[day]) return 0;
    return penaltiesByDay[day].reduce((sum, p) => sum + p.amount, 0);
  };

  return (
    <div className="bg-panel rounded-[20px] border border-border flex flex-col overflow-hidden">
      <div className="flex border-b border-white/10">
        <button
          className={`flex-1 bg-transparent border-none text-text-muted font-semibold p-4 cursor-pointer transition-colors ${activeTab === 'events' ? 'bg-white/5 text-text' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events ({events.length})
        </button>
        <button
          className={`flex-1 bg-transparent border-none text-text-muted font-semibold p-4 cursor-pointer transition-colors ${activeTab === 'penalties' ? 'bg-white/5 text-text' : ''}`}
          onClick={() => setActiveTab('penalties')}
        >
          Penalties ({totalPenaltiesCount})
        </button>
      </div>
      <div className="overflow-y-auto max-h-[500px] px-5 pb-5 pt-0">
        {activeTab === 'events' ? (
          <div className="pt-5">
            {events.length === 0 ? (
              <p className="text-text-muted text-sm">No events yet. Start the game to see updates.</p>
            ) : (
              events.slice().reverse().map((event, index) => {
                const iconType = event.type as keyof typeof badgeStyles;
                const badgeClass = badgeStyles[iconType] || badgeStyles.flight;
                return (
                  <div key={index} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0">
                    <span className={`${badgeStyles.base} ${badgeClass}`}>
                      {eventIcons[event.type] || '✈'}
                    </span>
                    <p className="m-0 text-sm">{event.text}</p>
                  </div>
                );
              })
            )}
          </div>
        ) : penaltiesByDay && sortedDays.length > 0 ? (
          // Show penalties grouped by day
          sortedDays.map(day => {
            const dayPenalties = penaltiesByDay[day] || [];
            const dayTotal = getDayTotal(day);
            return (
              <div key={day} className="mb-6 last:mb-0">
                {/* Day header */}
                <div className="sticky top-0 bg-panel py-2 border-b border-accent/30 mb-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-accent m-0">Day {day}</h3>
                    <div className="text-right">
                      <span className="text-text-muted text-xs">{dayPenalties.length} penalties</span>
                      <span className="text-danger font-bold ml-3">${dayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
                {/* Penalties for this day */}
                {dayPenalties.map((penalty, index) => (
                  <div key={index} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-b-0 ml-2">
                    <span className={`${badgeStyles.base} ${badgeStyles.danger}`}>$</span>
                    <div className="flex-1">
                      <p className="m-0 text-sm">
                        <strong className="text-danger">${penalty.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        {' - '}{penalty.code}
                      </p>
                      <p className="text-text-muted text-xs mt-1 m-0">
                        <span className="text-accent/70">H{penalty.issuedHour}</span>
                        {' '}{penalty.reason}
                        {penalty.flightNumber && <span className="ml-2 text-accent">Flight: {penalty.flightNumber}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        ) : penalties.length === 0 ? (
          <div className="pt-5">
            <p className="text-text-muted text-sm">No penalties incurred yet.</p>
          </div>
        ) : (
          // Fallback to simple list if penaltiesByDay not available
          <div className="pt-5">
            {penalties.slice().reverse().map((penalty, index) => (
              <div key={index} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0">
                <span className={`${badgeStyles.base} ${badgeStyles.danger}`}>$</span>
                <div>
                  <p className="m-0 text-sm">
                    <strong className="text-danger">${penalty.amount.toFixed(2)}</strong>
                    {' - '}{penalty.code}
                  </p>
                  <p className="text-text-muted text-xs mt-1 m-0">
                    {penalty.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default EventsPanel;
