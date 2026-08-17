'use client';

import { useEffect, useRef, useState } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Optional sticky footer (e.g. submit/cancel buttons). */
  footer?: React.ReactNode;
  /** Max height as Tailwind class. Defaults to max-h-[90vh]. */
  maxHeightClass?: string;
}

/**
 * Mobile-first bottom sheet. Slides up from the bottom, with a
 * drag handle and backdrop tap-to-dismiss. The native HTML <dialog>
 * element doesn't have great bottom-sheet UX on iOS Safari, so we
 * build a custom one with proper touch handling.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeightClass = 'max-h-[90vh]',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragDelta, setDragDelta] = useState(0);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setDragStart(e.clientY);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStart === null) return;
    const delta = Math.max(0, e.clientY - dragStart);
    setDragDelta(delta);
  }

  function onPointerUp() {
    if (dragStart === null) return;
    // If dragged more than 100px down, dismiss
    if (dragDelta > 100) {
      onClose();
    }
    setDragStart(null);
    setDragDelta(0);
  }

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in"
        aria-label="Close"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 bg-paper border-t-2 border-ink ${maxHeightClass} flex flex-col rounded-t-2xl animate-slide-up`}
        style={{
          transform: dragDelta > 0 ? `translateY(${dragDelta}px)` : undefined,
          transition: dragStart === null ? 'transform 200ms ease-out' : 'none',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="w-10 h-1 bg-ink-30 rounded-full" />
        </div>

        {/* Header */}
        {title ? (
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h2 className="font-extrabold text-[15px] uppercase tracking-[0.05em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 -mr-1 flex items-center justify-center text-ink-50"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : null}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer ? (
          <div className="px-5 py-3 border-t border-line bg-cream-2">{footer}</div>
        ) : null}

        {/* Safe area padding for iPhone home indicator */}
        <div className="h-[env(safe-area-inset-bottom)] bg-paper" />
      </div>
    </div>
  );
}
