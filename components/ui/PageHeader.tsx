import Link from 'next/link';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-4 flex-wrap pb-7 border-b border-line mb-6">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {b.href ? (
                  <Link href={b.href} className="hover:text-orange-d">{b.label}</Link>
                ) : (
                  <span className="text-ink">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 ? <span className="text-ink-30">/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-3xl font-black tracking-tight leading-tight">{title}</h1>
        {subtitle ? (
          <p className="text-[13px] text-ink-70 mt-2 max-w-2xl">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
