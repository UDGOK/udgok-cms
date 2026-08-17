export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          2
        </span>
        Dashboard
      </div>
      <h1 className="text-display-lg mb-4">
        Welcome <span className="font-serif italic text-orange-d">back.</span>
      </h1>
      <p className="text-base text-ink-70 max-w-xl">
        This is your workspace. From here you&apos;ll see KPIs, closing-this-week deals, active
        projects, and your tasks today. The rest of the screens get built in Phase 2 (CRM),
        Phase 3 (Tasks + Docs), and Phase 4 (Projects + Pay Apps).
      </p>
    </div>
  );
}
