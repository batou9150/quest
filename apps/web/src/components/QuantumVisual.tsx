/** Decorative CSS-only "quantum core" for the home hero: orbits around a glowing nucleus, with a terminal tag. */
export function QuantumVisual() {
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-sm">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-quantum-500/20 to-accent-500/20 blur-3xl" />
      <div className="absolute inset-[6%] rounded-full border border-quantum-500/30 animate-orbit">
        <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-quantum-400 shadow-[0_0_12px_var(--color-quantum-400)]" />
      </div>
      <div className="absolute inset-[20%] rotate-45 rounded-full border border-accent-400/30 animate-orbit-reverse">
        <span className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-accent-400 shadow-[0_0_12px_var(--color-accent-400)]" />
      </div>
      <div className="absolute inset-[33%] rounded-full border border-dashed border-quantum-300/30 animate-orbit">
        <span className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rounded-full bg-quantum-200" />
      </div>
      <div className="absolute inset-[42%] rounded-full bg-gradient-to-br from-quantum-300 via-quantum-500 to-accent-600 shadow-[0_0_60px_var(--color-quantum-500)]" />
      <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-slate-800 bg-slate-950/90 px-3 py-1 font-mono text-xs text-quantum-400">
        &gt; SYSTEM_READY<span className="animate-blink">_</span>
      </div>
    </div>
  );
}
