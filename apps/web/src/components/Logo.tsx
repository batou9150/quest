export function LogoMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-16 w-16 rounded-xl text-3xl' : 'h-8 w-8 rounded-md text-lg';
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-quantum-500 to-accent-500 font-bold text-white shadow-lg shadow-quantum-500/20 ${cls}`}
    >
      Q
    </span>
  );
}
