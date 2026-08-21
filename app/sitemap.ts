import type { MetadataRoute } from 'next';

/**
 * sitemap.xml for cms.udgok.com.
 *
 * The marketing pages are static and known — list them with
 * their real lastmod. The app routes (/w/*) and admin (/admin/*)
 * are dynamic and auth-gated; we don't list them (robots.txt
 * blocks crawlers anyway). The public pay-apps page (/pay-apps/
 * [token]) is reachable via token links and not a real SEO
 * target.
 *
 * lastModified dates are hand-set to the dates the marketing
 * pages were last meaningfully updated. If you change the
 * copy of a marketing page, bump its date here too.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: 'https://cms.udgok.com',
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: 'https://cms.udgok.com/about',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://cms.udgok.com/pricing',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: 'https://cms.udgok.com/features',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://cms.udgok.com/help',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://cms.udgok.com/docs',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://cms.udgok.com/changelog',
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: 'https://cms.udgok.com/contact',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://cms.udgok.com/security',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: 'https://cms.udgok.com/privacy',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://cms.udgok.com/terms',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://cms.udgok.com/dpa',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
