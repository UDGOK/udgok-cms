'use client';

import { useEffect, useState, useTransition, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { MessageEntityType } from '@prisma/client';
import { postMessageAction, deleteMessageAction, editMessageAction } from '@/lib/messages/actions';
import { RelativeTime } from '@/components/ui/RelativeTime';
import type { MessageWithAuthor } from '@/lib/messages/queries';

interface MessageThreadProps {
  workspaceSlug: string;
  entityType: MessageEntityType;
  entityId: string;
  initialMessages: MessageWithAuthor[];
  currentUserId: string;
  isAdmin: boolean;
  /** Optional heading. Defaults to "Discussion". */
  heading?: string;
}

function PostButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-50"
    >
      {pending ? 'Posting…' : 'Post'}
    </button>
  );
}

export function MessageThread({
  workspaceSlug,
  entityType,
  entityId,
  initialMessages,
  currentUserId,
  isAdmin,
  heading = 'Discussion',
}: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const [state, formAction] = useFormState(postMessageAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      // Optimistically add the new message
      // (the page will be revalidated on the server, so the next
      // navigation will pick up the canonical version)
      if (bodyRef.current) bodyRef.current.value = '';
      setReplyingTo(null);
    }
  }, [state]);

  function handleDelete(messageId: string) {
    if (!confirm('Delete this message?')) return;
    startTransition(async () => {
      const res = await deleteMessageAction(messageId);
      if (res.ok) {
        setMessages((m) => m.filter((msg) => msg.id !== messageId));
      }
    });
  }

  function handleEdit(messageId: string, newBody: string) {
    startTransition(async () => {
      const res = await editMessageAction(messageId, newBody);
      if (res.ok) {
        setMessages((m) =>
          m.map((msg) => (msg.id === messageId ? { ...msg, body: newBody, editedAt: new Date() } : msg)),
        );
        setEditingId(null);
      }
    });
  }

  return (
    <div className="bg-paper border-2 border-line">
      <div className="px-5 py-3 border-b border-line-soft flex items-center justify-between">
        <h2 className="text-[15px] font-extrabold uppercase tracking-[0.05em]">{heading}</h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul className="divide-y divide-line-soft">
        {messages.length === 0 ? (
          <li className="px-5 py-8 text-center text-ink-50 text-[12px]">
            No messages yet. Start the conversation below.
          </li>
        ) : null}
        {messages.map((m) => {
          const initials = (m.author.name || m.author.email).slice(0, 2).toUpperCase();
          const canModify = m.authorId === currentUserId || isAdmin;
          const isEditing = editingId === m.id;
          return (
            <li key={m.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                {m.author.avatarUrl ? (
                  <img
                    src={m.author.avatarUrl}
                    alt=""
                    className="w-9 h-9 rounded-full flex-shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-ink text-cream flex items-center justify-center text-[11px] font-black flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-extrabold text-[13px]">{m.author.name || m.author.email}</span>
                    <span className="text-[10px] font-mono text-ink-50">
                      <RelativeTime iso={m.createdAt.toISOString()} />
                    </span>
                    {m.editedAt ? (
                      <span className="text-[9px] font-mono text-ink-30 italic">edited</span>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <div className="mt-2">
                      <textarea
                        defaultValue={m.body}
                        rows={3}
                        className="w-full px-3 py-2 bg-cream-2 border border-line text-[13px] font-mono"
                        ref={(el) => {
                          if (el) el.focus();
                        }}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            const ta = (e.currentTarget.parentElement?.previousElementSibling) as HTMLTextAreaElement | null;
                            if (ta) handleEdit(m.id, ta.value);
                          }}
                          className="px-3 py-1.5 bg-ink text-cream text-[10px] font-extrabold uppercase tracking-[0.1em]"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 border border-line text-ink-50 text-[10px] font-extrabold uppercase tracking-[0.1em]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setReplyingTo(replyingTo === m.id ? null : m.id)}
                      className="font-mono uppercase tracking-[0.1em] text-orange-d hover:underline"
                    >
                      {replyingTo === m.id ? 'Cancel' : 'Reply'}
                    </button>
                    {canModify && !isEditing ? (
                      <>
                        {m.authorId === currentUserId ? (
                          <button
                            type="button"
                            onClick={() => setEditingId(m.id)}
                            className="font-mono uppercase tracking-[0.1em] text-ink-50 hover:text-ink hover:underline"
                          >
                            Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className="font-mono uppercase tracking-[0.1em] text-error hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>

                  {replyingTo === m.id ? (
                    <form
                      action={formAction}
                      className="mt-3 pl-3 border-l-2 border-orange"
                      onSubmit={() => {
                        // form state handled via the parent postMessageAction
                      }}
                    >
                      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                      <input type="hidden" name="entityType" value={entityType} />
                      <input type="hidden" name="entityId" value={entityId} />
                      <input type="hidden" name="threadId" value={m.id} />
                      <textarea
                        name="body"
                        required
                        rows={2}
                        placeholder="Write a reply…"
                        value={replyDrafts[m.id] ?? ''}
                        onChange={(e) => setReplyDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                        className="w-full px-3 py-2 bg-cream-2 border border-line text-[13px] font-mono"
                      />
                      <div className="mt-2 flex gap-2">
                        <PostButton />
                      </div>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* New top-level message */}
      <form action={formAction} className="px-5 py-4 border-t border-line bg-cream-2">
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        <input type="hidden" name="entityType" value={entityType} />
        <input type="hidden" name="entityId" value={entityId} />
        <textarea
          ref={bodyRef}
          name="body"
          required
          rows={2}
          placeholder="Post a message to the team…"
          className="w-full px-3 py-2 bg-paper border border-line text-[13px] font-mono"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
            Visible to your entire team
          </span>
          <PostButton />
        </div>
        {state?.error ? <p className="text-[11px] text-error mt-2">{state.error}</p> : null}
      </form>
    </div>
  );
}
