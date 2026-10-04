import { Check, Copy } from 'lucide-react';
import { useCopy } from '../lib/hooks';

/** Copy-to-clipboard icon button with inline "Copied" feedback. */
export function CopyButton({ text, label = 'Copy to clipboard' }: { text: string; label?: string }) {
  const { copied, failed, copy } = useCopy();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => copy(text)}
        className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      >
        {copied ? <Check size={18} className="text-emerald-400" aria-hidden /> : <Copy size={18} aria-hidden />}
      </button>
      <span aria-live="polite" className={`text-xs ${failed ? 'text-red-400' : 'text-emerald-400'}`}>
        {copied ? 'Copied!' : failed ? 'Copy failed — select and copy manually.' : ''}
      </span>
    </span>
  );
}
