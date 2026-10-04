import { useTranslation } from 'react-i18next';
import { LANGS } from '@quest/shared';
import { LANG_ENDONYMS, setLanguage, useLang } from '../i18n';

/** Compact EN | FR toggle for the header. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <div role="group" aria-label={t('lang.switcher')} className="flex items-center rounded-lg border border-slate-700 p-0.5 font-mono text-xs font-bold">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          aria-label={LANG_ENDONYMS[l]}
          title={LANG_ENDONYMS[l]}
          onClick={() => setLanguage(l)}
          className={`rounded-md px-2 py-1 uppercase transition-colors ${
            lang === l ? 'bg-quantum-500/20 text-quantum-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
