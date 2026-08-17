/**
 * Authenticated app shell — passes through. The Clerk middleware
 * (middleware.ts) handles the actual auth check before any (app)/* page
 * renders, so this layout just needs to wrap children.
 *
 * Routes that don't need a workspace (the switcher at /workspaces,
 * the onboarding flow at /onboarding) live directly under (app)/ and
 * are NOT wrapped by the workspace-scoped layout.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
