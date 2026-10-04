import { Navigate, Outlet, useLocation } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useMe } from '../lib/auth';
import { Loading } from './Status';

/** Layout route: renders children only for logged-in users, otherwise redirects to /login. */
export function RequireAuth() {
  const { me, loading } = useMe();
  const location = useLocation();
  if (loading) return <Loading label="Checking session…" />;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Layout route: renders children only for admins. */
export function RequireAdmin() {
  const { me, loading } = useMe();
  if (loading) return <Loading label="Checking session…" />;
  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== 'admin') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <ShieldAlert size={40} className="text-red-400" aria-hidden />
        <h1 className="text-2xl font-bold text-white">Access denied</h1>
        <p className="text-slate-400">This area is restricted to administrators.</p>
      </div>
    );
  }
  return <Outlet />;
}

/** Layout route: for logged-out users only (the login page). */
export function RequireGuest() {
  const { me, loading } = useMe();
  if (loading) return <Loading label="Checking session…" />;
  if (me) return <Navigate to="/level-select" replace />;
  return <Outlet />;
}
