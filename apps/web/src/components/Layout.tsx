import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useMe } from '../lib/auth';
import { LogoMark } from './Logo';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { error } = useMe();
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-slate-800 focus:px-3 focus:py-2">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <LogoMark />
            <span className="text-lg font-bold tracking-wider text-white">THE QUANTUM QUEST</span>
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-slate-300 hover:bg-slate-800 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-200">
          Could not check your session: {error.message}
        </div>
      )}

      <div className="mx-auto max-w-7xl md:grid md:grid-cols-[minmax(13rem,1fr)_minmax(0,2fr)] lg:grid-cols-[minmax(15rem,1fr)_minmax(0,3fr)]">
        <aside
          id="sidebar"
          className={`${menuOpen ? 'block' : 'hidden'} border-b border-slate-800 bg-slate-900 px-4 py-6 md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:overflow-y-auto md:border-b-0 md:border-r md:bg-transparent`}
        >
          <Sidebar onNavigate={() => setMenuOpen(false)} />
        </aside>

        <main id="content" className="relative min-w-0 overflow-x-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-slate-800)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-slate-800)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
          />
          <div className="relative z-10 px-4 py-6 md:px-8 md:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
