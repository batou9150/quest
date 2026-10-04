import { Link } from 'react-router';
import { btnPrimary } from '../components/ui';

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="font-mono text-6xl font-black text-quantum-500">404</p>
      <h1 className="text-2xl font-bold text-white">Sector not found</h1>
      <p className="font-mono text-sm text-slate-500">&gt; You can't go that way.</p>
      <Link to="/" className={btnPrimary}>
        Back to Home
      </Link>
    </div>
  );
}
