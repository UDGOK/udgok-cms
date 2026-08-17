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
        This is your workspace. Build out the rest of the screens from here — clients, deals,
        projects, pay apps, tasks, documents. The full UDGOK Bold design system is in the sidebar&apos;s
        dark navy chrome and the cream canvas you are looking at.
      </p>
    </div>
  );
}
