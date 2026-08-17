'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { navItems } from '@/lib/nav/items';

interface SidebarProps {
  workspaceSlug: string;
  workspaceName: string;
}

export function Sidebar({ workspaceSlug, workspaceName }: SidebarProps) {
  const pathname = usePathname();
  const items = navItems.filter((i) => i.section === 'workspace');
  const settings = navItems.filter((i) => i.section === 'settings');

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="bg-ink text-cream flex flex-col w-[220px] flex-shrink-0">
      {/* Brand mark */}
      <div className="px-4 pt-6 pb-5 border-b border-cream/10">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={`/w/${workspaceSlug}/dashboard`} className="font-sans font-black text-lg tracking-tight">
            UDG<span className="text-orange">OK</span>
          </Link>
          <span className="font-mono text-[8px] font-bold tracking-[0.15em] text-cream/40 px-1.5 py-0.5 border border-cream/15">
            {workspaceSlug.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <div className="mt-2 text-[11px] font-bold truncate text-cream/80" title={workspaceName}>
          {workspaceName}
        </div>
      </div>

      {/* Primary nav */}
      <nav className="px-2.5 pt-5 pb-5 flex-1 overflow-y-auto">
        <div className="text-[9px] font-mono font-bold tracking-[0.2em] text-cream/40 uppercase px-2.5 pb-2">
          {'// Workspace'}
        </div>
        <ul>
          {items.map((item) => {
            const href = item.href(workspaceSlug);
            const active = isActive(href);
            return (
              <li key={item.label}>
                <Link
                  href={href}
                  className={[
                    'flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold border-l-[3px] transition-colors',
                    active
                      ? 'text-cream bg-orange/10 border-orange'
                      : 'text-cream/60 border-transparent hover:text-cream hover:bg-cream/5',
                  ].join(' ')}
                >
                  <span className="w-3.5 h-3.5 flex-shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="text-[9px] font-mono font-bold tracking-[0.2em] text-cream/40 uppercase px-2.5 pb-2 pt-6">
          {'// Workspace'}
        </div>
        <ul>
          {settings.map((item) => {
            const href = item.href(workspaceSlug);
            const active = isActive(href);
            return (
              <li key={item.label}>
                <Link
                  href={href}
                  className={[
                    'flex items-center gap-2.5 px-2.5 py-2 text-xs font-semibold border-l-[3px] transition-colors',
                    active
                      ? 'text-cream bg-orange/10 border-orange'
                      : 'text-cream/60 border-transparent hover:text-cream hover:bg-cream/5',
                  ].join(' ')}
                >
                  <span className="w-3.5 h-3.5 flex-shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User chip + sign out */}
      <div className="px-3 pt-3 pb-4 border-t border-cream/10 flex items-center gap-2.5">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-[30px] h-[30px]',
            },
          }}
        />
        <div className="text-[10px] font-mono text-cream/40 tracking-[0.1em] uppercase">OWNER</div>
      </div>
    </aside>
  );
}
