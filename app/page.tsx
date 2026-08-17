import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-paper">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-sans font-black text-2xl text-ink tracking-tight">
              UDG<span className="text-orange">OK</span>
            </span>
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-ink-30 uppercase hidden sm:inline">
              Construction Management
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-ink text-xs font-extrabold uppercase tracking-[0.12em] hover:text-orange-d transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 bg-ink text-cream text-xs font-extrabold uppercase tracking-[0.12em] border-2 border-ink hover:bg-orange hover:border-orange transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-20">
        <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-6">
          {'// For builders, not for spreadsheets'}
        </div>
        <h1 className="text-display-xl mb-6 max-w-3xl">
          Run your <span className="font-serif italic text-orange-d">jobs,</span> not your software.
        </h1>
        <p className="text-lg text-ink-70 max-w-2xl mb-10">
          The construction management system for contractors who want to know which draw
          to send, who owes what, and where every project stands — without leaving the
          app.
        </p>
        <div className="flex flex-wrap gap-3 mb-16">
          <Link
            href="/sign-up"
            className="px-6 py-4 bg-orange text-paper border-2 border-orange text-sm font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d hover:border-orange-d transition-colors"
          >
            Start your first workspace →
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-4 bg-paper border-2 border-ink text-ink text-sm font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="px-6 py-4 text-ink text-sm font-extrabold uppercase tracking-[0.12em] hover:text-orange-d transition-colors"
          >
            Onboarding →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              n: '01',
              t: 'Schedule of values',
              d: 'Set the budget per line. The system tracks previous, this-draw, and balance to finish forever.',
            },
            {
              n: '02',
              t: 'Pay applications',
              d: 'One click to generate the next draw from your SOV. Send a private link, track views, get paid faster.',
            },
            {
              n: '03',
              t: 'Pipeline + jobs',
              d: 'Deals kanban to project handover. Tasks, files, notes, and a public share page for every draw.',
            },
          ].map((f) => (
            <div key={f.n} className="bg-paper border-2 border-line p-6">
              <div className="text-[10px] font-mono tracking-[0.12em] text-orange-d mb-2">{f.n}</div>
              <div className="font-extrabold text-lg mb-2">{f.t}</div>
              <p className="text-[13px] text-ink-70">{f.d}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="max-w-6xl mx-auto px-8 py-6 flex justify-between items-center text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em]">
          <span>UDGOK Construction · v1</span>
          <span>Built with UDGOK CMS</span>
        </div>
      </footer>
    </div>
  );
}
