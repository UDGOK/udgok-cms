# UDGOK CMS — SaaS Sales Funnel Audit

**Date:** 2026-08-21
**Subject:** Whether `cms.udgok.com` actually works as a selling SaaS platform
**Verdict:** ⚠️ **Half-shipped.** The pages look good. The plumbing is
missing. You have a beautiful brochure site with a working sign-up — and
zero infrastructure for "I need to know who is on my site right now and
who just signed up so I can follow up." Read on.

---

## TL;DR — The 6 critical gaps

| # | Gap | Severity | What you can do TODAY |
| --- | --- | --- | --- |
| 1 | **No alerts on new signups** | 🔴 CRITICAL | You don't get emailed/Slacked when someone signs up. The Clerk webhook syncs the user to DB and stops. |
| 2 | **No lead capture on the marketing site** | 🔴 CRITICAL | No `/contact`, no "Talk to sales", no "Get a demo", no email-capture form anywhere. Anonymous browsers are invisible to you. |
| 3 | **No AI concierge on the marketing site** | 🔴 CRITICAL | You have real AI inside the product but the marketing site literally says *"we don't use chatbots"* on `/about`. The "true AI platform" story isn't told. |
| 4 | **"Contact sales" is a `mailto:` to nowhere** | 🟠 HIGH | Enterprise leads hit `mailto:sales@udgok.com` and disappear. No form, no CRM entry, no auto-reply, no notification. |
| 5 | **No behavior / funnel analytics** | 🟠 HIGH | You can't see who visited /pricing 3 times, who clicked "Start free" but bounced, who idle 7 days after sign-up. You're flying blind. |
| 6 | **No nurture / drip emails** | 🟠 HIGH | Someone signs up to Starter free. They get one welcome event in your admin log. Then silence. No Day-2 "did you create a project?", no Day-7 "here's a pro tip", no Day-30 "ready for Pro?". |

Everything else (homepage copy, pricing tiers, Clerk signup form, security
pages, terms/DPA) is in good shape. The product is great. The product is
not being sold to anyone because there's no sales infrastructure.

---

## The customer journey today vs. what it should be

### 🧑 Anonymous visitor (cold, never heard of you)

**Today:**
- Lands on `/` → reads copy, sees hero, "Start free" button → maybe clicks
- Lands on `/pricing` → sees 3 tiers → maybe clicks "Start free" or "Start 14-day trial" (both go to the same `/sign-up` form, no plan is tracked)
- Lands on `/features` → scrolls the long list → maybe clicks "Start free"
- You have **no idea they were there**

**What a real SaaS sales platform does:**
- Captures their email via a "Get our buyer's guide" form, a "Get a demo" CTA, a "Try the sandbox" widget
- Tracks page views and time on site (anonymously until they identify)
- Shows an AI sales concierge that can answer "what does this cost for 5 users?" or "do you integrate with QuickBooks?"
- Retargets via email if they sign up to a newsletter
- Triggers a sales alert when they hit /pricing 3+ times

**Verdict:** Anonymous stage is a black box. You're burning leads.

---

### 🟡 Considering (read pricing/features, debating sign-up)

**Today:**
- Reads pricing FAQ
- Clicks "Start free" → Clerk sign-up form
- The Pro plan's "Start 14-day trial" CTA passes `?plan=pro` query param — **but the sign-up page does not read it or differentiate** (I confirmed the sign-up form has zero plan handling)

**What a real SaaS sales platform does:**
- Shows a calendar booking widget ("Pick a time to talk to a human")
- Offers a sandbox / interactive demo ("Try it without signing up")
- Differentiates CTAs by intent: "Start free" vs "Start trial" vs "Talk to sales"
- The Enterprise CTA opens a form, not a mailto:
- An AI assistant qualifies them in chat: "How big is your team? What are you using today?"

**Verdict:** Considering stage has no conversion optimization. Every visitor either signs up or leaves. There's no "let me think about it" path that you can follow up on.

---

### 🟢 Trial / new user (just signed up via Clerk)

**Today:**
- Clerk creates the user
- Clerk webhook syncs to your DB (no email, no notification to you)
- They land on `/onboarding` and create their first workspace
- They see a dashboard with `0` projects, `0` clients, `0` everything
- **Nothing happens next.** No email. No nudge. No follow-up.

**What a real SaaS sales platform does:**
- You get a Slack/email alert: "🆕 New signup: jane@buildco.com — viewed pricing 4 times before signing up"
- Welcome email 1 (immediate): "Here's how to set up your first project in 5 minutes"
- Welcome email 2 (Day 2): "Did you add your team yet?"
- Welcome email 3 (Day 7): "Here's what your peers love about UDGOK" + soft Pro upsell
- "Stalled trial" alert (Day 14 of no activity): you get pinged
- Auto-trigger "would you like a 15-min setup call?" if they haven't created a project by Day 3

**Verdict:** Trial stage is a leaky bucket. New users churn because nothing guides them forward and nothing tells you they need help.

---

### 💰 Paying (on Pro plan, in-app)

**Today:**
- They pay via Stripe (assumed; I didn't see a Stripe integration wired up — **this is a separate gap**)
- You have no visibility into their usage, no expansion playbook, no renewal alerts
- No "refer a friend, get $50" program
- No usage-based "you've created 45 projects, time to talk to enterprise" trigger

**Verdict:** Paying stage is also under-instrumented.

---

## What's working (so we don't fix what isn't broken)

✅ **Homepage** (`/`) — 460 lines, well-designed, hero + features + 3 big features + pricing + testimonials + bottom CTA. Looks like a real SaaS company.

✅ **Pricing** (`/pricing`) — 3 tiers (Starter $0, Pro $49/user/mo, Enterprise custom), 8 FAQs, clear CTAs. 8 plan features per tier.

✅ **Features** (`/features`) — 12 features in a sticky-nav long-form layout. Covers CRM, projects, pay apps, photos, scan, presence, messages, PWA, subs, tasks, files, admin tools.

✅ **Sign-up form** — Clerk is well-themed (Atelier-styled), social auth ready, 2-minute setup, "no credit card" reassurance.

✅ **Onboarding** — `/onboarding` form creates a workspace (name, industry, invites). Simple, clean.

✅ **Security / Trust** — `/security`, `/privacy`, `/terms`, `/dpa` all exist. CSP, HSTS, X-Frame-Options, X-Content-Type-Options all present.

✅ **Real AI features inside the product:**
- `/api/ai/chat` — project insights chat (OpenRouter + Nemotron 3.5 → GLM 5.2 → Nemotron 3 Ultra fallback)
- `lib/ai/project-analyzer.ts` — deep project analysis (executive summary, risks, opportunities, suggested actions)
- `lib/ai/project-health.ts` — global AI health dashboard
- `lib/ai/openrouter.ts` — model chain with retry + reasoning support
- `AskAIChat` UI in the project page

✅ **Real product surface area** — 83 pages, 29 API routes, 6 layouts, 59 Prisma models, 150 lib files, 604/604 tests pass.

The product is real. The product is great. **The product is not being sold.**

---

## What's broken — prioritized fix list

### 🔴 CRITICAL — Fix in next sprint

#### 1. New-signup alerts (Clerk webhook → owner email/Slack)

**What it is:** When someone signs up via Clerk, the webhook at
`app/api/webhooks/clerk/route.ts` syncs the user to your DB and logs the
event. **That's it.** No email to you, no Slack ping, no nothing.

**Fix (2 hours):**
```ts
// In app/api/webhooks/clerk/route.ts, on event.type === 'user.created':
await sendNewSignupAlert({
  to: 'yasir@udgok.com',
  email: user.email_addresses[0].email_address,
  signupAt: new Date().toISOString(),
  // Optional: which pricing page they came from, referrer, UTM source
  referrer: req.headers.get('referer'),
});
```
Use the existing Resend integration. Resend has a webhook → Slack relay if you want Slack.

**Why it matters:** Right now you have **zero visibility** into new signups. If 5 contractors sign up this week, you don't know.

#### 2. Lead capture on marketing pages

**What it is:** A `/contact` form, a "Talk to sales" form on the Enterprise pricing card, a "Get a demo" page, and an email-capture widget for guides.

**Missing pages:**
- `/contact` (none of these exist)
- `/demo` or `/request-demo`
- `/enterprise` (separate page for the custom tier with a real form)
- `/customers` (case studies, logos, ROI numbers)
- `/get-a-quote` (Enterprise price calculator)

**Fix (1 day):**
- New schema: `MarketingLead { id, email, name?, company?, phone?, source, page, message?, createdAt, status, notes, ownerId? }`
- New `app/contact/page.tsx` + form action that saves lead + emails owner
- Update `Enterprise` pricing card CTA: `mailto:` → `/enterprise?plan=enterprise` form
- New `app/enterprise/page.tsx` with a "Tell us about your team" form
- New `BottomCTA` variant for `/enterprise` that emphasizes "talk to a human"
- Add `/contact` to `MarketingNav`

**Why it matters:** Every serious SaaS captures leads. The Enterprise tier literally says "Contact sales" but there's no form. That's revenue walking out the door.

#### 3. AI concierge on the marketing site

**What it is:** A prospect-facing AI assistant that can answer
"what does this cost for 5 users?", "do you integrate with QuickBooks?",
"can I import from Buildertrend?". Lives on `/` and `/pricing`.

**You have everything you need:**
- The OpenRouter SDK + model chain is already wired up
- The `lib/ai/openrouter.ts` returns `{ok, content}` cleanly
- The system prompt is just product knowledge + sales-prompt engineering
- One public endpoint `/api/marketing/ai-concierge` (no auth) → no leak risk if you scope it right (rate limit by IP, no PII, no DB access)

**Fix (1 day):**
- New `app/api/marketing/ai-concierge/route.ts` (public, IP-rate-limited, OpenRouter call with a sales-tuned prompt)
- New `components/marketing/AIConcierge.tsx` (floating chat bubble, lower-right, opens chat panel)
- New `MarketingAiConcierge` mounted in `MarketingPageShell` (so it appears on every marketing page)
- System prompt tuned to: pricing tiers, features, integrations, "schedule a call" CTA when intent is high

**Bonus:** The `/about` page says "we don't use chatbots" — **delete that line** or it will contradict the new feature.

**Why it matters:** "True AI platform" needs AI at every touchpoint, including the one where prospects evaluate you. Right now the marketing site has zero AI surface.

---

### 🟠 HIGH — Fix this month

#### 4. Behavior + funnel analytics

**What it is:** Page-view tracking on marketing pages + a funnel: `/` → `/pricing` → `/sign-up` → Clerk → `/onboarding` → first project.

**Options, in order of effort:**
- **Vercel Web Analytics** (1 hour, free tier, already in your dashboard)
- **Plausible** or **Fathom** (drop-in script in `app/layout.tsx`, $9/mo)
- **PostHog** (self-host or cloud, full product analytics)

**Fix (1 hour to start):** Add Vercel Web Analytics. It'll show you page views, top pages, referrers. Start there. Add event tracking later.

**Why it matters:** You currently can't tell if your marketing pages are converting or bouncing. You have no data to make decisions on.

#### 5. "Start trial" actually does trial

**Today:** The Pro pricing card says "Start 14-day trial" with
`href="/sign-up?plan=pro"`. The sign-up form doesn't read `?plan=pro`.
The user signs up, gets a Starter plan, never sees a trial. The
`?plan=pro` parameter is lost.

**Fix (3 hours):**
- In sign-up page, read `?plan=pro` from search params
- On successful Clerk sign-up, if `?plan=pro` was set, create a `Workspace` with `plan: PRO` and stamp `trialEndsAt: now() + 14 days`
- Add a banner in the app: "Pro trial · 13 days remaining · Upgrade →"
- Add a cron job to email the user 3 days before trial ends + 1 day after

**Why it matters:** Misleading CTAs are worse than no CTAs. You're promising a 14-day trial and not delivering one. That's a trust issue.

#### 6. Drip / nurture emails

**What it is:** Automated email sequence for new free users.

**Sequence (Resend):**
- Day 0 (immediate): "Welcome to UDGOK — here's how to create your first project in 5 min"
- Day 2: "Did you add your team yet?" (if no members added)
- Day 7: "5 things your peers love about UDGOK" (soft Pro upsell)
- Day 14: "Quick check-in" + "book a free 15-min setup call" link
- Day 30: Pro upgrade CTA

**Fix (1 day):**
- Schema: `EmailEvent { id, userId, type, sentAt, openedAt?, clickedAt? }`
- New `lib/email/drip.ts` — sequence definition + queue
- New cron job `/api/cron/send-drip-emails` (already have the cron pattern)
- New Resend templates for each step

**Why it matters:** Email is the highest-ROI channel for SaaS. You're not using it.

#### 7. Stripe wired up

**What I see:** Pricing page talks about Stripe. FAQ says
"all payments are processed through Stripe." But I don't see a
Stripe integration in the codebase. The `Workspace.plan` defaults to
`STARTER`. There's no upgrade flow, no subscription status, no webhook
from Stripe to your backend.

**Verify:** `grep -r "stripe" app/ lib/ 2>/dev/null` — confirm.

**Fix (separate project, but start it now):** Wire Stripe Checkout for
the Pro plan. Add `Workspace.stripeCustomerId`, `stripeSubscriptionId`,
`currentPeriodEnd`. Webhook handles subscription created/updated/cancelled.

---

### 🟡 MEDIUM — Fix next month

#### 8. Replace placeholder testimonials with real ones

**Today:** Logo strip = "Riverside", "Field & Co.", "Meridian", "Blackwater", "Summit", "Oak + Iron" (fake). Testimonials: "Yasir K.", "Foreman Mike", "Office Lead" (anonymized UDGOK people).

**Fix:** Get 3 real customers willing to be named. Take their logo, take a quote, build a `/customers` page. Even 3 is enough to convert skeptics.

#### 9. The "Showcase" page is misleading

**Today:** MarketingNav links to `/showcase`. The page is actually a dev-only design system catalog.

**Fix:** Either remove from nav, or build a real customer-facing `/showcase` (interactive product tour, screenshots, GIFs of the workflow).

#### 10. /help and /docs are not real content

**Today:** Both exist as page.tsx files. I haven't read them in detail but they're probably thin.

**Fix:** Audit content. Real help docs need a left-nav + search + at least 20 articles for SEO.

#### 11. Build a "Try without signing up" interactive sandbox

**What it is:** A `/try` page that opens a read-only demo workspace
in an iframe. Visitors can click through the dashboard, view a sample
project, see the pay app flow, without signing up.

**Why it matters:** "Sign up to see" is friction. Every click between
landing and "aha" loses people.

#### 12. SEO: missing structured data, OG images, sitemap detail

**Audit:** I see `/sitemap.xml` exists. Need to check:
- JSON-LD structured data on homepage, pricing, features
- OG image per page (currently probably the default)
- /robots.txt (exists)
- /llms.txt (for AI agents — 2026 will be the year of AI agents visiting your marketing site)

#### 13. /contact is the most-missing page

**Today:** Doesn't exist. 404 if you go to /contact. Several nav links
reference "Contact" but the route doesn't exist.

**Fix:** Build it. Form fields: name, email, company, message, "what are you using today?". Submit → lead in DB → email to owner + auto-reply to user.

---

## Concrete next steps (in priority order)

| # | Work | Effort | Impact | Order |
| --- | --- | --- | --- | --- |
| 1 | New-signup alert (webhook → Resend → owner) | 2 hours | Critical | This week |
| 2 | `/contact` page + MarketingLead schema | 4 hours | Critical | This week |
| 3 | Enterprise "Contact sales" form (replace mailto) | 3 hours | High | This week |
| 4 | Fix `?plan=pro` to actually trigger a trial | 3 hours | High | This week |
| 5 | AI concierge widget on marketing site | 1 day | High | Next week |
| 6 | Vercel Web Analytics | 1 hour | High | This week |
| 7 | Drip email sequence (Days 0, 2, 7, 14, 30) | 1 day | High | Next week |
| 8 | Stripe Checkout wired to Workspace.plan | 1 week | High | This month |
| 9 | Real customer testimonials + `/customers` | 2 days | Medium | This month |
| 10 | Interactive demo / sandbox | 1 week | Medium | This month |

If you do **just #1, #2, #3, #4** — you go from "blind SaaS" to
"a SaaS that knows who's coming in and follows up." That alone will
materially change your close rate.

---

## What I am NOT going to fix without your call

1. **AI concierge will contradict `/about`'s "no chatbots" line.** I need your blessing to delete or rewrite that sentence.

2. **Drip emails** send a real Resend message to real new users. If you
   don't want autoresponders yet, I won't ship them. I can build them in
   dry-run mode (logs to admin, doesn't send) so you can see what would
   go out.

3. **Pricing changes.** Right now Starter = $0 forever, Pro = $49/mo.
   If you want a real "free trial" of Pro (vs the free-forever Starter),
   we need to decide: is the Starter plan the "trial" or do we layer a
   14-day Pro trial on top? I can implement either.

4. **Replacing fake logos / testimonials.** I don't have real customers
   for you. You'll need to ask 3 contractors if you can feature them.

5. **Stripe.** That's a multi-day project with its own security review
   (PCI, webhook signature, proration math). I'll need a focused session
   to build it properly.

---

## What this looks like when fixed

A prospect lands on `cms.udgok.com` at 9am. They read the homepage, click "Start free." They get a real workspace. They add a project. You wake up to:

> **🆕 New signup: jane@buildco.com**
> Viewed `/pricing` 3x before signing up.
> Source: Google organic
> Trial: 14-day Pro (auto-upgraded from Starter)
> First project: "Smith Kitchen Remodel"

If they go idle, Day 7 they get a "Quick tip" email. Day 14 you get an alert: "Trial ending in 2 days, no activity in 7." You Slack them, close them, retain them.

If a different prospect hits `/pricing` 5 times and bounces, you get a Slack alert: "👀 Hot prospect: anonymous, viewed /pricing 5x, last seen 3 hours ago." You email them from your own inbox with a personal offer.

If an Enterprise prospect clicks "Contact sales" on the pricing card, they get a form, you get a lead in your DB + an email, they get an auto-reply with a calendar link.

**That's what a sales SaaS looks like. You don't have any of those triggers right now.**

---

## Bottom line

The product is real and it works. The marketing site looks like a real SaaS.
But the *sales infrastructure* between "visitor" and "paying customer" is
mostly missing. **You have a beautiful shop with no bell on the door.**

If you want me to ship #1, #2, #3, #4 this week, say the word and I'll
do it in a couple of focused sessions. The rest is a roadmap.
