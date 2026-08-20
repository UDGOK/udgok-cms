'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useWorkspace } from './WorkspaceContext';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  allWorkspaces: Array<{ id: string; slug: string; name: string; role: string }>;
  isMasterAdmin?: boolean;
}

interface DrawerLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const ICON_HOME = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="9" />
    <rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" />
    <rect x="3" y="16" width="7" height="5" />
  </svg>
);
const ICON_CLIENTS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);
const ICON_DEALS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const ICON_PROJECTS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const ICON_TASKS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const ICON_FILES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);
const ICON_TEAM = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ICON_SUBS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const ICON_SETTINGS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const ICON_CLOSE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ICON_EXTERNAL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ICON_SCAN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);

export function MobileDrawer({ open, onClose, allWorkspaces, isMasterAdmin }: DrawerProps) {
  const { slug, name, role } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [workspacesOpen, setWorkspacesOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  const links: DrawerLink[] = [
    { label: 'Dashboard', href: `/w/${slug}/dashboard`, icon: ICON_HOME },
    { label: 'Projects', href: `/w/${slug}/projects`, icon: ICON_PROJECTS },
    { label: 'Tasks', href: `/w/${slug}/tasks`, icon: ICON_TASKS },
    { label: 'Files', href: `/w/${slug}/files`, icon: ICON_FILES },
    { label: 'Scan', href: `/w/${slug}/scan`, icon: ICON_SCAN },
    { label: 'Clients', href: `/w/${slug}/clients`, icon: ICON_CLIENTS },
    { label: 'Deals', href: `/w/${slug}/deals`, icon: ICON_DEALS },
    { label: 'Team', href: `/w/${slug}/team`, icon: ICON_TEAM },
    { label: 'Subcontractors', href: `/w/${slug}/subcontractors`, icon: ICON_SUBS },
    { label: 'Check-in', href: `/w/${slug}/checkin`, icon: ICON_SCAN },
    { label: 'Settings', href: `/w/${slug}/settings`, icon: ICON_SETTINGS },
  ];

  if (isMasterAdmin) {
    links.push({ label: '👑 Master admin', href: '/admin', icon: ICON_SETTINGS });
  }

  const others = allWorkspaces.filter((w) => w.slug !== slug);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function switchTo(newSlug: string) {
    onClose();
    const rest = pathname.replace(/^\/w\/[^/]+/, '');
    router.push(`/w/${newSlug}${rest}`);
  }

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside className="absolute top-0 left-0 bottom-0 w-[300px] max-w-[85vw] bg-ink text-cream flex flex-col animate-slide-in-left">
        {/* Header */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-cream/10">
          <Link href={`/w/${slug}/dashboard`} className="font-black text-xl">
            UDG<span className="text-orange">OK</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-cream/70 hover:text-cream"
            aria-label="Close"
          >
            {ICON_CLOSE}
          </button>
        </div>

        {/* Current workspace (collapsible to switch) */}
        <div className="px-5 py-4 border-b border-cream/10">
          <button
            type="button"
            onClick={() => setWorkspacesOpen(!workspacesOpen)}
            className="w-full text-left"
          >
            <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-cream/40 mb-1">
              Current workspace
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-extrabold text-[15px]">{name}</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-cream/60 mt-0.5">
                  {role}
                </div>
              </div>
              <span className={`text-cream/60 transition-transform ${workspacesOpen ? 'rotate-90' : ''}`}>
                {ICON_EXTERNAL}
              </span>
            </div>
          </button>
          {workspacesOpen ? (
            <div className="mt-3 space-y-1">
              {others.length > 0 ? (
                others.map((w) => (
                  <button
                    key={w.slug}
                    onClick={() => switchTo(w.slug)}
                    className="w-full text-left px-3 py-2 bg-cream/5 hover:bg-cream/10 border border-cream/10"
                  >
                    <div className="font-extrabold text-[13px]">{w.name}</div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.05em] text-cream/50">
                      {w.role}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-[11px] text-cream/50 px-3 py-2">No other workspaces</div>
              )}
              <Link
                href="/workspaces"
                onClick={onClose}
                className="block text-[11px] text-orange uppercase tracking-[0.1em] font-extrabold px-3 py-2 hover:text-orange-l"
              >
                All workspaces →
              </Link>
            </div>
          ) : null}
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3">
          <ul>
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-5 py-3.5 text-[14px] font-extrabold border-l-[3px] transition-colors ${
                      active
                        ? 'text-cream bg-orange/10 border-orange'
                        : 'text-cream/70 border-transparent hover:text-cream hover:bg-cream/5'
                    }`}
                  >
                    <span className="w-5 h-5 flex-shrink-0">{link.icon}</span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User + role footer */}
        <div className="px-5 py-4 border-t border-cream/10 flex items-center gap-3">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-9 h-9',
              },
            }}
          />
          <div className="text-[10px] font-mono text-cream/40 tracking-[0.1em] uppercase">
            {role}
          </div>
        </div>
      </aside>
    </div>
  );
}
