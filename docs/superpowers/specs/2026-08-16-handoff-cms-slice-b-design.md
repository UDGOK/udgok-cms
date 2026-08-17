# Handoff CMS — Slice B Design Spec

**Date:** 2026-08-16
**Author:** Mavis
**Status:** Awaiting user sign-off
**Scope:** Auth + Workspace + Design System + CRM

---

## 0. Context & Vision

We're building a construction management CMS for internal team use, modeled after the
feature surface of handoff.ai but with the visual polish of a world-class design
studio. The product targets contractors and remodelers who care about craft and want
a tool that respects their workflow.

**Locked decisions (this session):**
- **Direction 02 — Architect Studio** — cream paper, deep navy ink, copper accent, serif headlines, hairline rules, isometric line drawings. (See published design deep-dive for full visual reference.)
- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v3 · Prisma · Postgres (Neon) · Clerk (auth) · Vercel Blob (files) · React Three Fiber + drei (3D)
- **Vertical:** Construction / remodeler, internal team only
- **Slice:** B of 3 — foundation + CRM (estimates/invoicing/projects/AI teammate come in later slices)

**Out of scope for Slice B:**
- Marketing site, public client portal, native mobile, billing, advanced AI features
- Estimates/proposals/invoicing modules (Slice C)
- Projects/tasks/scheduling (Slice D)
- File intelligence / AI teammate chat (Phase 3)

---

## 1. Architecture & Module Layout

### Tech stack (confirmed)

```
Next.js 15 (App Router) · TypeScript · Tailwind v3 · Prisma · Clerk · Neon · Vercel Blob
```

### Folder structure — feature-first

```
/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...rest]]/page.tsx
│   │   └── sign-up/[[...rest]]/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── w/[workspace]/
│   │   │   ├── page.tsx                 # dashboard
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── deals/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       └── members/page.tsx
│   │   ├── workspaces/page.tsx
│   │   └── onboarding/page.tsx
│   └── api/
│       └── webhooks/clerk/route.ts
├── components/
│   ├── ui/                              # Atelier primitives
│   ├── workspace/                       # Sidebar, Topbar, Switcher
│   ├── three/                           # Three.js scenes
│   └── features/                        # ClientList, DealCard, etc.
├── lib/
│   ├── db/                              # Prisma singleton
│   ├── auth/                            # Clerk helpers
│   ├── workspace/                       # Context, RBAC checks
│   ├── blob/                            # Vercel Blob helpers
│   ├── ai/                              # AI utilities (deal scoring)
│   └── three/                           # Scene registry
├── prisma/
│   └── schema.prisma
├── styles/
│   └── globals.css
└── tests/
```

### Server vs client strategy

Default to React Server Components. Drop to Client only when required:

| Server (default) | Client (when needed) |
|---|---|
| Pages, layouts | `useState` / `useEffect` |
| Prisma data fetching | Forms with optimistic UI |
| Static content | Three.js scenes (R3F requires DOM) |
| `<form action={serverAction}>` | Drag/drop, kanban reorder |
| Auth-gated routes | Modals, dropdowns, tooltips |

### Mutations

**Server Actions only — no REST CRUD.** Webhooks (Clerk → us) are the only `/api/*`
route. This keeps mutation logic in the same file as the form and gives free
`revalidatePath` for cache invalidation.

### 3D integration

React Three Fiber + drei. All scenes live in `components/three/`, always client
components. Loaded via `next/dynamic` with `ssr: false` + CSS shimmer placeholder.

### Design tokens

Atelier palette + type scale + spacing defined as CSS custom properties in
`styles/globals.css`, exposed to Tailwind via `tailwind.config.ts → theme.extend`.

### Deployment

`git push` to GitHub → Vercel auto-builds → preview URL per PR → main = production.
Neon provides database branch per Vercel preview (every PR gets an isolated DB).

---

## 2. Data Model (Prisma)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// =========================================
// AUTH-SYNCED FROM CLERK (via webhooks)
// Never write to these directly.
// =========================================

model Workspace {
  id        String   @id              // == Clerk organization ID
  name      String
  slug      String   @unique
  industry  String?                    // "construction", "design_consult"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members Membership[]
  clients Client[]
  deals   Deal[]
  files   File[]

  @@index([slug])
}

model User {
  id        String   @id              // == Clerk user ID
  email     String   @unique
  name      String?
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships Membership[]
  notes       Note[]
  uploads     File[]    @relation("uploader")
}

model Membership {
  id          String   @id @default(cuid())
  userId      String
  workspaceId String
  role        Role     @default(MEMBER)
  joinedAt    DateTime @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([workspaceId])
}

enum Role { OWNER  ADMIN  PM  ESTIMATOR  FIELD }

// =========================================
// CRM
// =========================================

model Client {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  email       String?
  phone       String?
  type        ClientType   @default(RESIDENTIAL)
  status      ClientStatus @default(ACTIVE)
  source      String?       // "referral", "web", "angi"
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace  Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  properties Property[]
  deals      Deal[]
  notes      Note[]
  files      File[]

  @@index([workspaceId, status])
  @@index([workspaceId, name])
}

enum ClientType   { RESIDENTIAL  COMMERCIAL  PROPERTY_MANAGER }
enum ClientStatus { ACTIVE  INACTIVE  ARCHIVED }

model Property {
  id        String  @id @default(cuid())
  clientId  String
  label     String                       // "Main house", "ADU"
  address   String
  city      String
  state     String
  zip       String
  yearBuilt Int?
  sqft      Int?
  notes     String?

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)
  deals  Deal[]

  @@index([clientId])
}

model Deal {
  id            String   @id @default(cuid())
  workspaceId   String
  clientId      String
  propertyId    String?
  title         String
  description   String?
  stage         DealStage @default(LEAD)
  value         Decimal  @db.Decimal(12, 2)
  margin        Float?                       // percent 0-100
  expectedClose DateTime?
  closedAt      DateTime?
  fitScore      Int?                         // AI-generated 0-100
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspace Workspace  @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client     @relation(fields: [clientId], references: [id])
  property  Property?  @relation(fields: [propertyId], references: [id])
  notes     Note[]
  files     File[]

  @@index([workspaceId, stage])
  @@index([workspaceId, clientId])
}

enum DealStage { LEAD  CONTACTED  ESTIMATE_SENT  NEGOTIATING  WON  LOST }

model Note {
  id        String   @id @default(cuid())
  authorId  String
  body      String
  clientId  String?
  dealId    String?
  createdAt DateTime @default(now())

  author User @relation(fields: [authorId], references: [id])
  client Client? @relation(fields: [clientId], references: [id], onDelete: Cascade)
  deal   Deal?   @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([dealId])
}

model File {
  id          String   @id @default(cuid())
  workspaceId String
  uploaderId  String
  url         String                    // Vercel Blob URL
  filename    String
  mimeType    String
  size        Int
  kind        FileKind @default(DOCUMENT)
  clientId    String?
  dealId      String?
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  uploader  User      @relation("uploader", fields: [uploaderId], references: [id])
  client    Client?   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  deal      Deal?     @relation(fields: [dealId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([clientId])
  @@index([dealId])
}

enum FileKind { DOCUMENT  PHOTO  FLOORPLAN  CONTRACT  INVOICE  OTHER }
```

**Key decisions:**
- `Workspace.id` mirrors Clerk's Organization ID (1:1, single source of truth for active workspace)
- Money is `Decimal(12,2)`, never `Float`
- Soft delete via `status` enum (clients/deals archived, not dropped)
- `Deal.fitScore` is the only AI output in Slice B
- Indexes on the two hot queries: deals-by-stage-in-workspace and clients-by-name-in-workspace

---

## 3. Auth & RBAC

Clerk owns identity. We own the role mapping. Role is stored in Clerk's
`publicMetadata.users[workspaceId].role` for fast access (no join per request), with
our `Membership` table as source of truth synced via webhook.

### Permission matrix

| Action | OWNER | ADMIN | PM | ESTIMATOR | FIELD |
|---|---|---|---|---|---|
| Workspace settings (edit) | ✅ | ✅ | view | view | view |
| Invite/remove members | ✅ | ✅ | — | — | — |
| Billing | ✅ | — | — | — | — |
| Create/edit client | ✅ | ✅ | ✅ | ✅ | — |
| Delete client | ✅ | ✅ | — | — | — |
| Create/move deal | ✅ | ✅ | ✅ | ✅ | — |
| Close deal (WON) | ✅ | ✅ | ✅ | — | — |
| Upload file | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete file | ✅ | ✅ | ✅ | own only | own only |
| See $/margin | ✅ | ✅ | ✅ | own deals | — |
| See all deals | ✅ | ✅ | ✅ | ✅ | ✅ |

### Enforcement layers

1. **Middleware** (`middleware.ts`) — auth check + active workspace resolution; redirects unauthenticated users to `/sign-in`, redirects users with no workspace to `/onboarding`
2. **Server Actions** — every mutation calls `requireRole(workspaceId, [...allowedRoles])` first; throws on insufficient
3. **Page components** — `requireRole([...])` to gate UI rendering. **Server-side enforcement only** — never trust client to hide things

### Workspace switching

Clicking a workspace tile in the switcher calls Clerk's `setActive({ organization })`.
Middleware re-runs, routes re-render under `/w/[newSlug]`. URL is the source of truth
for which workspace is active.

### Clerk webhooks

- `POST /api/webhooks/clerk` — Svix-verified
- `user.created` / `user.updated` → upsert `User`
- `organization.created` / `organization.updated` → upsert `Workspace`
- `organizationMembership.created` / `updated` / `deleted` → upsert/delete `Membership`, read role from `publicMetadata`

---

## 4. Routes & Features (Slice B)

### Public

| Route | Purpose |
|---|---|
| `/` | Landing (placeholder for v1) |
| `/sign-in/[[...rest]]` | Clerk hosted, Atelier-skinned via Clerk appearance props |
| `/sign-up/[[...rest]]` | Same |
| `/invite/[token]` | Accept workspace invite, lands in `/w/[slug]/dashboard` |

### Onboarding (no workspace yet)

| Route | Purpose |
|---|---|
| `/onboarding` | 3 steps: workspace name → industry → invite teammates (optional) |

Step 3 creates the Workspace in Clerk and our DB in a single transaction, then
redirects to `/w/[slug]/dashboard`.

### Workspace switcher

| Route | Purpose |
|---|---|
| `/workspaces` | 2-up grid of workspace tiles, "new workspace" dashed outline |

### Workspace-scoped (`/w/[workspace]/...`)

| Route | Purpose |
|---|---|
| `/dashboard` | KPI row, 12-month pipeline chart, "closing this week" deal list |
| `/clients` | List view — search by name, filter by status/type, sort by recent/value |
| `/clients/[id]` | Client detail — avatar + name + 4-cell stats + hairline timeline + properties |
| `/deals` | Pipeline kanban — drag deals between stages (LEAD → CONTACTED → ESTIMATE_SENT → NEGOTIATING → WON/LOST) |
| `/deals/[id]` | Deal detail — linked client, value, margin, fit score, notes, files |
| `/settings` | Workspace name, industry, danger zone |
| `/settings/members` | Invite, change role, remove |

### Server Actions (no REST CRUD)

| Action | Purpose |
|---|---|
| `createWorkspace` | Onboarding step 1, atomic Clerk + DB create |
| `inviteMember` / `updateMemberRole` / `removeMember` | Settings/members |
| `createClient` / `updateClient` / `archiveClient` | CRM |
| `createDeal` / `updateDeal` / `moveDealStage` / `closeDeal` | Pipeline |
| `addNote` | Client or deal timeline |
| `uploadFile` | Vercel Blob, returns URL |
| `scoreDeal` | AI scoring (called automatically by `createDeal`) |

### Webhooks

| Route | Purpose |
|---|---|
| `POST /api/webhooks/clerk` | User/org/membership sync from Clerk |

---

## 5. Three.js Moments

**Rule:** 3D earns its place when it adds information or delight, not as decoration.

| Location | Scene | Purpose |
|---|---|---|
| Login hero | Rotating wireframe building (slow ambient) | Brand tone, first impression |
| Workspace switcher empty state | Unfinished scaffolding scene | Invites first workspace creation |
| Dashboard top-right corner | 80×80 isometric building, mouse-parallax | Subtle delight, doesn't compete with data |
| Client detail (when address) | Isometric property line drawing with address label | Pure delight, brand-consistent |

**NOT 3D:** tables, lists, forms, charts, modals, dropdowns. Charts are hand-rolled SVG or Chart.js.

### Performance budget

- Each scene < 100KB JS, < 2s TTI
- Respect `prefers-reduced-motion` → static fallback
- `<Canvas frameloop="demand">` — render only when interacting
- Lazy-load via `next/dynamic` with `ssr: false`
- CSS shimmer placeholder during load

---

## 6. AI Touchpoints in Slice B

Defer everything heavy (file intelligence, AI teammate, transcription, chat) to Phase 3.

**One AI feature for Slice B: Deal fit scoring.**

- Trigger: on `createDeal` server action
- Provider: `@vercel/ai` SDK, default Anthropic Claude Haiku (cost), configurable via env
- Inputs: deal value, source, client history (returning vs new), workspace stage velocity
- Output: 0-100 integer, validated with zod, stored on `Deal.fitScore`
- UI: Atelier badge "FIT 87" on deal cards
- Sort: pipeline kanban sorts by `fitScore DESC` by default (toggle in settings to revert to `updatedAt DESC`)
- Execution: async fire-and-forget, doesn't block user. UI shows score as "—" until it arrives (≤ 3s typical)
- Failure: silent — if AI call fails, deal is created without score, retry endpoint available

---

## 7. Errors, Loading, Empty States, Offline

### Errors

- **Route-level:** error boundary at each segment → Atelier-styled card "Something went wrong" + retry + `mailto:support@atelier.app`
- **Form-level:** inline below each field, Atelier typography
- **Auth-level:** Clerk's built-in errors, styled via Clerk appearance props to match Atelier
- **Network:** top-right toast, copper retry button, 200ms slide-in animation

### Loading

- **Routes:** streaming RSC + skeleton UI matching final layout (KPI cards show hairline outlines, kanban columns show shimmer placeholders)
- **Mutations:** optimistic UI for creates/updates/deletes, inline spinner on the action button
- **3D scenes:** shimmer placeholder while Three.js loads
- **First paint target:** < 200ms perceived (everything above fold is server-rendered)

### Empty states

Every list has a designed empty state with:
- Small isometric line drawing (brand-consistent)
- One-sentence prompt
- Primary CTA

Examples:
- "No clients yet. Add your first one and start tracking relationships."
- "No deals in this stage yet. Move a deal here from another column."
- "No notes yet. Drop a quick thought about this client."

### Offline (v1 lite)

- Banner: "You're offline — changes will sync when you reconnect"
- Writes queue in IndexedDB, retry on reconnect
- Full offline sync (Outbox pattern, conflict resolution) is deferred to Slice C where field workers actually live

---

## 8. Testing Approach

Pragmatic, not paranoid. Test what breaks.

### Unit (Vitest)

- Every server action: happy path + permission denied
- RBAC helpers: `requireRole`, `canEditDeal`, `canViewMargin`
- zod schemas (form validation)
- Formatters (money, dates, addresses)
- Anything with branching logic

### Integration (Vitest + MSW)

- Clerk webhook handlers: `user.created` → DB upsert, etc.
- Server actions against a throwaway Neon branch
- File upload flow with mocked Vercel Blob
- AI deal scoring (mocked provider)

### E2E (Playwright)

Critical user paths (against Vercel preview URLs):

1. **Sign up → create workspace → land on dashboard** (golden path)
2. **Add client → create deal → drag through pipeline to WON**
3. **Invite member → accept invite → see same workspace**
4. **Workspace switcher → switch between two orgs**

Visual regression on: login, workspace switcher, dashboard, client detail, deal detail.

### CI

PR → unit + integration → E2E against preview URL → block merge on any failure. No coverage threshold (vanity metric for v1).

### Don't test

- Pure presentational components (snapshot tests are noise)
- Three.js scenes (visual-only, manual QA)
- Clerk's hosted UI (their problem)
- Tailwind class output (Tailwind's problem)

---

## 9. Open questions

None at this time. All design decisions resolved in this session.

## 10. Next step after sign-off

Invoke `superpowers:writing-plans` to break this spec into a buildable task list,
then begin implementation in a fresh Next.js project in `/workspace`.
