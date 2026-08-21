# Full-app link audit — 2026-08-21

## Method

Built `scripts/audit-links.ts` — a static analyzer that walks every
`.tsx` / `.ts` file in the project, extracts every internal path a
user could end up on (`href=`, `redirect()`, `useRouter().push()`),
and resolves each one against:

1. The `app/` route index — 88 page routes + 31 API routes
2. Documented middleware public patterns — e.g. `/api/checkins/(.*)`
3. External URLs (http://, https://, mailto:, tel:)
4. Anchor-only links (`href="#..."`)

Then a separate live HTTP probe of every public surface.

## Static analysis result

**0 broken internal links** across 88 page routes + 31 API routes
+ 22 public middleware-allowlisted patterns.

```
$ npx tsx scripts/audit-links.ts
Indexed 88 page routes, 31 API routes.
✅ No broken internal links found.
   Scanned 88 routes across the app/ tree.
```

The static analyzer correctly:
- Resolves dynamic segments (`/w/[workspace]/projects/[id]`)
- Distinguishes route groups (`(app)`, `(auth)`) from URL segments
- Strips `[[...rest]]` (optional catch-all) when matching
- Skips template-literal interpolations (`${ws.slug}`) since those
  are validated at runtime
- Skips `revalidatePath()` (server cache invalidation, not a link)
- Skips `// comment` lines (avoids JSDoc example false positives)

## Live HTTP probe — 24 public surfaces

| Path | Status | Note |
|---|---|---|
| `/` | 200 | ✓ |
| `/pricing` | 200 | ✓ |
| `/features` | 200 | ✓ |
| `/about` | 200 | ✓ |
| `/contact` | 200 | ✓ (now also in sitemap) |
| `/docs` | 200 | ✓ |
| `/help` | 200 | ✓ |
| `/security` | 200 | ✓ |
| `/privacy` | 200 | ✓ |
| `/terms` | 200 | ✓ |
| `/dpa` | 200 | ✓ |
| `/changelog` | 200 | ✓ |
| `/changelog.xml` | 200 | ✓ valid RSS 2.0, v6.0 + v1.0 items |
| `/sitemap.xml` | 200 | ✓ 12 URLs, now includes /contact |
| `/robots.txt` | 200 | ✓ valid, blocks /w/ /admin/ /api/ |
| `/.well-known/security.txt` | 200 | ✓ contact + expires set |
| `/sign-in` | 200 | ✓ |
| `/sign-up` | 200 | ✓ |
| `/workspaces` | 307 | ✓ Clerk redirect (auth-gated) |
| `/onboarding` | 307 | ✓ Clerk redirect (auth-gated) |
| `/icon-192.svg` | 200 | ✓ |
| `/icon-512.svg` | 200 | ✓ |
| `/manifest.json` | 200 | ✓ |
| `/favicon.ico` | 200 | ✓ |

## Live HTTP probe — 10 auth-gated surfaces (all should 307)

| Path | Status |
|---|---|
| `/w` | 307 |
| `/admin` | 307 |
| `/admin/ai` | 307 |
| `/admin/email-test` | 307 |
| `/admin/leads` | 307 |
| `/admin/system` | 307 |
| `/admin/users` | 307 |
| `/admin/projects` | 307 |
| `/admin/workspaces` | 307 |
| `/onboarding/dashboard` | 307 |

## Live HTTP probe — 6 public API routes (all should NOT 500)

| Path | Status | Note |
|---|---|---|
| `/api/presence` | 401 | ✓ no auth |
| `/api/cron/send-trial-emails` | 401 | ✓ no bearer |
| `/api/cron/rfq-expire` | 401 | ✓ no bearer |
| `/api/cron/rate-limit-gc` | 401 | ✓ no bearer |
| `/api/webhooks/clerk` | 405 | ✓ GET not allowed (Svix needs POST) |
| `/api/checkins/anything` | 404 | ✓ no matching token |

## Fixes shipped

### 1. Removed dead route `/tabs-debug`

`/tabs-debug` was in the middleware `isPublicRoute` list, but
the `app/tabs-debug/` directory was empty (no `page.tsx`).
Anyone hitting that URL got a 404. Likely a leftover from very
early auth setup that was never wired up.

**Fix:** removed from `middleware.ts` `isPublicRoute` and
deleted the empty `app/tabs-debug/` directory. Now `/tabs-debug`
returns 307 to sign-in (consistent with how the rest of
unauthenticated traffic is handled).

### 2. Added `/contact` to sitemap.xml

`/contact` is linked from the marketing nav, the footer
(`/contact?source=footer`), the Pricing page Enterprise CTA
(`/contact?plan=enterprise&source=enterprise`), and the
`/admin/leads` page. But it was missing from sitemap.xml.

**Fix:** added to `app/sitemap.ts` with `priority: 0.7`,
`changeFrequency: 'monthly'`. Sitemap now has 12 URLs.

### 3. New tool: `scripts/audit-links.ts`

A self-contained static link audit script. ~250 lines, no
dependencies beyond `node:fs` / `node:path`. Indexes the `app/`
tree, walks the codebase, classifies every internal path. Run
with:

```
npx tsx scripts/audit-links.ts
```

## Things verified clean

- **No `href="#"` dead anchors** anywhere in `app/` or `components/`
- **No "coming soon" / TBD placeholders** in any .tsx
- **No hardcoded `cms.udgok.com` in email templates** — they all
  use `NEXT_PUBLIC_APP_URL` from env
- **No `/showcase` or `/tabs-debug` in sitemap.xml**
- **Marketing nav has 6 links** — `/features /pricing /help /docs
  /changelog /contact` — no `/showcase`

## Dev-only `/showcase`

The dev design-system catalog at `app/showcase/page.tsx` still
exists, but is not linked from anywhere. Returns 307 to sign-in
for unauthenticated users. Acceptable for a dev tool — leaving
as-is. If you want it gone entirely, I can delete the file
+ directory in a follow-up.

## Test count

666/666 pass (no change). Build: clean.

## Deploy

Commit `42a48ba` is live as `dpl_AK2bu1MNdufBfyKQquhwC7HatDLE`.
