import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ROLES, type AdminUpdateUser, type AdminUser, type Page, type Role } from '@quest/shared';
import { api, errorMessage } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { useMe } from '../../lib/auth';
import { formatDate, formatNumber } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Empty, ErrorMessage, InlineError, Loading } from '../../components/Status';
import { btnSecondary, btnSmall, input } from '../../components/ui';

function UserRow({ user, isSelf, onChanged }: { user: AdminUser; isSelf: boolean; onChanged: (u: AdminUser) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const patch = (body: AdminUpdateUser, success: string) =>
    run(async () => {
      await api<unknown>(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body });
      onChanged({ ...user, ...body });
    }, success);

  const disabled = isSelf || busy;

  return (
    <tr className={`align-top ${user.banned ? 'bg-red-950/20' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-slate-700" aria-hidden />}
          <div className="min-w-0">
            <p className="font-bold text-slate-200">
              {user.displayName} {isSelf && <span className="font-mono text-xs text-quantum-400">{t('common.you')}</span>}
              {user.banned && <span className="ml-1 font-mono text-xs text-red-400">{t('adminUsers.banned')}</span>}
            </p>
            <p className="break-all text-xs text-slate-500">{user.email}</p>
            <p className="text-xs text-slate-600">
              {t('adminUsers.joined', { provider: user.provider, date: formatDate(user.createdAt) })}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-quantum-400">{formatNumber(user.totalScore)}</td>
      <td className="px-4 py-3">
        <label htmlFor={`role-${user.id}`} className="sr-only">
          {t('adminUsers.roleOf', { name: user.displayName })}
        </label>
        <select
          id={`role-${user.id}`}
          className={`${input} w-auto py-1 text-sm`}
          value={user.role}
          disabled={disabled}
          onChange={(e) => void patch({ role: e.target.value as Role }, t('adminUsers.roleSet', { role: t(`role.${e.target.value as Role}`) }))}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {user.banned ? (
            <button type="button" className={`${btnSecondary} ${btnSmall}`} disabled={disabled} onClick={() => void patch({ banned: false }, t('adminUsers.unbanned'))}>
              {t('adminUsers.unban')}
            </button>
          ) : (
            <ConfirmButton
              small
              disabled={disabled}
              prompt={t('adminUsers.banPrompt', { name: user.displayName })}
              confirmLabel={t('adminUsers.ban')}
              onConfirm={() => patch({ banned: true }, t('adminUsers.bannedNotice'))}
            >
              {t('adminUsers.ban')}
            </ConfirmButton>
          )}
          <ConfirmButton
            small
            disabled={disabled}
            prompt={t('adminUsers.resetPrompt')}
            confirmLabel={t('adminUsers.resetConfirm')}
            onConfirm={() =>
              run(async () => {
                await api<void>(`/api/admin/users/${encodeURIComponent(user.id)}/reset-progress`, { method: 'POST' });
                onChanged({ ...user, totalScore: 0 });
              }, t('adminUsers.resetNotice'))
            }
          >
            {t('adminUsers.reset')}
          </ConfirmButton>
          <ConfirmButton
            small
            disabled={disabled}
            prompt={t('adminUsers.revokePrompt')}
            confirmLabel={t('adminUsers.revokeConfirm')}
            onConfirm={() => run(() => api<void>(`/api/admin/users/${encodeURIComponent(user.id)}/api-key`, { method: 'DELETE' }), t('adminUsers.revokeNotice'))}
          >
            {t('adminUsers.revoke')}
          </ConfirmButton>
        </div>
        <div aria-live="polite" className="mt-1 text-xs">
          {error && <InlineError>{error}</InlineError>}
          {notice && <span className="text-emerald-400">{notice}</span>}
        </div>
      </td>
    </tr>
  );
}

export function AdminUsers() {
  const { t } = useTranslation();
  const { me } = useMe();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 300);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1] ?? null;

  useEffect(() => setCursors([null]), [q]);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cursor) params.set('cursor', cursor);
  const { data, error, loading, reload, setData } = useApi<Page<AdminUser>>(`/api/admin/users?${params.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader title={t('adminUsers.title')} subtitle={t('adminUsers.subtitle')} icon={<Users className="text-quantum-400" aria-hidden />} />
      <div className="relative max-w-md">
        <label htmlFor="user-search" className="sr-only">
          {t('adminUsers.search')}
        </label>
        <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-500" size={18} aria-hidden />
        <input id="user-search" type="search" className={`${input} pl-10`} placeholder={t('adminUsers.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading && !data ? (
        <Loading label={t('adminUsers.loading')} />
      ) : error ? (
        <ErrorMessage error={error} onRetry={reload} title={t('adminUsers.loadError')} />
      ) : !data || data.items.length === 0 ? (
        <Empty>{t('adminUsers.empty')}</Empty>
      ) : (
        <div className={`overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="bg-slate-950 font-mono text-xs uppercase text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3">{t('adminUsers.colUser')}</th>
                <th scope="col" className="px-4 py-3 text-right">{t('adminUsers.colScore')}</th>
                <th scope="col" className="px-4 py-3">{t('adminUsers.colRole')}</th>
                <th scope="col" className="px-4 py-3">{t('adminUsers.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.items.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === me?.id}
                  onChanged={(updated) => setData({ ...data, items: data.items.map((x) => (x.id === updated.id ? updated : x)) })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" className={`${btnSecondary} ${btnSmall}`} disabled={cursors.length <= 1 || loading} onClick={() => setCursors((c) => c.slice(0, -1))}>
          <ChevronLeft size={14} aria-hidden /> {t('adminUsers.previous')}
        </button>
        <span className="font-mono text-xs text-slate-500">{t('adminUsers.page', { page: cursors.length })}</span>
        <button
          type="button"
          className={`${btnSecondary} ${btnSmall}`}
          disabled={!data?.nextCursor || loading}
          onClick={() => data?.nextCursor && setCursors((c) => [...c, data.nextCursor])}
        >
          {t('adminUsers.next')} <ChevronRight size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
