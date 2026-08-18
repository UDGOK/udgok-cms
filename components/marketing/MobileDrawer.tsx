'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface DrawerContext {
  primaryWorkspaceSlug: string | null;
  isMasterAdmin: boolean;
}

interface DrawerItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
  external?: boolean;
}

interface DrawerSection {
  title: string;
  items: DrawerItem[];
}

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  features: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  pricing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  showcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  docs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  ),
  changelog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  contact: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  app: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" />
    </svg>
  ),
  workspaces: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  signout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  status: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
};

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { isSignedIn, user, isLoaded } = useUser();
  const [signingOut, setSigningOut] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Fetch primary workspace + master admin status when signed in
  const [ctx, setCtx] = useState<DrawerContext>({ primaryWorkspaceSlug: null, isMasterAdmin: false });

  useEffect(() => {
    if (!open || !isSignedIn) {
      setCtx({ primaryWorkspaceSlug: null, isMasterAdmin: false });
      return;
    }
    let cancelled = false;
    fetch('/api/drawer-context', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { primaryWorkspaceSlug: null, isMasterAdmin: false }))
      .then((data: DrawerContext) => {
        if (!cancelled) setCtx(data);
      })
      .catch(() => {
        if (!cancelled) setCtx({ primaryWorkspaceSlug: null, isMasterAdmin: false });
      });
    return () => {
      cancelled = true;
    };
  }, [open, isSignedIn]);

  if (!open) return null;

  const userName = user?.firstName || user?.username || null;
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null;
  const userAvatar = user?.imageUrl ?? null;
  const primaryWorkspaceSlug = ctx.primaryWorkspaceSlug ?? undefined;
  const isMasterAdmin = ctx.isMasterAdmin;

  const signedOutSections: DrawerSection[] = [
    {
      title: 'Get started',
      items: [
        { label: 'Home', href: '/', icon: ICONS.home },
        { label: 'Features', href: '/features', icon: ICONS.features, description: 'Every tool in UDGOK' },
        { label: 'Pricing', href: '/pricing', icon: ICONS.pricing, description: 'Free, Pro, Enterprise' },
        { label: 'Showcase', href: '/showcase', icon: ICONS.showcase, description: 'See the live app' },
      ],
    },
    {
      title: 'Resources',
      items: [
        { label: 'Help center', href: '/help', icon: ICONS.help, description: 'FAQs + guides' },
        { label: 'Documentation', href: '/docs', icon: ICONS.docs, description: 'Setup, API, integrations' },
        { label: 'Changelog', href: '/changelog', icon: ICONS.changelog, description: 'What is new' },
        { label: 'System status', href: 'https://status.udgok.com', icon: ICONS.status, description: 'All systems operational', external: true },
      ],
    },
    {
      title: 'Company',
      items: [
        { label: 'About', href: '/about', icon: ICONS.about, description: 'Our story' },
        { label: 'Contact', href: 'mailto:hello@udgok.com', icon: ICONS.contact, description: 'hello@udgok.com', external: true },
      ],
    },
    {
      title: 'Trust',
      items: [
        { label: 'Security', href: '/security', icon: ICONS.shield, description: 'How we keep data safe' },
        { label: 'Privacy', href: '/privacy', icon: ICONS.file, description: 'Your data, your rights' },
        { label: 'Terms', href: '/terms', icon: ICONS.file, description: 'Service agreement' },
        { label: 'DPA', href: '/dpa', icon: ICONS.file, description: 'GDPR / CCPA' },
      ],
    },
  ];

  const signedInSections: DrawerSection[] = [
    {
      title: 'Workspace',
      items: [
        {
          label: 'Open dashboard',
          href: primaryWorkspaceSlug ? `/w/${primaryWorkspaceSlug}/dashboard` : '/workspaces',
          icon: ICONS.app,
          description: primaryWorkspaceSlug ? 'Jump to your project feed' : 'Choose a workspace',
        },
        {
          label: 'Switch workspace',
          href: '/workspaces',
          icon: ICONS.workspaces,
          description: 'All your workspaces',
        },
        ...(isMasterAdmin
          ? [
              { label: 'Master admin', href: '/admin', icon: ICONS.admin, description: 'All workspaces + users' } as DrawerItem,
              { label: 'System health', href: '/admin/system', icon: ICONS.status, description: 'Integrations status' } as DrawerItem,
            ]
          : []),
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Settings', href: '/workspaces', icon: ICONS.settings, description: 'Workspace + profile' },
      ],
    },
    {
      title: 'Product',
      items: [
        { label: 'Features', href: '/features', icon: ICONS.features },
        { label: 'Pricing', href: '/pricing', icon: ICONS.pricing },
        { label: 'Showcase', href: '/showcase', icon: ICONS.showcase },
      ],
    },
    {
      title: 'Resources',
      items: [
        { label: 'Help center', href: '/help', icon: ICONS.help },
        { label: 'Documentation', href: '/docs', icon: ICONS.docs },
        { label: 'Changelog', href: '/changelog', icon: ICONS.changelog },
      ],
    },
    {
      title: 'Company',
      items: [
        { label: 'About', href: '/about', icon: ICONS.about },
        { label: 'Contact', href: 'mailto:hello@udgok.com', icon: ICONS.contact, external: true },
      ],
    },
  ];

  const sections = isSignedIn ? signedInSections : signedOutSections;

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: '/' });
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div
      className="md:hidden fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade-in"
        aria-label="Close menu"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside className="absolute top-0 left-0 bottom-0 w-[320px] max-w-[88vw] bg-paper flex flex-col animate-slide-in-left shadow-2xl">
        {/* Header with close button */}
        <div className="px-5 py-4 border-b-2 border-ink flex items-center justify-between flex-shrink-0">
          <Link href="/" onClick={onClose} className="font-black text-xl tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 bg-ink text-cream flex items-center justify-center font-black text-sm">
              U
            </span>
            UDG<span className="text-orange">OK</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 -mr-1 flex items-center justify-center text-ink-50 hover:text-ink hover:bg-cream-2"
            aria-label="Close menu"
          >
            {ICONS.close}
          </button>
        </div>

        {/* User card (if signed in) */}
        {isLoaded && isSignedIn ? (
          <div className="px-5 py-4 border-b border-line bg-cream-2 flex items-center gap-3 flex-shrink-0">
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-ink text-cream flex items-center justify-center font-black text-sm flex-shrink-0">
                {(userName || userEmail || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-[13px] truncate">
                {userName || userEmail}
              </div>
              <div className="text-[11px] text-ink-50 truncate">{userEmail}</div>
            </div>
            {isMasterAdmin ? (
              <div className="w-7 h-7 bg-orange text-paper flex items-center justify-center flex-shrink-0" title="Master admin">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                </svg>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((section) => (
            <div key={section.title} className="px-3 py-2">
              <div className="px-2 py-1.5 text-[10px] font-mono font-extrabold uppercase tracking-[0.15em] text-ink-50">
                {section.title}
              </div>
              <ul>
                {section.items.map((item) => {
                  const isActive = !item.external && pathname === item.href;
                  const inner = (
                    <span className="flex items-center gap-3 px-2.5 py-2.5 border-l-[3px] transition-colors">
                      <span className={`w-7 h-7 flex items-center justify-center flex-shrink-0 ${
                        isActive ? 'bg-orange text-paper' : 'text-ink-50'
                      }`}>
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[14px] font-extrabold leading-tight ${
                          isActive ? 'text-ink' : 'text-ink-70'
                        }`}>
                          {item.label}
                        </span>
                        {item.description ? (
                          <span className="block text-[11px] text-ink-50 truncate mt-0.5">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      {item.external ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-ink-30 flex-shrink-0">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      ) : null}
                    </span>
                  );
                  return (
                    <li key={item.label + item.href}>
                      {item.external ? (
                        <a
                          href={item.href}
                          className={`block hover:bg-cream-2 ${isActive ? 'bg-cream-2 border-orange' : 'border-transparent'}`}
                        >
                          {inner}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={`block hover:bg-cream-2 ${isActive ? 'bg-cream-2 border-orange' : 'border-transparent'}`}
                        >
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Sign out for signed-in users */}
          {isLoaded && isSignedIn ? (
            <div className="px-3 py-2 border-t border-line mt-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 text-error hover:bg-error/5 disabled:opacity-50"
              >
                <span className="w-7 h-7 flex items-center justify-center">{ICONS.signout}</span>
                <span className="font-extrabold text-[14px]">
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </span>
              </button>
            </div>
          ) : null}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line bg-cream-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span>UDG<span className="text-orange">OK</span> · v1.0</span>
            <a href="https://github.com/UDGOK/udgok-cms" target="_blank" rel="noopener" className="text-ink-70 hover:text-ink">
              GitHub →
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
