import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router';
import {
  BookOpen,
  CalendarDays,
  FileCode2,
  Grid3x3,
  Home,
  Info,
  Layers,
  LogIn,
  LogOut,
  Terminal,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useMe } from '../lib/auth';
import { formatNumber } from '../lib/format';

interface ItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  onNavigate: () => void;
}

function NavItem({ to, icon: Icon, label, end, onNavigate }: ItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-lg border-l-2 px-4 py-2.5 transition-colors ${
          isActive
            ? 'border-quantum-500 bg-quantum-500/10 text-quantum-300'
            : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`
      }
    >
      <Icon size={18} aria-hidden className="shrink-0 group-hover:text-quantum-400" />
      <span className="font-medium tracking-wide">{label}</span>
    </NavLink>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 px-4 font-mono text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { me, loading, logout } = useMe();
  const navigate = useNavigate();

  return (
    <nav aria-label="Main" className="flex flex-col gap-8">
      <Section title="> NAV">
        <NavItem to="/" end icon={Home} label="Home" onNavigate={onNavigate} />
        <NavItem to="/events" icon={CalendarDays} label="Events" onNavigate={onNavigate} />
        <NavItem to="/guides" icon={BookOpen} label="Guides" onNavigate={onNavigate} />
        <NavItem to="/about" icon={Info} label="About" onNavigate={onNavigate} />
      </Section>

      <Section title="> USER_CONSOLE">
        {loading ? (
          <p className="px-4 font-mono text-xs text-slate-600">checking session…</p>
        ) : me ? (
          <>
            <NavItem to="/profile" icon={User} label="Profile" onNavigate={onNavigate} />
            <NavItem to="/level-select" icon={Grid3x3} label="Level Select" onNavigate={onNavigate} />
            {me.activeLevelId && <NavItem to="/play" icon={Terminal} label="Play" onNavigate={onNavigate} />}
            <NavItem to="/game-api" icon={FileCode2} label="API Access" onNavigate={onNavigate} />
            <button
              type="button"
              onClick={async () => {
                onNavigate();
                await logout();
                navigate('/');
              }}
              className="flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-4 py-2.5 text-slate-400 transition-colors hover:bg-red-950/40 hover:text-red-400"
            >
              <LogOut size={18} aria-hidden />
              <span className="font-medium tracking-wide">Disconnect</span>
            </button>
          </>
        ) : (
          <NavItem to="/login" icon={LogIn} label="Connect" onNavigate={onNavigate} />
        )}
      </Section>

      {me?.role === 'admin' && (
        <Section title="> ADMIN">
          <NavItem to="/admin/users" icon={Users} label="Users" onNavigate={onNavigate} />
          <NavItem to="/admin/levels" icon={Layers} label="Levels" onNavigate={onNavigate} />
          <NavItem to="/admin/events" icon={Trophy} label="Events" onNavigate={onNavigate} />
          <NavItem to="/admin/guides" icon={BookOpen} label="Guides" onNavigate={onNavigate} />
        </Section>
      )}

      {me && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 p-3">
          {me.avatarUrl ? (
            <img src={me.avatarUrl} alt="" className="h-10 w-10 rounded-full border border-slate-600" />
          ) : (
            <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 font-bold text-slate-300">
              {me.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{me.displayName}</p>
            <p className="truncate font-mono text-xs text-quantum-400">{formatNumber(me.totalScore)} pts</p>
          </div>
        </div>
      )}
    </nav>
  );
}
