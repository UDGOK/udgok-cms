'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface MarketingNavProps {
  signedIn?: boolean;
  userName?: string | null;
}

export function MarketingNav({ signedIn = false, userName }: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav
      className={`sticky top-0 z-50 bg-paper border-b-2 transition-colors ${
        scrolled ? 'border-ink' : 'border-line'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-3.5 md:py-4 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-black text-xl md:text-2xl tracking-tight flex items-center gap-2"
        >
          <span className="w-7 h-7 md:w-8 md:h-8 bg-ink text-cream flex items-center justify-center font-black text-sm">
            U
          </span>
          UDG<span className="text-orange">OK</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-7">
          <NavLink href="/features" currentPath={pathname}>Features</NavLink>
          <NavLink href="/pricing" currentPath={pathname}>Pricing</NavLink>
          <NavLink href="/showcase" currentPath={pathname}>Showcase</NavLink>
          <NavLink href="https://github.com/UDGOK/udgok-cms" external>GitHub</NavLink>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          {signedIn ? (
            <>
              {userName ? (
                <span className="text-[12px] font-mono uppercase tracking-[0.1em] text-ink-50">
                  Hi, {userName}
                </span>
              ) : null}
              <Link
                href="/workspaces"
                className="px-4 py-2.5 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange hover:border-orange border-2 border-ink"
              >
                Open app →
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-4 py-2.5 text-ink text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-cream-2"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-2.5 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d hover:border-orange-d"
              >
                Start free →
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center text-ink"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen ? (
        <div className="md:hidden border-t-2 border-ink bg-paper">
          <div className="px-5 py-4 space-y-1">
            <MobileNavLink href="/features" currentPath={pathname}>Features</MobileNavLink>
            <MobileNavLink href="/pricing" currentPath={pathname}>Pricing</MobileNavLink>
            <MobileNavLink href="/showcase" currentPath={pathname}>Showcase</MobileNavLink>
            <div className="pt-3 mt-3 border-t border-line space-y-2">
              {signedIn ? (
                <Link
                  href="/workspaces"
                  className="block w-full text-center px-4 py-3 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.15em]"
                >
                  Open app →
                </Link>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="block w-full text-center px-4 py-3 border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.15em]"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="block w-full text-center px-4 py-3 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.15em]"
                  >
                    Start free →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function NavLink({
  href,
  currentPath,
  children,
  external,
}: {
  href: string;
  currentPath?: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const isActive = !external && currentPath === href;
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="text-ink-50 text-[12px] font-extrabold uppercase tracking-[0.12em] hover:text-ink"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className={`text-[12px] font-extrabold uppercase tracking-[0.12em] transition-colors ${
        isActive ? 'text-ink' : 'text-ink-50 hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  currentPath,
  children,
}: {
  href: string;
  currentPath: string;
  children: React.ReactNode;
}) {
  const isActive = currentPath === href;
  return (
    <Link
      href={href}
      className={`block px-3 py-3 text-[14px] font-extrabold uppercase tracking-[0.1em] border-l-[3px] ${
        isActive
          ? 'border-orange text-ink bg-cream-2'
          : 'border-transparent text-ink-70 hover:text-ink hover:bg-cream-2'
      }`}
    >
      {children}
    </Link>
  );
}
