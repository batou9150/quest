/** Shared class names so pages stay consistent (only colours defined in the theme are used). */
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const btnPrimary = `${btnBase} bg-quantum-500 text-slate-950 hover:bg-quantum-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]`;
export const btnSecondary = `${btnBase} border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500 hover:bg-slate-700`;
export const btnGhost = `${btnBase} text-slate-400 hover:bg-slate-800 hover:text-slate-200`;
export const btnDanger = `${btnBase} border border-red-800 bg-red-950/60 text-red-300 hover:bg-red-900/60`;
export const btnSmall = 'px-2.5 py-1 text-xs';

export const input =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-600 transition-colors focus:border-quantum-500 focus:outline-none focus:ring-1 focus:ring-quantum-500/50';
export const label = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';
export const card = 'rounded-xl border border-slate-800 bg-slate-900';
export const chip = 'rounded-full border px-3 py-1 text-xs font-bold transition-colors';
export const chipActive = 'border-quantum-500 bg-quantum-500/15 text-quantum-300';
export const chipIdle = 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200';
