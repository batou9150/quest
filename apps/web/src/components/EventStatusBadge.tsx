import { useTranslation } from 'react-i18next';
import type { EventStatus } from '@quest/shared';

const styles: Record<EventStatus, string> = {
  UPCOMING: 'border-accent-700 bg-accent-950/60 text-accent-200',
  ACTIVE: 'border-emerald-700 bg-emerald-950/60 text-emerald-300',
  COMPLETED: 'border-slate-700 bg-slate-800 text-slate-400',
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const { t } = useTranslation();
  return <span className={`rounded border px-2 py-1 font-mono text-xs font-bold ${styles[status]}`}>{t(`eventStatus.${status}`)}</span>;
}
