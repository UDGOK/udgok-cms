import type { MetadataRoute } from 'next';

/**
 * robots.txt for cms.udgok.com.
 *
 * Strategy: the marketing site (top-level pages) is publicly
 * indexable. The app itself (/w/*) and admin (/admin/*) are
 * auth-gated and have no value in search results — block them.
 *
 * Crawlers won't even try the auth-gated routes, which keeps
 * the index clean and saves us from "preview" pages leaking
 * through a stale cache.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/help',
          '/docs',
          '/changelog',
          '/security',
          '/privacy',
          '/terms',
          '/dpa',
          '/pricing',
          '/features',
        ],
        disallow: [
          '/w/',
          '/admin/',
          '/api/',
          '/sign-in',
          '/sign-up',
          '/pay-apps/',
          // Per spec §7.3: vendor portal is token-auth. Never
          // let crawlers anywhere near it.
          '/q/',
        ],
      },
    ],
    sitemap: 'https://cms.udgok.com/sitemap.xml',
  };
}
