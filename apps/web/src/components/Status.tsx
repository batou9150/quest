import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../lib/api';
import { btnSecondary, btnSmall } from './ui';

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 font-mono text-sm text-slate-500">
      <Loader2 size={18} className="animate-spin text-quantum-400" aria-hidden />
      {label ?? t('common.loading')}
    </div>
  );
}

export function ErrorMessage({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-900/60 bg-red-950/30 p-5 sm:flex-row sm:items-center">
      <AlertTriangle size={20} className="shrink-0 text-red-400" aria-hidden />
      <div className="flex-1">
        <p className="font-bold text-red-300">{title ?? t('common.somethingWentWrong')}</p>
        <p className="text-sm text-red-200/80">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={onRetry}>
          <RefreshCw size={14} aria-hidden /> {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">{children}</div>;
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-400">
      {children}
    </p>
  );
}
