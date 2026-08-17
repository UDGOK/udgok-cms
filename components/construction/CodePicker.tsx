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

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Smart suggestions: based on the trade text, suggest a CSI division
  const suggestions: CSISuggestion[] = useMemo(() => {
    return suggestCSI(trade, 6);
  }, [trade]);

  // If the user has manually typed a code, the suggestions hide (they're
  // explicitly overriding). Otherwise show the top suggestion as a hint.
  const topSuggestion = suggestions.find((s) => s.isTopMatch) ?? null;
  const showSuggestionHint = !code && !open && topSuggestion && trade.length >= 3;

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

      {/* Suggestion hint (when user is typing trade, no code yet) */}
      {showSuggestionHint ? (
        <button
          type="button"
          onClick={() => pickDivision(topSuggestion.division)}
          className="absolute left-0 right-0 top-full mt-1 z-10 text-left bg-cream border-2 border-orange px-3 py-2 hover:bg-orange hover:text-paper transition-colors"
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

      {/* Open dropdown: full CSI library */}
      {open ? (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-paper border-2 border-ink max-h-[320px] overflow-y-auto shadow-lg">
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
