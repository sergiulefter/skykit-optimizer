import { useCallback, type FormEvent } from 'react';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { BackToDashboardButton } from '../components/BackToDashboardButton';
import type { UseGameStateResult } from '../hooks/useGameState';
import type { Theme } from '../hooks/useTheme';

type ContactUsPageProps = {
  game: UseGameStateResult;
  theme: Theme;
  onToggleTheme: () => void;
};

const channels = [
  { label: 'Support', detail: 'support@skykit.test', note: 'For incidents and production help' },
  { label: 'Sales', detail: 'sales@skykit.test', note: 'Pricing, pilots, and enterprise' },
  { label: 'Partnerships', detail: 'partners@skykit.test', note: 'Integrations and joint ops' }
];

const offices = [
  { city: 'Seattle', info: 'Primary ops center', hours: '06:00 - 18:00 PST' },
  { city: 'London', info: 'Network coverage', hours: '08:00 - 20:00 GMT' }
];

export function ContactUsPage({ game, theme, onToggleTheme }: ContactUsPageProps) {
  const { isConnected } = game;

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }, []);

  return (
    <PageShell>
      <SiteHeader isConnected={isConnected} theme={theme} onToggleTheme={onToggleTheme} />

      <div className="mb-6">
        <BackToDashboardButton />
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        <section className="rounded-[34px] bg-gradient-to-br from-bg-alt/95 to-panel-dark/90 p-6 sm:p-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(6,6,10,0.7)]">
          <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-2">Contact</p>
          <h2 className="text-3xl sm:text-4xl font-semibold">We are here to help</h2>
          <p className="text-text-muted mt-3 max-w-3xl">
            Reach out for support, pricing, or partnerships. Drop a note and we will respond inside one business day.
          </p>
          <div className="grid gap-4 mt-6 md:grid-cols-3">
            {channels.map(channel => (
              <div key={channel.label} className="glass-card rounded-[20px] border border-border/60 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-text-muted mb-2">{channel.label}</p>
                <p className="text-sm text-text font-semibold">{channel.detail}</p>
                <p className="text-xs text-text-muted mt-2">{channel.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-border/70 bg-panel/70 p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-1">Message</p>
              <h3 className="text-2xl font-semibold">Tell us what you need</h3>
            </div>
            <span className="text-sm text-text-muted">Response target: under 1 business day.</span>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm text-text">
              Name
              <input
                type="text"
                name="name"
                placeholder="Your full name"
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-text">
              Email
              <input
                type="email"
                name="email"
                placeholder="you@company.com"
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-text">
              Company
              <input
                type="text"
                name="company"
                placeholder="Airline or MRO name"
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-text">
              Topic
              <select
                name="topic"
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text focus:border-accent outline-none"
                defaultValue=""
              >
                <option value="" disabled>Select a topic</option>
                <option value="support">Support</option>
                <option value="sales">Sales</option>
                <option value="partnerships">Partnerships</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm text-text">
              Message
              <textarea
                name="message"
                rows={4}
                placeholder="How can we help?"
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none resize-none"
                required
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-text hover:border-accent hover:text-accent transition"
              >
                Send message
              </button>
              <span className="text-xs text-text-muted">We keep responses concise and actionable.</span>
            </div>
          </form>
        </section>

        <section className="rounded-[24px] border border-border/70 bg-gradient-to-r from-panel-dark/80 via-bg-alt/70 to-panel/80 p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-1">Offices</p>
              <h3 className="text-2xl font-semibold">Follow the sun coverage</h3>
            </div>
            <p className="text-sm text-text-muted">Escalation on-call runs 24/7 for production issues.</p>
          </div>
          <div className="grid gap-4 mt-5 md:grid-cols-2">
            {offices.map(office => (
              <div key={office.city} className="rounded-2xl border border-border/60 p-4 bg-panel/70">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{office.city}</p>
                <p className="text-lg font-semibold mt-1">{office.info}</p>
                <p className="text-sm text-text-muted mt-2">Hours: {office.hours}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export default ContactUsPage;
