'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "What's the financial health of this project?",
  'Which sub is the biggest bottleneck?',
  'What should I focus on today?',
  'When can I expect to be done?',
  "What's the next draw I should send?",
  'Which tasks are at risk of slipping?',
];

export function AskAIChat({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending]);

  async function send(text?: string) {
    const userMessage = (text ?? input).trim();
    if (!userMessage || pending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(next);
    setInput('');
    setError(null);
    setPending(true);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          message: userMessage,
          history: next.slice(0, -1), // send prior history
        }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${r.status})`);
      }
      const data = (await r.json()) as { answer: string };
      setMessages([...next, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Floating bubble (collapsed state)
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 w-14 h-14 bg-orange text-paper border-2 border-ink shadow-[6px_6px_0_var(--ink)] flex items-center justify-center font-black text-2xl hover:bg-orange-d hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[8px_8px_0_var(--ink)] transition-all"
        title={`Ask AI about ${projectName}`}
      >
        ✦
      </button>
    );
  }

  // Expanded chat panel
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 w-[min(92vw,420px)] h-[min(80vh,640px)] bg-paper border-2 border-ink shadow-[8px_8px_0_var(--ink)] flex flex-col animate-slide-up">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-ink bg-ink text-cream flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-orange text-paper flex items-center justify-center font-black text-sm flex-shrink-0">✦</div>
          <div className="min-w-0">
            <div className="font-extrabold text-[14px] leading-tight">Ask AI</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-cream/70 truncate">
              {projectName}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-8 h-8 -mr-1 flex items-center justify-center hover:bg-cream/10"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div>
            <div className="text-[12px] text-ink-70 mb-3">
              Ask anything about this project. The AI has the full schedule of values, pay app history, sub list, task breakdown, and dates.
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1.5">
              Suggested questions
            </div>
            <div className="space-y-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="block w-full text-left text-[12px] text-ink-70 bg-cream border border-line p-2.5 hover:border-ink hover:bg-cream-2 transition-colors"
                >
                  → {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-ink text-cream'
                    : 'bg-cream border border-line text-ink'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {pending ? (
          <div className="flex justify-start">
            <div className="bg-cream border border-line p-3 text-[12px] text-ink-50">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{ animationDelay: '120ms' }}>●</span>
                <span className="animate-pulse" style={{ animationDelay: '240ms' }}>●</span>
              </span>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="text-[11px] text-error bg-error/5 border border-error p-2">
            {error}
          </div>
        ) : null}
      </div>

      {/* Input */}
      <div className="p-3 border-t-2 border-ink bg-cream">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about this project…"
            rows={2}
            disabled={pending}
            className="flex-1 px-3 py-2 bg-paper border-2 border-ink text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-orange disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={pending || !input.trim()}
            className="px-3 py-2 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 mt-1.5">
          Press Enter to send · Shift+Enter for newline
        </div>
      </div>
    </div>
  );
}
