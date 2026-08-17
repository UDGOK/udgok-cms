'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, StatusBadge } from '@/components/ui';
import { NewClientModal } from './NewClientModal';

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'PROPERTY_MANAGER';
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  _count: { deals: number; projects: number };
}

interface ClientsListProps {
  workspaceSlug: string;
  clients: ClientRow[];
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function ClientsList({ workspaceSlug, clients }: ClientsListProps) {
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="bg-paper border-2 border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Client', 'Type', 'Status', 'Open deals', 'Projects', '', ''].map((h) => (
                <th
                  key={h || Math.random()}
                  className="text-left px-6 py-3.5 bg-cream-2 border-b border-line text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-50"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-ink-50">
                  No clients yet. Click <strong>+ New client</strong> to add your first.
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/w/${workspaceSlug}/clients/${c.id}`)}
                  className="cursor-pointer hover:bg-cream-2 transition-colors"
                >
                  <td className="px-6 py-4 border-b border-line-soft">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[13px] flex-shrink-0 ${
                          c.status === 'ACTIVE' ? 'bg-orange text-paper' : 'bg-ink text-cream'
                        }`}
                      >
                        {initials(c.name)}
                      </div>
                      <div>
                        <div className="font-extrabold text-ink">{c.name}</div>
                        <div className="text-[11px] text-ink-50">{c.email ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-b border-line-soft text-[13px]">
                    {c.type === 'RESIDENTIAL'
                      ? 'Residential'
                      : c.type === 'COMMERCIAL'
                        ? 'Commercial'
                        : 'Property manager'}
                  </td>
                  <td className="px-6 py-4 border-b border-line-soft">
                    <StatusBadge status={c.status.toLowerCase() as 'active' | 'inactive' | 'archived'} />
                  </td>
                  <td className="px-6 py-4 border-b border-line-soft font-extrabold">
                    {c._count.deals}
                  </td>
                  <td className="px-6 py-4 border-b border-line-soft font-extrabold">
                    {c._count.projects}
                  </td>
                  <td className="px-6 py-4 border-b border-line-soft text-right text-ink-50">
                    →
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Button variant="copper" onClick={() => setShowNew(true)}>
          + New client
        </Button>
      </div>

      {showNew ? (
        <NewClientModal workspaceSlug={workspaceSlug} onClose={() => setShowNew(false)} />
      ) : null}
    </>
  );
}
