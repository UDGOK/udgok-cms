/**
 * Public estimate layout. No auth — anyone with the
 * share token can view. The layout sets noindex so
 * search engines don't index client-specific estimates
 * that leaked into URLs.
 */

export const metadata = {
  robots: { index: false, follow: false },
};

export default function PublicEstimateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-cream">{children}</div>;
}
