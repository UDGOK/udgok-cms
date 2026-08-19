'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { PresenceProvider, usePresence, type PresenceMember } from '@/components/presence/PresenceProvider';
import { PresenceDot } from '@/components/presence/PresenceDot';
import { Button, Input, Field } from '@/components/ui';
import { createTeamAction, addTeamMemberAction, removeTeamMemberAction } from '@/lib/team/actions';
import { RelativeTime } from '@/components/ui/RelativeTime';
import type { TeamWithMembers } from '@/lib/team/queries';

const COLORS = [
  { hex: '#f06a2d', name: 'Orange' },
  { hex: '#1e2a3a', name: 'Ink' },
  { hex: '#2d8a4e', name: 'Forest' },
  { hex: '#a82b1f', name: 'Crimson' },
  { hex: '#5b3aa8', name: 'Plum' },
  { hex: '#b8762b', name: 'Bronze' },
];

const ICONS = ['👥', '🚧', '📐', '🔨', '🏗️', '⚡', '🚿', '🎨', '📊', '🛠️', '💼', '👷'];

function CreateTeamForm({ workspaceSlug, onDone }: { workspaceSlug: string; onDone: () => void }) {
  const [state, formAction] = useFormState(
    createTeamAction.bind(null, workspaceSlug),
    undefined as { error?: string; fieldErrors?: Record<string, string>; id?: string } | undefined,
  );

  return (
    <form
      action={async (fd) => {
        const result = (await formAction(fd)) as { id?: string; error?: string; fieldErrors?: Record<string, string> } | undefined;
        if (result?.id) onDone();
      }}
      className="bg-paper border-2 border-ink p-5 space-y-3"
    >
      <Field label="Team name" htmlFor="t-name" error={state?.fieldErrors?.name}>
        <Input id="t-name" name="name" required placeholder="e.g. Field Crew" autoFocus />
      </Field>
      <Field label="Description" htmlFor="t-desc">
        <Input id="t-desc" name="description" placeholder="What's this team for?" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Color" htmlFor="t-color">
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c, i) => (
              <label key={c.hex} className="cursor-pointer">
                <input type="radio" name="color" value={c.hex} defaultChecked={i === 0} className="sr-only peer" />
                <span
                  className="block w-8 h-8 border-2 border-transparent peer-checked:border-ink peer-checked:ring-2 peer-checked:ring-offset-1 peer-checked:ring-ink"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              </label>
            ))}
          </div>
        </Field>
        <Field label="Icon" htmlFor="t-icon">
          <div className="flex gap-1 flex-wrap">
            {ICONS.map((ic, i) => (
              <label key={ic} className="cursor-pointer">
                <input type="radio" name="icon" value={ic} defaultChecked={i === 0} className="sr-only peer" />
                <span className="inline-flex items-center justify-center w-8 h-8 bg-paper border-2 border-line peer-checked:border-ink peer-checked:bg-cream text-base">
                  {ic}
                </span>
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <ButtonSubmit />
      </div>
    </form>
  );
}

function ButtonSubmit() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="copper" disabled={pending}>{pending ? 'Creating…' : 'Create team'}</Button>;
}

function AddMemberInline({ workspaceSlug, teamId, allMembers }: {
  workspaceSlug: string;
  teamId: string;
  allMembers: PresenceMember[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  if (!open) return <button onClick={() => setOpen(true)} className="text-[11px] font-mono uppercase text-orange-d hover:underline">+ Add member</button>;
  const alreadyIn = new Set<string>([]);
  const candidates = allMembers.filter((m) => !alreadyIn.has(m.userId));
  return (
    <div className="flex items-center gap-2 bg-cream-2 border border-line px-2 py-1.5">
      <select
        value={picked ?? ''}
        onChange={(e) => setPicked(e.target.value)}
        className="flex-1 bg-paper border border-line px-2 py-1 text-[12px]"
      >
        <option value="">Pick a member…</option>
        {candidates.map((m) => (
          <option key={m.userId} value={m.userId}>{m.name || m.email}</option>
        ))}
      </select>
      <form
        action={async (fd) => {
          if (!picked) return;
          fd.set('userId', picked);
          await addTeamMemberAction(workspaceSlug, teamId, fd);
          setOpen(false);
          setPicked(null);
        }}
      >
        <input type="hidden" name="userId" value={picked ?? ''} />
        <Button type="submit" variant="copper" size="sm" disabled={!picked}>Add</Button>
      </form>
      <button onClick={() => setOpen(false)} className="text-ink-50 hover:text-ink text-[11px]">Cancel</button>
    </div>
  );
}

function TeamCard({ workspaceSlug, team, allMembers, isAdmin }: {
  workspaceSlug: string;
  team: TeamWithMembers;
  allMembers: PresenceMember[];
  isAdmin: boolean;
}) {
  return (
    <div className="bg-paper border-2 border-ink">
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-line" style={{ borderTopWidth: 4, borderTopColor: team.color, borderTopStyle: 'solid' }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{team.icon}</span>
          <div>
            <h3 className="font-extrabold text-[15px] leading-none">{team.name}</h3>
            {team.description ? <p className="text-[11px] text-ink-50 mt-1">{team.description}</p> : null}
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
        </span>
      </div>
      <ul className="divide-y divide-line-soft">
        {team.members.map((m) => {
          const live = allMembers.find((x) => x.userId === m.userId);
          return (
            <li key={m.userId} className="flex items-center justify-between px-4 py-2.5 hover:bg-cream-2">
              <div className="flex items-center gap-3">
                <PresenceDot status={live?.status ?? 'offline'} />
                <div>
                  <div className="font-extrabold text-[13px]">{m.name || m.email}</div>
                  <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.05em]">
                    {m.role === 'LEAD' ? 'Lead' : 'Member'} · <RelativeTime iso={live?.lastSeenAt} />
                  </div>
                </div>
              </div>
              {isAdmin ? (
                <form action={async (fd) => {
                  fd.set('userId', m.userId);
                  await removeTeamMemberAction(workspaceSlug, team.id, fd);
                }}>
                  <button className="text-[11px] text-ink-50 hover:text-error">Remove</button>
                </form>
              ) : null}
            </li>
          );
        })}
        {team.members.length === 0 ? (
          <li className="px-4 py-3 text-[12px] text-ink-50">No members yet.</li>
        ) : null}
      </ul>
      {isAdmin ? (
        <div className="px-4 py-2 border-t border-line-soft bg-cream-2">
          <AddMemberInline workspaceSlug={workspaceSlug} teamId={team.id} allMembers={allMembers} />
        </div>
      ) : null}
    </div>
  );
}

export function TeamPageClient({
  workspaceSlug,
  workspaceId,
  isAdmin,
  initialTeams,
}: {
  workspaceSlug: string;
  workspaceId: string;
  isAdmin: boolean;
  initialTeams: TeamWithMembers[];
}) {
  return (
    <PresenceProvider workspaceId={workspaceId}>
      <TeamPageContent workspaceSlug={workspaceId} _workspaceSlug={workspaceSlug} isAdmin={isAdmin} initialTeams={initialTeams} />
    </PresenceProvider>
  );
}

function TeamPageContent({
  _workspaceSlug,
  isAdmin,
  initialTeams,
}: {
  workspaceSlug: string;
  _workspaceSlug: string;
  isAdmin: boolean;
  initialTeams: TeamWithMembers[];
}) {
  const { members, isLoading } = usePresence();
  const [creating, setCreating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [teams, setTeams] = useState(initialTeams);

  const online = members.filter((m) => m.status === 'online');
  const idle = members.filter((m) => m.status === 'idle');
  const offline = members.filter((m) => m.status === 'offline');

  return (
    <div className="mt-6 space-y-8">
      {/* People section */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">People · {members.length}</h2>
          <div className="text-[11px] font-mono">
            <span className="text-success font-bold">{online.length}</span> online ·{' '}
            <span className="text-warning font-bold">{idle.length}</span> idle ·{' '}
            <span className="text-ink-30 font-bold">{offline.length}</span> offline
          </div>
        </div>

        <div className="bg-paper border-2 border-ink divide-y divide-line-soft">
          {members.length === 0 && !isLoading ? (
            <div className="p-6 text-center text-ink-50 text-sm">No team members yet. Invite one from Settings → Team.</div>
          ) : null}
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between px-5 py-3 hover:bg-cream-2">
              <div className="flex items-center gap-3">
                <PresenceDot status={m.status} />
                <div>
                  <div className="font-extrabold text-[14px]">{m.name || m.email}</div>
                  <div className="text-[10px] text-ink-50 font-mono uppercase tracking-[0.05em]">
                    {m.role} · {m.email}
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-mono text-ink-50">
                {m.status === 'online' ? (
                  <span className="text-success font-bold">● online</span>
                ) : m.status === 'idle' ? (
                  <span className="text-warning">idle <RelativeTime iso={m.lastSeenAt} /></span>
                ) : (
                  <span>last seen <RelativeTime iso={m.lastSeenAt} /></span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Teams section */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">Teams · {teams.length}</h2>
          {isAdmin && !creating ? (
            <Button variant="copper" size="sm" onClick={() => setCreating(true)}>
              + Create team
            </Button>
          ) : null}
        </div>

        {creating && isAdmin ? (
          <div className="mb-4">
            <CreateTeamForm
              workspaceSlug={_workspaceSlug}
              onDone={() => {
                setCreating(false);
                // Hard refresh to pick up the new team
                if (typeof window !== 'undefined') window.location.reload();
              }}
            />
          </div>
        ) : null}

        {teams.length === 0 ? (
          <div className="bg-paper border-2 border-dashed border-line p-8 text-center">
            <div className="text-4xl mb-2">👥</div>
            <h3 className="font-extrabold text-[15px] mb-1">No teams yet</h3>
            <p className="text-[12px] text-ink-50">
              Group people into teams like &ldquo;Field Crew&rdquo; or &ldquo;Estimators&rdquo; so you can see who&apos;s on what.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {teams.map((t) => (
              <TeamCard
                key={t.id}
                workspaceSlug={_workspaceSlug}
                team={t}
                allMembers={members}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
