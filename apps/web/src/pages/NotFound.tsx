import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { btnPrimary } from '../components/ui';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="font-mono text-6xl font-black text-quantum-500">404</p>
      <h1 className="text-2xl font-bold text-white">{t('notFound.title')}</h1>
      <p className="font-mono text-sm text-slate-500">{t('notFound.flavour')}</p>
      <Link to="/" className={btnPrimary}>
        {t('notFound.back')}
      </Link>
    </div>
  );
}
