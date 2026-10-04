import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { EllipsisVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  /** Navigates like a link (middle-click works). */
  to?: string;
  onSelect?: () => void;
  danger?: boolean;
}

const MENU_WIDTH = 176;

/**
 * A "⋮" button opening a small menu of row actions.
 * The menu is rendered in a portal with fixed positioning, so table scroll containers do not clip it.
 */
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  // Place the menu under the button, right-aligned; open upward when there is no room below.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? items.length * 36 + 8;
    const below = rect.bottom + 4 + height <= window.innerHeight;
    setPosition({
      top: below ? rect.bottom + 4 : rect.top - 4 - height,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    // preventScroll: a scroll closes the menu, and the menu is already placed on screen.
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const onViewportChange = () => close();
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const entries = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      entries[(index + step + entries.length) % entries.length]?.focus({ preventScroll: true });
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      entries[e.key === 'Home' ? 0 : entries.length - 1]?.focus({ preventScroll: true });
    }
  };

  const itemClass = (danger?: boolean) =>
    `flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium outline-none transition-colors ${
      danger
        ? 'text-red-300 hover:bg-red-950/60 focus-visible:bg-red-950/60'
        : 'text-slate-200 hover:bg-slate-800 focus-visible:bg-slate-800'
    }`;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
          open ? 'border-slate-500 bg-slate-700 text-white' : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <EllipsisVertical size={18} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            style={{ position: 'fixed', top: position?.top ?? -9999, left: position?.left ?? -9999, width: MENU_WIDTH }}
            className="z-50 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40"
          >
            {items.map((item) =>
              item.to ? (
                <Link key={item.label} to={item.to} role="menuitem" tabIndex={-1} className={itemClass(item.danger)} onClick={() => close()}>
                  {item.icon}
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={itemClass(item.danger)}
                  onClick={() => {
                    close(true);
                    item.onSelect?.();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
