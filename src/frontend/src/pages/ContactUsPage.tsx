import { useCallback, type FormEvent } from 'react';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { BackToDashboardButton } from '../components/BackToDashboardButton';
import type { UseGameStateResult } from '../hooks/useGameState';
import type { Theme } from '../hooks/useTheme';
import type { Language } from '../hooks/useLanguage';
import { pickLanguage } from '../i18n/utils';

type ContactUsPageProps = {
  game: UseGameStateResult;
  theme: Theme;
  onToggleTheme: () => void;
  language: Language;
  onToggleLanguage: () => void;
};

const contactContent = {
  en: {
    heroBadge: 'Contact',
    heroTitle: 'We are here to help',
    heroIntro: 'Reach out for support, pricing, or partnerships. Drop a note and we will respond inside one business day.',
    channels: [
      { label: 'Support', detail: 'support@skykit.test', note: 'For incidents and production help' },
      { label: 'Sales', detail: 'sales@skykit.test', note: 'Pricing, pilots, and enterprise' },
      { label: 'Partnerships', detail: 'partners@skykit.test', note: 'Integrations and joint ops' }
    ],
    messageBadge: 'Message',
    messageTitle: 'Tell us what you need',
    responseTarget: 'Response target: under 1 business day.',
    form: {
      nameLabel: 'Name',
      namePlaceholder: 'Your full name',
      emailLabel: 'Email',
      emailPlaceholder: 'you@company.com',
      companyLabel: 'Company',
      companyPlaceholder: 'Airline or MRO name',
      topicLabel: 'Topic',
      topicPlaceholder: 'Select a topic',
      topicOptions: {
        support: 'Support',
        sales: 'Sales',
        partnerships: 'Partnerships',
        other: 'Other'
      },
      messageLabel: 'Message',
      messagePlaceholder: 'How can we help?'
    },
    buttonText: 'Send message',
    buttonNote: 'We keep responses concise and actionable.',
    officesBadge: 'Offices',
    officesTitle: 'Follow the sun coverage',
    officesNote: 'Escalation on-call runs 24/7 for production issues.',
    offices: [
      { city: 'Seattle', info: 'Primary ops center', hours: '06:00 - 18:00 PST' },
      { city: 'London', info: 'Network coverage', hours: '08:00 - 20:00 GMT' }
    ]
  },
  ro: {
    heroBadge: 'Contact',
    heroTitle: 'Suntem aici să ajutăm',
    heroIntro: 'Scrie-ne pentru suport, oferte sau parteneriate. Trimite un mesaj și răspundem în cel mult o zi lucrătoare.',
    channels: [
      { label: 'Suport', detail: 'support@skykit.test', note: 'Pentru incidente și ajutor în producție' },
      { label: 'Vânzări', detail: 'sales@skykit.test', note: 'Prețuri, pilotări și enterprise' },
      { label: 'Parteneriate', detail: 'partners@skykit.test', note: 'Integrări și operațiuni comune' }
    ],
    messageBadge: 'Mesaj',
    messageTitle: 'Spune-ne de ce ai nevoie',
    responseTarget: 'Țintă de răspuns: sub 1 zi lucrătoare.',
    form: {
      nameLabel: 'Nume',
      namePlaceholder: 'Numele complet',
      emailLabel: 'Email',
      emailPlaceholder: 'tu@companie.com',
      companyLabel: 'Companie',
      companyPlaceholder: 'Numele companiei aeriene sau MRO',
      topicLabel: 'Subiect',
      topicPlaceholder: 'Alege un subiect',
      topicOptions: {
        support: 'Suport',
        sales: 'Vânzări',
        partnerships: 'Parteneriate',
        other: 'Altceva'
      },
      messageLabel: 'Mesaj',
      messagePlaceholder: 'Cum te putem ajuta?'
    },
    buttonText: 'Trimite mesajul',
    buttonNote: 'Răspunsurile noastre sunt concise și orientate spre soluții.',
    officesBadge: 'Birouri',
    officesTitle: 'Acoperire follow-the-sun',
    officesNote: 'Echipa de escaladare este on-call 24/7 pentru probleme critice.',
    offices: [
      { city: 'Seattle', info: 'Centru operațional principal', hours: '06:00 - 18:00 PST' },
      { city: 'Londra', info: 'Acoperire de rețea', hours: '08:00 - 20:00 GMT' }
    ]
  }
} as const;

export function ContactUsPage({ game, theme, onToggleTheme, language, onToggleLanguage }: ContactUsPageProps) {
  const { isConnected } = game;
  const copy = contactContent[language];
  const formCopy = copy.form;

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }, []);

  return (
    <PageShell>
      <SiteHeader
        isConnected={isConnected}
        theme={theme}
        onToggleTheme={onToggleTheme}
        language={language}
        onToggleLanguage={onToggleLanguage}
      />

      <div className="mb-6">
        <BackToDashboardButton theme={theme} language={language} />
      </div>

      <div className="max-w-5xl mx-auto space-y-8">
        <section className="rounded-[34px] bg-linear-to-br from-bg-alt/95 to-panel-dark/90 p-6 sm:p-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(6,6,10,0.7)]">
          <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-2">{copy.heroBadge}</p>
          <h2 className="text-3xl sm:text-4xl font-semibold">{copy.heroTitle}</h2>
          <p className="text-text-muted mt-3 max-w-3xl">
            {copy.heroIntro}
          </p>
          <div className="grid gap-4 mt-6 md:grid-cols-3">
            {copy.channels.map(channel => (
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
              <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-1">{copy.messageBadge}</p>
              <h3 className="text-2xl font-semibold">{copy.messageTitle}</h3>
            </div>
            <span className="text-sm text-text-muted">{copy.responseTarget}</span>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm text-text">
              {formCopy.nameLabel}
              <input
                type="text"
                name="name"
                placeholder={formCopy.namePlaceholder}
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-text">
              {formCopy.emailLabel}
              <input
                type="email"
                name="email"
                placeholder={formCopy.emailPlaceholder}
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-text">
              {formCopy.companyLabel}
              <input
                type="text"
                name="company"
                placeholder={formCopy.companyPlaceholder}
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-text">
              {formCopy.topicLabel}
              <select
                name="topic"
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text focus:border-accent outline-none"
                defaultValue=""
              >
                <option value="" disabled>{formCopy.topicPlaceholder}</option>
                <option value="support">{formCopy.topicOptions.support}</option>
                <option value="sales">{formCopy.topicOptions.sales}</option>
                <option value="partnerships">{formCopy.topicOptions.partnerships}</option>
                <option value="other">{formCopy.topicOptions.other}</option>
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-2 text-sm text-text">
              {formCopy.messageLabel}
              <textarea
                name="message"
                rows={4}
                placeholder={formCopy.messagePlaceholder}
                className="rounded-xl border border-border bg-panel-dark/70 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent outline-none resize-none"
                required
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-text hover:border-accent hover:text-accent transition"
              >
                {copy.buttonText}
              </button>
              <span className="text-xs text-text-muted">{copy.buttonNote}</span>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-border/70 bg-linear-to-r from-panel-dark/80 via-bg-alt/70 to-panel/80 p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="uppercase tracking-[0.2em] text-xs text-text-muted mb-1">{copy.officesBadge}</p>
              <h3 className="text-2xl font-semibold">{copy.officesTitle}</h3>
            </div>
            <p className="text-sm text-text-muted">{copy.officesNote}</p>
          </div>
          <div className="grid gap-4 mt-5 md:grid-cols-2">
            {copy.offices.map(office => (
              <div key={office.city} className="rounded-2xl border border-border/60 p-4 bg-panel/70">
                <p className="text-xs uppercase tracking-[0.2em] text-text-muted">{office.city}</p>
                <p className="text-lg font-semibold mt-1">{office.info}</p>
                <p className="text-sm text-text-muted mt-2">{pickLanguage(language, { en: 'Hours', ro: 'Program' })}: {office.hours}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export default ContactUsPage;
