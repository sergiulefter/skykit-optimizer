import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { BackToDashboardButton } from '../components/BackToDashboardButton';
import type { UseGameStateResult } from '../hooks/useGameState';
import type { Theme } from '../hooks/useTheme';

type AboutPageProps = {
  game: UseGameStateResult;
  theme: Theme;
  onToggleTheme: () => void;
};

const teamMembers = [
  { name: 'Mara Ionescu', title: 'Optimization Lead', focus: 'Network heuristics & solver tuning' },
  { name: 'Victor Manea', title: 'Simulation Engineer', focus: 'Digital twin & scenario runs' },
  { name: 'Sara Lungu', title: 'Experience Designer', focus: 'Immersive control surfaces' },
  { name: 'Alex Pavel', title: 'Data Pipeline', focus: 'Signals, events, and telemetry' }
];

const values = [
  { label: 'Trust the numbers', body: 'Every UI card is backed by live telemetry, so decisions stay data-first.' },
  { label: 'Design for clarity', body: 'Complex ops distilled into cinematic yet functional panels.' },
  { label: 'Prototype fast', body: 'We iterate daily with pilots and maintenance planners in the loop.' }
];

const timeline = [
  { label: 'Research Sprint', detail: 'Interviewed OCC teams and gathered routes with the highest disruption risk.' },
  { label: 'Model Build', detail: 'Connected optimizer core to SAP datasets and stress-tested penalty rules.' },
  { label: 'Experience Pass', detail: 'Crafted the animated console you see now, tuned for demos and real ops.' }
];

export function AboutPage({ game, theme, onToggleTheme }: AboutPageProps) {
  const { isConnected, state } = game;
  const stats = state?.stats;

  return (
    <PageShell>
      <SiteHeader isConnected={isConnected} theme={theme} onToggleTheme={onToggleTheme} />

      <div className="mb-6">
        <BackToDashboardButton />
      </div>

      <section className="relative overflow-hidden rounded-[34px] border border-border/60 bg-gradient-to-br from-bg-alt/70 via-panel/80 to-panel-dark/80 p-6 sm:p-10 space-y-10">
        <div className="pointer-events-none absolute inset-0 opacity-20 grid-overlay" />
        <div className="relative z-10 space-y-10">
          <header>
            <p className="uppercase tracking-[0.4em] text-[11px] text-text-muted flex items-center gap-2">
              <span className="inline-flex h-1 w-10 rounded-full bg-accent" /> About Our Crew
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
              Building the SkyKit Optimizer experience
            </h2>
            <p className="text-text-muted text-base max-w-3xl mt-3">
              We fuse ops research, aviation know-how, and immersive product design to craft a simulator that feels alive
              while staying faithful to the realities of rotable logistics. Our hackathon squad ships production-ready UI in days.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-card rounded-[28px] p-6 border border-border/70 space-y-6">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">How we work</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {values.map(value => (
                  <article key={value.label} className="rounded-[22px] border border-border/60 p-5">
                    <h3 className="m-0 text-sm uppercase tracking-[0.2em] text-text-muted">{value.label}</h3>
                    <p className="m-0 mt-2 text-base">{value.body}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-[24px] border border-border/60 p-6">
                <p className="m-0 text-xs uppercase tracking-[0.3em] text-text-muted">What drives us</p>
                <p className="text-2xl font-semibold mt-2">Reduce disruption minutes · amplify readiness</p>
              </div>
            </div>

            <div className="glass-card rounded-[28px] p-6 border border-border/70 space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Live Pulse</p>
              <div className="rounded-[20px] border border-border/60 p-5">
                <p className="m-0 text-text-muted text-sm">Current penalties</p>
                <p className="m-0 text-3xl font-semibold">{stats ? stats.totalPenalties : 0}</p>
              </div>
              <div className="rounded-[20px] border border-border/60 p-5">
                <p className="m-0 text-text-muted text-sm">Rounds completed</p>
                <p className="m-0 text-3xl font-semibold">{stats ? stats.roundsCompleted : 0} / 720</p>
              </div>
              <p className="text-text-muted text-sm">
                These counters are streamed directly from our digital twin so teammates always know how the build behaves.
              </p>
            </div>
          </div>

          <div className="glass-card rounded-[28px] p-6 border border-border/70">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted mb-6">Meet the team</p>
            <div className="grid gap-4 md:grid-cols-2">
              {teamMembers.map(member => (
                <div key={member.name} className="rounded-[24px] border border-border/50 p-5">
                  <p className="text-lg font-semibold m-0">{member.name}</p>
                  <p className="text-text-muted text-sm m-0">{member.title}</p>
                  <p className="m-0 mt-3 text-base">{member.focus}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-[28px] p-6 border border-border/70">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted mb-6">Hackathon timeline</p>
            <ol className="list-none m-0 space-y-5">
              {timeline.map((entry, index) => (
                <li key={entry.label} className="relative pl-8">
                  <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-accent animate-pulse-opacity" />
                  <p className="m-0 text-sm uppercase tracking-[0.25em] text-text-muted">Phase {index + 1}</p>
                  <h4 className="m-0 text-xl">{entry.label}</h4>
                  <p className="m-0 text-base text-text-muted">{entry.detail}</p>
                </li>
              ))}
            </ol>
          </div>

          <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-text-muted text-sm">
              Want to collaborate or see the optimizer paired with your dataset? Reach us via{' '}
              <a href="mailto:skykit@hackathon.team" className="text-accent underline-offset-4 hover:underline">skykit@hackathon.team</a>.
            </p>
          </footer>
        </div>
      </section>
    </PageShell>
  );
}

export default AboutPage;
