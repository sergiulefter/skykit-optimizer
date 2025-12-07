import { useMemo, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { SiteHeader } from '../components/SiteHeader';
import { BackToDashboardButton } from '../components/BackToDashboardButton';
import type { UseGameStateResult } from '../hooks/useGameState';
import type { Theme } from '../hooks/useTheme';
import type { Language } from '../hooks/useLanguage';
import { pickLanguage } from '../i18n/utils';

type AlgorithmPageProps = {
  game: UseGameStateResult;
  theme: Theme;
  onToggleTheme: () => void;
  language: Language;
  onToggleLanguage: () => void;
};

type CarouselSlide = {
  id: string;
  badge: string;
  title: string;
  headline: string;
  description: string;
  notes: string[];
};

type PillarCard = {
  label: string;
  description: string;
  metric: string;
};

const copy = {
  en: {
    heroBadge: 'Inside the optimizer',
    heroTitle: 'Algorithm playbook',
    heroIntro:
      'SkyKit prioritizes rotable kits with a demand-aware heuristic. The stack ingests IoT telemetry, predicts stress windows, locks routing constraints, then simulates thousands of swaps to keep fleets green.',
    heroFootnote: 'Use the carousel to see how each stage contributes to the final routing instructions.',
    prevLabel: 'Previous insight',
    nextLabel: 'Next insight',
    dotLabel: 'Go to slide',
    slideLabel: 'Slide',
    pillarTitle: 'Operational guardrails',
    pledgeTitle: 'What the solver guarantees',
    pledgeItems: [
      'Respect max-lag per aircraft tail and ensure safety buffers on critical kits.',
      'Prefer swaps that avoid penalty bursts beyond the current round horizon.',
      'Feed each simulation back into the scoring model to avoid oscillations.'
    ]
  },
  ro: {
    heroBadge: 'În interiorul optimizerului',
    heroTitle: 'Playbook-ul algoritmului',
    heroIntro:
      'SkyKit prioritizează kiturile rotabile cu un algoritm sensibil la cerere. Stiva colectează telemetria IoT, prezice intervalele critice, aplică constrângeri de rutare și simulează mii de schimburi pentru a menține flotele operaționale.',
    heroFootnote: 'Folosește caruselul pentru a vedea cum contribuie fiecare etapă la instrucțiunile finale de rutare.',
    prevLabel: 'Insight anterior',
    nextLabel: 'Insight următor',
    dotLabel: 'Mergi la slide',
    slideLabel: 'Slide',
    pillarTitle: 'Ghidaje operaționale',
    pledgeTitle: 'Ce garantează solver-ul',
    pledgeItems: [
      'Respectă întârzierea maximă per aeronavă și păstrează rezerve pe kiturile critice.',
      'Preferă schimburi care evită vârfuri de penalizare în orizontul rundei curente.',
      'Trimite fiecare simulare înapoi în scor pentru a nu crea oscilații.'
    ]
  }
};

const carouselSlides = {
  en: [
    {
      id: 'collect',
      badge: 'Data intake',
      title: '1 · Collect kit signals',
      headline: 'We pull IoT health, flight schedules, weather, and manual notes every few seconds.',
      description:
        'Each feed enters a queue so nothing is lost when a sensor blips. The result is a complete snapshot of every airport bay before we decide anything.',
      notes: [
        'Missing numbers are backfilled with the last trusted reading.',
        'Ops teams can override a sensor by leaving a quick note in the console.'
      ]
    },
    {
      id: 'clean',
      badge: 'Cleaning',
      title: '2 · Clean and align the data',
      headline: 'We smooth noisy curves and convert everything to the same scale.',
      description:
        'Simple moving averages and z-score checks catch spikes. We also convert costs, time zones, and kit families so the solver sees apples-to-apples inputs.',
      notes: [
        'If a value sits outside the safe band we flag it and keep the last good value.',
        'Weather alerts apply a “confidence tax” so the solver knows the data might drift.'
      ]
    },
    {
      id: 'forecast',
      badge: 'Demand look-ahead',
      title: '3 · Forecast kit usage',
      headline: 'A light attention model predicts which airports will run hot or cold in the next 72h.',
      description:
        'We combine historical swaps, current flights, and penalty history to get a consumption curve per kit family. The curve becomes the pressure map for all routing.',
      notes: [
        'Lead times and shipping duration turn into soft buffers on the curve.',
        'The model outputs both a central estimate and a risk band.'
      ]
    },
    {
      id: 'constraints',
      badge: 'Constraints',
      title: '4 · Build the constraint board',
      headline: 'Simple rules keep the solver grounded in reality.',
      description:
        'We pin aircraft that are under maintenance, lock kits already promised to a flight, and mark depots that are at capacity. Customs or night curfews become time windows.',
      notes: [
        'Rules are editable so operations can temporarily lift a limit.',
        'We annotate every rule with its source for easy auditing.'
      ]
    },
    {
      id: 'simulate',
      badge: 'Solver loop',
      title: '5 · Simulate swap plans',
      headline: 'Greedy restarts + simulated annealing explore thousands of possible moves.',
      description:
        'We score each plan on cost, penalty avoidance, and how resilient it is to small delays. Only the best few plans survive and move into a deeper sandbox run.',
      notes: [
        'The solver prefers moves that unlock multiple troubled flights.',
        'Emission and handling deltas stay attached to every hop.'
      ]
    },
    {
      id: 'publish',
      badge: 'Explain & monitor',
      title: '6 · Publish the plan and watch it',
      headline: 'A final sandbox replay stresses the plan before we ship it to operators.',
      description:
        'If the replay stays inside the risk band, we send the instructions plus a short explanation card. Live monitors keep an eye on new data and can re-trigger the loop.',
      notes: [
        'Failed replays go into a learning buffer so the solver avoids the same trap.',
        'Operators receive a “why this works” summary for every hop.'
      ]
    }
  ] satisfies CarouselSlide[],
  ro: [
    {
      id: 'collect',
      badge: 'Colectare date',
      title: '1 · Colectăm semnalele kiturilor',
      headline: 'Preluăm sănătatea IoT, programele de zbor, vremea și notițele manuale la câteva secunde.',
      description:
        'Fiecare flux intră într-o coadă ca să nu pierdem valori când senzorii au oscilații. Obținem un instantaneu complet al fiecărui stand înainte să luăm decizii.',
      notes: [
        'Valorile lipsă sunt completate cu ultima măsurătoare de încredere.',
        'Echipele pot suprascrie un senzor printr-o notă rapidă în consolă.'
      ]
    },
    {
      id: 'clean',
      badge: 'Curățare',
      title: '2 · Curățăm și aliniem datele',
      headline: 'Netezim curbele și aducem toate valorile pe aceeași scară.',
      description:
        'Mediile mobile și verificările z-score găsesc spike-urile. Convertim costuri, fusuri orare și familii de kit pentru ca solverul să vadă intrări comparabile.',
      notes: [
        'Dacă o valoare iese din banda sigură, o semnalăm și păstrăm ultimul punct bun.',
        'Alertele meteo aplică o “taxă de încredere” ca solverul să știe că datele pot devia.'
      ]
    },
    {
      id: 'forecast',
      badge: 'Prognoză cerere',
      title: '3 · Prezicem folosirea kiturilor',
      headline: 'Un model ușor cu atenție arată unde se va încălzi sau răci rețeaua în 72h.',
      description:
        'Combinăm schimburile istorice, zborurile active și istoricul penalităților pentru a obține o curbă de consum pe familie de kit. Curba devine harta de presiune.',
      notes: [
        'Timpul de aprovizionare și durata transportului devin buffere soft.',
        'Modelul livrează atât estimarea centrală, cât și o bandă de risc.'
      ]
    },
    {
      id: 'constraints',
      badge: 'Constrângeri',
      title: '4 · Construim tabla de reguli',
      headline: 'Reguli simple țin solverul legat de realitate.',
      description:
        'Blocăm aeronavele aflate în mentenanță, fixăm kiturile deja promise și marcăm depozitele pline. Vama sau interdicțiile de noapte devin ferestre de timp.',
      notes: [
        'Regulile pot fi editate pentru ridicarea temporară a unei limite.',
        'Anotăm sursa fiecărei reguli pentru audit rapid.'
      ]
    },
    {
      id: 'simulate',
      badge: 'Bucla solverului',
      title: '5 · Simulăm planurile de schimb',
      headline: 'Restarturi greedy + annealing simulat explorează mii de mutări.',
      description:
        'Punctăm fiecare plan pe cost, evitarea penalizărilor și reziliență la întârzieri mici. Doar câteva planuri trec într-o simulare mai profundă.',
      notes: [
        'Solverul preferă mutările care deblochează mai multe zboruri cu probleme.',
        'Delta de emisii și manipulare rămâne atașată fiecărui hop.'
      ]
    },
    {
      id: 'publish',
      badge: 'Explicăm și monitorizăm',
      title: '6 · Publicăm planul și îl urmărim',
      headline: 'O rejucare finală solicită planul înainte să ajungă la operatori.',
      description:
        'Dacă rejucarea rămâne în bara de risc, trimitem instrucțiunile plus o fișă de explicații. Monitoarele live urmăresc datele noi și pot reporni bucla.',
      notes: [
        'Rejucările eșuate intră într-un buffer de învățare ca să evităm aceeași capcană.',
        'Operatorii primesc pentru fiecare hop un rezumat “de ce funcționează”.'
      ]
    }
  ] satisfies CarouselSlide[]
};

const pillarCards = {
  en: [
    {
      label: 'Confidence envelopes',
      description: 'Range forecasts per kit family, recalibrated every 90s as telemetry lags surface.',
      metric: '±4.2% mean absolute error'
    },
    {
      label: 'Stability window',
      description: 'Solver only publishes if penalty risk stays below the agreed threshold for four back-to-back sims.',
      metric: '< 0.6 penalty bursts / hour'
    },
    {
      label: 'Traceable payloads',
      description: 'Each hop bundles emissions, handling time, and human-readable rationale for audit.',
      metric: '~12 KB signed packet'
    }
  ] satisfies PillarCard[],
  ro: [
    {
      label: 'Intervale de încredere',
      description: 'Prognoze pe familie de kit, recalibrate la 90s când apar întârzieri de telemetrie.',
      metric: '±4.2% eroare absolută medie'
    },
    {
      label: 'Fereastră de stabilitate',
      description: 'Solver-ul publică doar dacă riscul de penalizare rămâne sub prag pentru patru simulări consecutive.',
      metric: '< 0.6 vârfuri de penalizare / oră'
    },
    {
      label: 'Payload-uri trasabile',
      description: 'Fiecare rută include emisii, timp de manipulare și raționament pentru audit.',
      metric: '~12 KB pachet semnat'
    }
  ] satisfies PillarCard[]
};

export function AlgorithmPage({ game, theme, onToggleTheme, language, onToggleLanguage }: AlgorithmPageProps) {
  const { isConnected } = game;
  const [activeSlide, setActiveSlide] = useState(0);
  const localizedCopy = useMemo(() => pickLanguage(language, copy), [language]);
  const slides = useMemo(() => pickLanguage(language, carouselSlides), [language]);
  const cards = useMemo(() => pickLanguage(language, pillarCards), [language]);

  const goTo = (index: number) => {
    if (slides.length === 0) return;
    const normalized = (index + slides.length) % slides.length;
    setActiveSlide(normalized);
  };

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

      <section className="rounded-[34px] border border-border/70 bg-linear-to-br from-bg-alt/80 via-panel/80 to-panel-dark/80 p-6 sm:p-10 shadow-[0_30px_80px_rgba(6,6,10,0.6)] space-y-6">
        <div className="flex flex-col gap-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-text-muted">
            <span className="inline-block h-1 w-6 rounded-full bg-accent" />
            {localizedCopy.heroBadge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold">{localizedCopy.heroTitle}</h2>
          <p className="text-text-muted text-base max-w-3xl">{localizedCopy.heroIntro}</p>
          <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{localizedCopy.heroFootnote}</p>
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-[30px] border border-border/80 bg-linear-to-br from-panel-dark/70 to-bg-alt/90 p-6 sm:p-10 min-h-[320px]">
            {slides.map((slide, index) => (
              <article
                key={slide.id}
                aria-hidden={index !== activeSlide}
                className={`transition-all duration-500 will-change-transform ${
                  index === activeSlide
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-6 pointer-events-none absolute inset-6'
                }`}
              >
                <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-accent mb-4">
                  {slide.badge}
                </span>
                <p className="text-sm uppercase tracking-[0.3em] text-text-muted mb-1">
                  {localizedCopy.slideLabel} {index + 1}/{slides.length}
                </p>
                <h3 className="text-2xl sm:text-3xl font-semibold mb-3">{slide.title}</h3>
                <p className="text-lg text-accent-2 font-semibold mb-4">{slide.headline}</p>
                <p className="text-text-muted mb-5">{slide.description}</p>
                <ul className="space-y-2 text-sm text-text-muted">
                  {slide.notes.map(note => (
                    <li key={note} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => goTo(activeSlide - 1)}
                className="rounded-full border border-border/70 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-text hover:border-accent transition"
              >
                {localizedCopy.prevLabel}
              </button>
              <button
                type="button"
                onClick={() => goTo(activeSlide + 1)}
                className="rounded-full border border-border/70 bg-panel/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-text hover:border-accent transition"
              >
                {localizedCopy.nextLabel}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`${localizedCopy.dotLabel} ${index + 1}`}
                  onClick={() => goTo(index)}
                  className={`h-3 w-3 rounded-full transition ${
                    index === activeSlide ? 'bg-accent shadow-[0_0_20px_rgba(56,189,248,0.6)]' : 'bg-border hover:bg-border/70'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        {cards.map(card => (
          <article
            key={card.label}
            className="glass-card rounded-[28px] border border-border/70 bg-linear-to-br from-panel-dark/70 to-panel/70 p-6"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted mb-2">{localizedCopy.pillarTitle}</p>
            <h4 className="text-lg font-semibold mb-2">{card.label}</h4>
            <p className="text-text-muted text-sm mb-4">{card.description}</p>
            <p className="text-xs font-mono text-accent">{card.metric}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-[34px] border border-border/60 bg-linear-to-r from-panel/70 to-bg-alt/70 p-6 sm:p-10">
        <p className="uppercase tracking-[0.4em] text-xs text-text-muted mb-3">{localizedCopy.pledgeTitle}</p>
        <ul className="space-y-4 text-sm text-text-muted">
          {localizedCopy.pledgeItems.map(item => (
            <li key={item} className="flex gap-3">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-accent" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}

export default AlgorithmPage;
