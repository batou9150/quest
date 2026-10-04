import { useState, type ReactNode } from 'react';
import { btnDanger, btnGhost, btnSmall } from './ui';

/**
 * A destructive action with an inline confirmation step (no window.confirm).
 * First click reveals "Confirm" / "Cancel"; the action runs only on "Confirm".
 */
export function ConfirmButton({
  children,
  confirmLabel = 'Confirm',
  prompt = 'Are you sure?',
  onConfirm,
  disabled,
  className,
  small,
  ariaLabel,
}: {
  children: ReactNode;
  confirmLabel?: string;
  prompt?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  small?: boolean;
  ariaLabel?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const size = small ? btnSmall : '';

  if (!asking) {
    return (
      <button type="button" aria-label={ariaLabel} className={className ?? `${btnDanger} ${size}`} disabled={disabled} onClick={() => setAsking(true)}>
        {children}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={prompt}>
      <span className="text-xs text-amber-300">{prompt}</span>
      <button
        type="button"
        className={`${btnDanger} ${size}`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button type="button" className={`${btnGhost} ${size}`} disabled={busy} onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
