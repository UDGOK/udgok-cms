'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface WorkspaceOption {
  id: string;
  slug: string;
  name: string;
  role: string;
}

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function switchTo(slug: string) {
    setOpen(false);
    // Preserve the current path section (e.g. /dashboard) but swap the workspace slug
    const rest = pathname.replace(/^\/w\/[^/]+/, '');
    router.push(`/w/${slug}${rest}`);
  }

  const others = workspaces.filter((w) => w.slug !== current.slug);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-cream border border-transparent hover:border-line transition-colors"
      >
        <span className="font-bold uppercase text-ink text-[12px] tracking-tight">
          {current.name}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-ink-50">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full mt-1 z-50 bg-paper border-2 border-ink min-w-[260px] shadow-lg">
          <div className="px-3 py-2 border-b border-line bg-cream-2 text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">
            Switch workspace
          </div>

          {/* Current workspace (highlighted) */}
          <div className="px-3 py-2.5 bg-cream flex items-center justify-between">
            <div>
              <div className="font-extrabold text-[13px] text-ink">{current.name}</div>
              <div className="text-[10px] font-mono text-ink-50 uppercase tracking-[0.05em]">
                current · {current.role}
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-success" />
          </div>

          {/* Other workspaces */}
          {others.length > 0 ? (
            <>
              <div className="px-3 py-1.5 border-t border-line text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50">
                Your other workspaces
              </div>
              {others.map((w) => (
                <button
                  key={w.slug}
                  onClick={() => switchTo(w.slug)}
                  className="w-full text-left px-3 py-2.5 border-t border-line-soft hover:bg-cream-2 flex items-center justify-between"
                >
                  <div>
                    <div className="font-extrabold text-[13px]">{w.name}</div>
                    <div className="text-[10px] font-mono text-ink-50 uppercase tracking-[0.05em]">
                      {w.role}
                    </div>
                  </div>
                  <span className="text-ink-50 text-[10px]">→</span>
                </button>
              ))}
            </>
          ) : null}

          <div className="border-t border-line">
            <Link
              href="/workspaces"
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-[12px] font-extrabold uppercase tracking-[0.05em] hover:bg-cream-2"
            >
              All workspaces →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
