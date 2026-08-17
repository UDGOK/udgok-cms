import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-8">
      <div className="max-w-xl text-center">
        <div className="label-eyebrow mb-4 justify-center inline-flex">{'// 404'}</div>
        <h1 className="text-display-xl mb-4">
          <span className="font-serif italic text-orange-d">Lost</span> in the plans.
        </h1>
        <p className="text-base text-ink-70 mb-8">
          We couldn&apos;t find the page you were looking for. The site, the workspace, or the
          project may have been moved or never existed in the first place.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-4 bg-ink text-cream border-2 border-ink font-extrabold uppercase tracking-[0.12em] text-sm hover:bg-orange hover:border-orange transition-colors"
        >
          Back to workspaces
        </Link>
      </div>
    </div>
  );
}
