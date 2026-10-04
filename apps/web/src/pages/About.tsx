import { Bot, Code2, Target } from 'lucide-react';
import { Link } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';

const pillars = [
  { icon: Target, title: 'about.missionTitle', text: 'about.missionText', color: 'text-quantum-400 bg-quantum-950' },
  { icon: Bot, title: 'about.agentsTitle', text: 'about.agentsText', color: 'text-accent-300 bg-accent-950' },
  { icon: Code2, title: 'about.openTitle', text: 'about.openText', color: 'text-amber-300 bg-amber-950' },
] as const;

const link = 'text-quantum-400 hover:underline';

export function About() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">{t('about.title')}</h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400">{t('about.intro')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, text, color }) => (
          <div key={title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${color}`}>
              <Icon size={24} aria-hidden />
            </div>
            <h2 className="mb-2 font-bold text-white">{t(title)}</h2>
            <p className="text-sm text-slate-400">{t(text)}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-white">{t('about.howTitle')}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-slate-400">
          <li>
            <Trans i18nKey="about.step1" components={{ a: <Link to="/login" className={link} /> }} />
          </li>
          <li>
            <Trans i18nKey="about.step2" components={{ a: <Link to="/level-select" className={link} /> }} />
          </li>
          <li>{t('about.step3')}</li>
          <li>{t('about.step4')}</li>
        </ol>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-white">{t('about.creatorsTitle')}</h2>
        <p className="text-slate-400">
          <Trans
            i18nKey="about.creatorsText"
            components={{
              issues: <a href="https://github.com/batou9150/quest/issues" className={link} />,
              repo: <a href="https://github.com/batou9150/quest" className={link} />,
            }}
          />
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-white">{t('about.inspirationTitle')}</h2>
        <p className="text-slate-400">
          <Trans
            i18nKey="about.inspirationText"
            components={{
              game: <a href="https://adventure.wietsevenema.eu/" target="_blank" rel="noopener noreferrer" className={link} />,
              author: <a href="https://github.com/wietsevenema" target="_blank" rel="noopener noreferrer" className={link} />,
            }}
          />
        </p>
      </div>
    </div>
  );
}
