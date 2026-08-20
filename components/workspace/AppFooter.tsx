/**
 * Mini footer for the authenticated app shell. Sits
 * at the bottom of the workspace column on every /w/*
 * page, giving short pages a visual ground and longer
 * pages a clear ending. The brand is a hand-built
 * credit line rather than a marketing footer — the
 * app is internal-team-only, so the public site
 * MarketingFooter is the wrong component.
 */
export function AppFooter() {
  return (
    <footer
      className="
        shrink-0
        hidden md:flex
        items-center justify-center
        px-6 py-2.5
        border-t border-line
        bg-paper
        text-[10px] font-mono uppercase tracking-[0.15em]
        text-ink-50
        gap-2
      "
      aria-label="Application footer"
    >
      <span className="text-ink-70">© 2026</span>
      <span aria-hidden="true">·</span>
      <span className="text-ink">Developed by YU Consultants</span>
      <span aria-hidden="true">·</span>
      <span>Texas</span>
    </footer>
  );
}
