export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-[10px] tracking-[0.2em] text-ink-50 uppercase mb-3">
          Loading
        </div>
        <div className="flex gap-1.5 justify-center">
          <span className="w-2 h-2 bg-orange animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-orange animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-orange animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
