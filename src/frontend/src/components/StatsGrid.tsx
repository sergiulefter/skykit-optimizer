import type { GameStats } from '../hooks/useGameState';

interface StatsGridProps {
  stats: GameStats;
  day: number;
  hour: number;
}

function formatCost(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function StatsGrid({ stats, day, hour }: StatsGridProps) {
  const statCards = [
    { label: 'Total Cost', value: formatCost(stats.totalCost) },
    { label: 'Penalties', value: formatCost(stats.penaltyCost), isDanger: stats.penaltyCost > 0 },
    { label: 'Penalty Count', value: stats.totalPenalties.toString() },
    { label: 'Rounds Completed', value: `${stats.roundsCompleted} / 720` },
    { label: 'Current Day', value: `Day ${day}` },
    { label: 'Current Hour', value: `${hour}:00` },
  ];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5 mb-6">
      {statCards.map((stat, index) => (
        <article key={index} className="bg-panel rounded-[20px] p-6 border border-border">
          <h3 className="text-xs uppercase tracking-[0.15em] text-text-muted m-0 mb-3">{stat.label}</h3>
          <p className={`text-3xl m-0 ${stat.isDanger ? 'text-danger' : ''}`}>{stat.value}</p>
        </article>
      ))}
    </div>
  );
}

export default StatsGrid;
