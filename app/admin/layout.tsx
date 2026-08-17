import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { isMasterAdmin } from '@/lib/admin/permissions';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/admin');

  const master = await isMasterAdmin(userId);
  if (!master) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-black mb-2">Master admin only</h1>
          <p className="text-ink-70 text-sm">
            This area is restricted to the platform owner. If you need access, contact
            the workspace admin or email support.
          </p>
          <Link
            href="/workspaces"
            className="inline-block mt-6 px-5 py-2.5 bg-ink text-cream text-[11px] font-extrabold uppercase tracking-[0.15em]"
          >
            ← Back to my workspaces
          </Link>
        </div>
      </div>
    );
  }

  // Top bar with global stats
  const [totalUsers, totalWorkspaces, totalMessages] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.message.count(),
  ]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <header className="bg-ink text-cream border-b-2 border-orange">
        <div className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-black text-xl">
              UDG<span className="text-orange">OK</span>
              <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.15em] text-orange">
                Master
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <AdminNavLink href="/admin" label="Overview" />
              <AdminNavLink href="/admin/workspaces" label="Workspaces" />
              <AdminNavLink href="/admin/users" label="Users" />
              <AdminNavLink href="/admin/email-test" label="Email test" />
              <AdminNavLink href="/admin/system" label="System" />
            </nav>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-[0.1em]">
            <span className="hidden sm:inline text-cream/60">
              {totalUsers} users · {totalWorkspaces} ws · {totalMessages} msgs
            </span>
            <Link
              href="/workspaces"
              className="px-3 py-2 border border-cream/30 hover:bg-cream/10"
            >
              Exit admin
            </Link>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t border-cream/10 px-3 py-2 flex gap-1 overflow-x-auto">
          <AdminNavLink href="/admin" label="Overview" mobile />
          <AdminNavLink href="/admin/workspaces" label="Workspaces" mobile />
          <AdminNavLink href="/admin/users" label="Users" mobile />
          <AdminNavLink href="/admin/email-test" label="Email test" mobile />
          <AdminNavLink href="/admin/system" label="System" mobile />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">{children}</main>
    </div>
  );
}

function AdminNavLink({ href, label, mobile = false }: { href: string; label: string; mobile?: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-cream/10 ${
        mobile ? 'flex-shrink-0' : ''
      }`}
    >
      {label}
    </Link>
  );
}
