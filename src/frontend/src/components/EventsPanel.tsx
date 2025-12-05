import { useState } from 'react';
import type { GameEvent, PenaltyInfo } from '../hooks/useGameState';

interface EventsPanelProps {
  events: GameEvent[];
  penalties: PenaltyInfo[];
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

export function EventsPanel({ events, penalties }: EventsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('events');

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
          Penalties ({penalties.length})
        </button>
      </div>
      <div className="p-5 overflow-y-auto max-h-[340px]">
        {activeTab === 'events' ? (
          events.length === 0 ? (
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
          )
        ) : (
          penalties.length === 0 ? (
            <p className="text-text-muted text-sm">No penalties incurred yet.</p>
          ) : (
            penalties.slice().reverse().map((penalty, index) => (
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
            ))
          )
        )}
      </div>
    </div>
  );
}

export default EventsPanel;
