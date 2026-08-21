'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { MobileDrawer } from './MobileDrawer';

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={`sticky top-0 z-40 bg-paper border-b-2 transition-colors ${
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
            <NavLink href="/help" currentPath={pathname}>Help</NavLink>
            <NavLink href="/docs" currentPath={pathname}>Docs</NavLink>
            <NavLink href="/changelog" currentPath={pathname}>Changelog</NavLink>
            <NavLink href="/contact" currentPath={pathname}>Contact</NavLink>
          </div>

          {/* Desktop CTAs */}
          <DesktopCTA />

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center text-ink hover:bg-cream-2"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </nav>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function DesktopCTA() {
  const { isSignedIn, user, isLoaded } = useUser();
  if (!isLoaded) {
    return <div className="hidden md:block w-32 h-9" />; // reserve space
  }
  if (isSignedIn) {
    return (
      <div className="hidden md:flex items-center gap-2">
        {user?.firstName ? (
          <span className="text-[12px] font-mono uppercase tracking-[0.1em] text-ink-50">
            Hi, {user.firstName}
          </span>
        ) : null}
        <Link
          href="/workspaces"
          className="px-4 py-2.5 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange hover:border-orange border-2 border-ink"
        >
          Open app →
        </Link>
      </div>
    );
  }
  return (
    <div className="hidden md:flex items-center gap-2">
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
    </div>
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
