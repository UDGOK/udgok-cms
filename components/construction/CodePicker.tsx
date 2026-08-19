'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { suggestCSI, type CSISuggestion } from '@/lib/construction/suggest';
import { CSI_MASTERFORMAT, type CSIDivision } from '@/lib/construction/csi-masterformat';

interface CodePickerProps {
  /** Current code value (controlled) */
  code: string;
  /** Current trade value (controlled) */
  trade: string;
  /** Called whenever either field changes */
  onChange: (next: { code: string; trade: string }) => void;
  /** Optional disabled / error states */
  codeError?: string;
  tradeError?: string;
}

export function CodePicker({
  code,
  trade,
  onChange,
  codeError,
  // tradeError is shown in the separate Trade input below
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tradeError: _tradeError,
}: CodePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const suggestionRef = useRef<HTMLButtonElement | null>(null);

  // Smart suggestions: based on the trade text, suggest a CSI division
  const suggestions: CSISuggestion[] = useMemo(() => {
    return suggestCSI(trade, 6);
  }, [trade]);

  // If the user has manually typed a code, the suggestions hide (they're
  // explicitly overriding). Otherwise show the top suggestion as a hint.
  const topSuggestion = suggestions.find((s) => s.isTopMatch) ?? null;
  const showSuggestionHint = !code && !open && topSuggestion && trade.length >= 3;

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Position the dropdown (or suggestion hint) just below the
  // CSI code input. On mobile (where these use position: fixed
  // so they can span the viewport), the `top` CSS property is
  // in viewport coordinates. We compute it from the input's
  // getBoundingClientRect() so the popup always anchors directly
  // below the field, even if the user scrolled.
  //
  // On desktop they use position: absolute with `top-full`, so
  // the inline `top` style is ignored and there's nothing to
  // update.
  useEffect(() => {
    if (!open && !showSuggestionHint) return;
    function reposition() {
      if (!inputRef.current) return;
      // Pick whichever popup is currently rendered.
      const popup = dropdownRef.current ?? suggestionRef.current;
      if (!popup) return;
      const r = inputRef.current.getBoundingClientRect();
      // Place popup 4px below the input's bottom edge.
      // Clamp so it never falls off the bottom of the viewport.
      const desiredTop = r.bottom + 4;
      const popupHeight = popup.offsetHeight || 320;
      const maxTop = window.innerHeight - popupHeight - 8;
      const top = Math.min(desiredTop, Math.max(8, maxTop));
      popup.style.top = `${top}px`;
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true });
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition);
    };
  }, [open, showSuggestionHint]);

  function pickDivision(d: CSIDivision) {
    onChange({ code: d.number, trade: d.name });
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open && suggestions[activeIdx]) {
      e.preventDefault();
      pickDivision(suggestions[activeIdx].division);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="col-span-2 relative" ref={containerRef}>
      <label className="block text-[10px] font-mono font-extrabold tracking-[0.12em] text-ink-50 uppercase mb-1.5">
        CSI Code
      </label>
      <input
        ref={inputRef}
        type="text"
        value={code}
        onChange={(e) => onChange({ code: e.target.value, trade })}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="03"
        aria-label="CSI MasterFormat code"
        className={`block w-full px-3.5 py-3 bg-transparent border text-ink text-sm outline-none focus:border-ink ${
          codeError ? 'border-error' : 'border-line'
        }`}
      />
      {codeError ? (
        <p className="text-[11px] text-error font-semibold mt-1">{codeError}</p>
      ) : null}

      {/* Suggestion hint (when user is typing trade, no code yet).
       *  Same width strategy as the main dropdown below. */}
      {showSuggestionHint ? (
        <button
          ref={suggestionRef}
          type="button"
          onClick={() => pickDivision(topSuggestion.division)}
          className="
            z-30 text-left
            fixed left-4 right-4
            md:absolute md:left-0 md:right-auto md:top-full md:mt-1
            md:min-w-[320px] md:w-[min(28rem,calc(100vw-2rem))]
            bg-cream border-2 border-orange px-3 py-2 hover:bg-orange hover:text-paper transition-colors
          "
        >
          <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-orange-d group-hover:text-paper">
            Suggested
          </div>
          <div className="text-[13px] font-extrabold">
            <span className="font-mono mr-2">{topSuggestion.division.number}</span>
            {topSuggestion.division.name}
          </div>
          <div className="text-[11px] text-ink-50 mt-0.5">{topSuggestion.division.description}</div>
        </button>
      ) : null}

      {/* Open dropdown: full CSI library.
       *
       *  Width strategy:
       *    - Mobile: position: fixed with viewport insets
       *      (left-4 right-4). The "top" comes from the
       *      input's measured position via JS so the dropdown
       *      anchors just below it. This is wide enough to
       *      read the descriptions and stays inside the
       *      viewport regardless of where the input is.
       *    - Desktop: position: absolute relative to the
       *      col-span-2 cell, but with a min-width of 320px
       *      (and a left offset of -120px to break out of
       *      the narrow cell). This makes the dropdown
       *      wide enough to fit a division name on one line
       *      on desktop, where the form is 12 cols and the
       *      CodePicker cell is only ~94px wide.
       */}
      {open ? (
        <div
          ref={dropdownRef}
          className="
            z-30 bg-paper border-2 border-ink max-h-[320px] overflow-y-auto shadow-lg
            fixed left-4 right-4
            md:absolute md:left-0 md:right-auto md:top-full md:mt-1
            md:min-w-[320px] md:w-[min(28rem,calc(100vw-2rem))]
          "
        >
          <div className="px-3 py-2 border-b border-line bg-cream-2 text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 sticky top-0">
            CSI MasterFormat · {CSI_MASTERFORMAT.length} divisions
          </div>
          {CSI_MASTERFORMAT.map((d, i) => {
            const isSuggested = suggestions[i]?.isTopMatch && trade.length >= 3;
            const isActive = activeIdx === i;
            return (
              <button
                key={d.number}
                type="button"
                onClick={() => pickDivision(d)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full text-left px-3 py-2 border-b border-line-soft last:border-0 transition-colors ${
                  isActive ? 'bg-ink text-cream' : 'hover:bg-cream-2'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-[12px] font-extrabold w-[28px] flex-shrink-0 ${
                    isActive ? 'text-orange-l' : 'text-orange-d'
                  }`}>
                    {d.number}
                  </span>
                  <span className="font-extrabold text-[13px] flex-1">
                    {d.name}
                  </span>
                  {isSuggested ? (
                    <span className={`px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.1em] ${
                      isActive ? 'bg-orange-l text-ink' : 'bg-orange text-paper'
                    }`}>
                      Match
                    </span>
                  ) : null}
                </div>
                <div className={`text-[11px] ml-[36px] mt-0.5 ${isActive ? 'text-cream/70' : 'text-ink-50'}`}>
                  {d.description}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
