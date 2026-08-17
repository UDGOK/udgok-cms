'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function MobilePageHeader({
  title,
  subtitle,
  backHref,
  actionLabel,
  actionHref,
  actionVariant = 'copper',
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  actionLabel?: string;
  actionHref?: string;
  actionVariant?: 'primary' | 'ghost' | 'copper';
  showBack?: boolean;
}) {
  const router = useRouter();

  const actionCls =
    actionVariant === 'primary'
      ? 'bg-ink text-cream border-ink'
      : actionVariant === 'copper'
      ? 'bg-orange text-paper border-orange'
      : 'bg-paper text-ink border-ink';

  return (
    <div className="md:hidden sticky top-0 z-30 bg-paper border-b-2 border-ink">
      <div className="flex items-center gap-2 px-4 h-14">
        {showBack ? (
          backHref ? (
            <Link
              href={backHref}
              aria-label="Back"
              className="w-10 h-10 -ml-2 flex items-center justify-center text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="w-10 h-10 -ml-2 flex items-center justify-center text-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )
        ) : null}
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[15px] leading-tight truncate">{title}</h1>
          {subtitle ? (
            <p className="text-[10px] font-mono uppercase tracking-[0.05em] text-ink-50 truncate">{subtitle}</p>
          ) : null}
        </div>
        {actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className={`px-3 h-9 inline-flex items-center text-[11px] font-extrabold uppercase tracking-[0.1em] border-2 ${actionCls}`}
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
