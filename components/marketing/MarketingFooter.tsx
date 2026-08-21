import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="bg-cream-2 border-t-2 border-ink">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-black text-2xl tracking-tight inline-block mb-3">
              UDG<span className="text-orange">OK</span>
            </Link>
            <p className="text-[13px] text-ink-70 max-w-[280px] leading-relaxed">
              The construction management CMS for builders who&apos;d rather swing a hammer than type into a spreadsheet.
            </p>
          </div>
          <FooterCol title="Product" links={[
            { href: '/features', label: 'Features' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/changelog', label: 'Changelog' },
          ]} />
          <FooterCol title="Resources" links={[
            { href: '/help', label: 'Help center' },
            { href: '/docs', label: 'Docs' },
            { href: '/changelog', label: 'What\'s new' },
            { href: 'https://status.udgok.com', label: 'Status', external: true },
          ]} />
          <FooterCol title="Company" links={[
            { href: '/about', label: 'About' },
            { href: '/contact?source=footer', label: 'Contact' },
            { href: '/security', label: 'Security' },
            { href: 'https://github.com/UDGOK/udgok-cms', label: 'GitHub', external: true },
          ]} />
          <FooterCol title="Legal" links={[
            { href: '/privacy', label: 'Privacy' },
            { href: '/terms', label: 'Terms' },
            { href: '/security', label: 'Security' },
            { href: '/dpa', label: 'DPA' },
          ]} />
        </div>
        <div className="pt-6 border-t border-line flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          <span>© 2026 UDGOK Construction · All rights reserved</span>
          <span>UDG<span className="text-orange">OK</span> · Built for builders</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <h4 className="text-[10px] font-extrabold uppercase tracking-[0.15em] mb-3 text-ink">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.label}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-ink-70 hover:text-ink inline-flex items-center gap-1"
              >
                {l.label}
                <span aria-hidden className="text-[10px]">↗</span>
              </a>
            ) : (
              <Link
                href={l.href}
                className="text-[13px] text-ink-70 hover:text-ink"
              >
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
