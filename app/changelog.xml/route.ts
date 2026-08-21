/**
 * RSS feed for the UDGOK CMS changelog.
 *
 * Returns a static XML feed at /changelog.xml. Linked from
 * /changelog so power users can subscribe in their RSS reader.
 *
 * The entries are duplicated here from app/changelog/page.tsx
 * because the page is a server component with React rendering.
 * Keeping the data in a single source of truth (lib/changelog-data)
 * would be the next refactor, but for now we duplicate to ship.
 *
 * Public route (added to middleware isPublicRoute).
 */

import { NextResponse } from 'next/server';

interface ChangelogEntry {
  date: string;
  version: string;
  tag: string;
  items: string[];
}

const entries: ChangelogEntry[] = [
  {
    date: '2026-08-21',
    version: 'v6.0',
    tag: 'Atelier',
    items: [
      'Per-vendor payment methods — ACH / card / check details per vendor',
      'Vendor portal payment loop — invoice lifecycle, mark paid, dispute',
      'Counter = new PO — preserves audit history when vendor counters',
      'Timesheet PDF — borderless, US Letter, Atelier-themed',
      'Bixby + 7 other OK city jurisdictions + per-project permit portal override',
      'Task edit modal + contact/vendor edit forms',
    ],
  },
  {
    date: '2026-08-17',
    version: 'v1.0',
    tag: 'GA',
    items: [
      'PWA support — install UDGOK as a mobile app',
      'GPS-tagged photos from the field',
      'Barcode & QR code scanner',
      'Internal messages on projects, clients, and pay apps',
      'Offline drafts — keep working without signal',
      'Bottom sheet UI for mobile forms',
      'Master admin / platform owner system',
      'System health diagnostic page',
    ],
  },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const dynamic = 'force-static';

export async function GET() {
  const site = 'https://cms.udgok.com';
  const lastBuild = entries[0]?.date ?? new Date().toISOString().slice(0, 10);

  const items = entries
    .map((e) => {
      const link = `${site}/changelog#v${e.version}`;
      const description = e.items.map((i) => `<li>${escapeXml(i)}</li>`).join('');
      return `    <item>
      <title>${escapeXml(e.version)} — ${escapeXml(e.tag)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(`udgok-${e.version}-${e.date}`)}</guid>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <description><![CDATA[<ul>${description}</ul>]]></description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>UDGOK CMS Changelog</title>
    <link>${site}/changelog</link>
    <description>What&apos;s new in UDGOK CMS — the construction management platform for builders.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>
    <atom:link href="${site}/changelog.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
