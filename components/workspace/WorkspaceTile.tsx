import Link from 'next/link';
import type { Role } from '@prisma/client';
import { Badge } from '@/components/ui';

interface WorkspaceTileProps {
  slug: string;
  name: string;
  role: Role;
  isActive?: boolean;
  href?: string;
}

const roleLabel: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  PM: 'Project Manager',
  ESTIMATOR: 'Estimator',
  FIELD: 'Field',
  MEMBER: 'Member',
};

export function WorkspaceTile({ slug, name, role, isActive, href }: WorkspaceTileProps) {
  const target = href ?? `/w/${slug}/dashboard`;
  return (
    <Link
      href={target}
      className={[
        'block bg-paper border-2 p-6 transition-colors relative',
        isActive ? 'border-ink' : 'border-line hover:border-ink',
      ].join(' ')}
    >
      {isActive ? (
        <span className="absolute top-3 right-3 text-[9px] font-mono font-bold tracking-[0.2em] text-orange-d">
          ACTIVE
        </span>
      ) : null}
      <div className="font-serif italic text-[40px] leading-none text-ink mb-4">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="font-serif text-lg text-ink mb-1">{name}</div>
      <div className="text-xs text-ink-50 mb-4">
        {roleLabel[role]} · {slug}
      </div>
      <div className="flex gap-3 pt-4 border-t border-line-soft text-[11px]">
        <Badge variant="navy">{roleLabel[role]}</Badge>
      </div>
    </Link>
  );
}
