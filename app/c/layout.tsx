// Layout for the public /c/* check-in routes.
//
// We override <head> via metadata to keep the /c/* pages
// out of search engine indexes — these URLs leak workspace
// and project names to anyone who can guess a token. The
// token is 24 bytes of entropy so the URL can't be brute-
// forced, but the search engines shouldn't be given a
// public map of the surface.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      nocache: true,
    },
  },
};

export default function PublicCheckInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
