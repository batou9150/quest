import { Link } from 'react-router';
import { ArrowRight, Bot, Terminal, Trophy } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useMe } from '../lib/auth';
import { QuantumVisual } from '../components/QuantumVisual';
import { btnPrimary, btnSecondary } from '../components/ui';

/** A sample of real game output: the game itself is in English, so this transcript stays English in every language. */
const transcript: { cmd: string; out: string }[] = [
  { cmd: 'look', out: 'Briefing Room. A windowless room deep inside the mountain. A heavy door leads north. You see: tablet, mug.' },
  { cmd: 'take tablet', out: 'You pick up the tablet. Its screen flickers to life.' },
  { cmd: 'examine tablet', out: 'A ruggedised tablet. The last message reads: "The badge is in the locker. Hurry."' },
  { cmd: 'go north', out: 'Level 28 Corridor. Caged bulbs hum overhead. Exits: south, east, north.' },
];

const features = [
  { icon: Terminal, title: 'home.browserTitle', text: 'home.browserText' },
  { icon: Bot, title: 'home.apiTitle', text: 'home.apiText' },
  { icon: Trophy, title: 'home.eventsTitle', text: 'home.eventsText' },
] as const;

export function Home() {
  const { t } = useTranslation();
  const { me } = useMe();
  return (
    <div className="space-y-16">
      <section className="flex flex-col items-center gap-12 lg:flex-row">
        <div className="space-y-6 lg:w-3/5">
          <p className="font-mono text-sm text-quantum-400">{t('home.welcome')}</p>
          <h1 className="bg-gradient-to-r from-white via-quantum-100 to-quantum-500 bg-clip-text text-4xl font-black leading-tight text-transparent sm:text-5xl xl:text-6xl">
            {t('home.title')}
          </h1>
          <p className="border-l-4 border-quantum-500 pl-4 text-lg leading-relaxed text-slate-400">
            <Trans i18nKey="home.intro" components={{ strong: <strong className="text-white" /> }} />
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link to={me ? '/level-select' : '/login'} className={`${btnPrimary} px-8 py-3 text-base`}>
              {t('home.start')} <ArrowRight size={18} aria-hidden />
            </Link>
            <Link to="/guides" className={`${btnSecondary} px-8 py-3 text-base`}>
              {t('home.readGuides')}
            </Link>
          </div>
        </div>
        <div className="w-full lg:w-2/5">
          <QuantumVisual />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <Icon size={22} className="mb-3 text-quantum-400" aria-hidden />
            <h2 className="font-bold text-white">{t(title)}</h2>
            <p className="mt-1 text-sm text-slate-400">{t(text)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-sm sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="rounded-lg bg-slate-800 p-3 text-quantum-400">
            <Terminal size={28} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mb-2 text-2xl font-bold text-white">{t('home.whatIsTitle')}</h2>
            <p className="mb-4 leading-relaxed text-slate-400">
              <Trans i18nKey="home.whatIsText" components={{ em: <em />, code: <code className="font-mono text-quantum-300" /> }} />
            </p>
            <div lang="en" aria-label={t('home.transcriptLabel')} role="group" className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-sm">
              {transcript.map(({ cmd, out }) => (
                <div key={cmd} className="mb-2 last:mb-0">
                  <div>
                    <span className="mr-2 text-emerald-400">$</span>
                    <span className="text-slate-200">{cmd}</span>
                  </div>
                  <div className="text-slate-500">{out}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
