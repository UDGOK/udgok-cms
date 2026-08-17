# Handoff CMS — Slice B Design Spec (v1)

**Date:** 2026-08-16
**Author:** Mavis
**Status:** Awaiting user sign-off
**Scope:** Slice B (v1) — Auth + Workspace + Design System + CRM + Tasks + Documents + Projects (core) + PDF

---

## 0. Context & Vision

We're building a construction management CMS for **UDGOK Construction** and similar
internal teams — modeled after the feature surface of handoff.ai but with the visual
polish of a world-class design studio, **using UDGOK's actual brand as the design
fingerprint**.

The product targets contractors and remodelers who care about craft and want a tool
that respects their workflow. The visual reference is UDGOK's own pay app invoice
(UDG-2026-0148) — the industrial dark navy + construction orange + cream paper +
bold sans, the hairline rules, the uppercase small caps, the section number circles.

**Locked decisions (this session):**
- **Direction:** "UDGOK Bold" — cream paper base, deep navy ink (#1e2a3a), UDGOK orange (#f06a2d), Inter Black headlines, hairline 1px rules with strategic 2px navy rules for emphasis, uppercase letter-spaced labels, orange circle section numbers, subtle architectural line drawing watermark on detail screens
- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v3 · Prisma · Postgres (Neon) · Clerk (auth) · Vercel Blob (files) · React Three Fiber + drei (3D) · @react-pdf/renderer (PDF)
- **Vertical:** Construction / remodeler, internal team only
- **Slice:** B v1 — see scope below

### v1 / v2 / v3 scope

**v1 — this spec (ship in 8-10 weeks):**
- Auth + Workspace + Design System
- CRM (Clients, Deals, Properties, Notes)
- **Tasks** (assigned to team members, linked to clients/deals/projects)
- **Documents library** (organized per workspace/client/project, blob-backed)
- **Projects (core)** — project list, project dashboard, financial summary, Gantt scheduling, project members
- **PDF generation** — pay app template (v1 light), project summary, client summary, deal summary, tasks summary

**v2 — next 4-6 weeks (separate spec):**
- Full Pay App module (AIA G702/G703, division budgets, subcontractor backup, retainage, lien waivers)
- Subcontractor management (sub list, contacts, sub needs, sub tasks)
- Internal messages (in-app chat tied to clients/deals/projects)

**v3 — later (separate spec):**
- Telenyx SMS integration (third-party, two-way, authorized number list)
- Advanced financial features (change orders AIA G701, etc.)
- Full AI teammate + file intelligence
- Native mobile

---

## 1. Architecture & Module Layout

### Tech stack (confirmed)

```
Next.js 15 (App Router) · TypeScript · Tailwind v3 · Prisma · Clerk · Neon · Vercel Blob
React Three Fiber + drei · @react-pdf/renderer · @vercel/ai
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
│   │   │   ├── page.tsx                    # workspace overview
│   │   │   ├── dashboard/page.tsx          # main dashboard
│   │   │   ├── clients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── deals/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx           # project dashboard
│   │   │   │       ├── financials/page.tsx
│   │   │   │       ├── schedule/page.tsx  # Gantt
│   │   │   │       ├── files/page.tsx
│   │   │   │       └── team/page.tsx
│   │   │   ├── tasks/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── documents/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       └── members/page.tsx
│   │   ├── workspaces/page.tsx
│   │   └── onboarding/page.tsx
│   └── api/
│       └── webhooks/clerk/route.ts
├── components/
│   ├── ui/                  # UDGOK Bold primitives (Button, Card, Input, Badge, SectionNumber, etc.)
│   ├── workspace/           # Sidebar, Topbar, Switcher
│   ├── three/               # Three.js scenes
│   ├── pdf/                 # @react-pdf/renderer templates
│   └── features/            # ClientList, DealCard, TaskBoard, GanttChart, etc.
├── lib/
│   ├── db/                  # Prisma singleton
│   ├── auth/                # Clerk helpers
│   ├── workspace/           # Context, RBAC checks
│   ├── blob/                # Vercel Blob helpers
│   ├── ai/                  # AI utilities (deal scoring)
│   ├── pdf/                 # PDF rendering helpers
│   └── three/               # Scene registry
├── prisma/schema.prisma
├── styles/globals.css       # UDGOK Bold design tokens
└── tests/
```

### Server vs client strategy

Default to React Server Components. Drop to Client only when required:

| Server (default) | Client (when needed) |
|---|---|
| Pages, layouts | `useState` / `useEffect` |
| Prisma data fetching | Forms with optimistic UI |
| Static content | Three.js scenes (R3F requires DOM) |
| `<form action={serverAction}>` | Drag/drop, kanban reorder, Gantt drag |
| Auth-gated routes | Modals, dropdowns, tooltips |
| PDF generation (server-side) | — |

### Mutations

**Server Actions only — no REST CRUD.** Webhooks (Clerk → us) are the only `/api/*`
route. This keeps mutation logic in the same file as the form and gives free
`revalidatePath` for cache invalidation.

### 3D integration

React Three Fiber + drei. Loaded via `next/dynamic` with `ssr: false` + CSS shimmer
placeholder.

### PDF generation

`@react-pdf/renderer` (server-side). PDF templates live in `components/pdf/`. Each
major screen has a "Print / Save PDF" action that renders the same data into a
template. Uses UDGOK brand styling. All fonts self-hosted (no Google Fonts in PDF).

### Design tokens (UDGOK Bold)

Defined as CSS custom properties in `styles/globals.css`, exposed to Tailwind via
`tailwind.config.ts → theme.extend`.

```css
:root {
  /* UDGOK Bold palette */
  --ink: #1e2a3a;           /* primary dark navy/charcoal */
  --ink-2: #2a3a4e;         /* lighter navy for secondary surfaces */
  --orange: #f06a2d;        /* UDGOK accent orange */
  --orange-d: #d44a1a;      /* darker orange for hover/active */
  --orange-l: #ff8a5a;      /* lighter orange for backgrounds at 5% */
  --paper: #ffffff;         /* white card surface */
  --cream: #f5f1ea;         /* warm cream app background */
  --cream-2: #ede7d9;       /* slightly darker cream for sections */
  --line: rgba(30,42,58,0.15);   /* hairline rule */
  --line-strong: rgba(30,42,58,0.4); /* 2px rule */
  --text-mute: #7c7a72;     /* muted text */
  --success: #2d6a4f;
  --warn: #b08900;
  --error: #9d2c2c;
}
```

Typography (BOLD):

```
Display:   Inter, weight 900 (Black) — headlines, section titles
Subhead:   Inter, weight 700 (Bold)  — card titles, sub-section heads
Body:      Inter, weight 400-500
Mono:      JetBrains Mono, weight 500-700
UPPERCASE: Inter weight 700-800 + letter-spacing 0.12-0.2em — section labels
```

The brand mark "Atelier" (or "UDGOK" if user prefers) is set in DM Serif Display
Italic at the wordmark scale only. Everything else is sans.

---

## 2. Data Model (Prisma)

Full schema covering v1 modules. v2 (pay app, subs) fields stubbed as commented.

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
  industry  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members  Membership[]
  clients  Client[]
  deals    Deal[]
  projects Project[]
  tasks    Task[]
  files    File[]

  @@index([slug])
}

model User {
  id        String   @id              // == Clerk user ID
  email     String   @unique
  name      String?
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships   Membership[]
  notes         Note[]
  uploads       File[]         @relation("uploader")
  assignedTasks Task[]         @relation("assignee")
  createdTasks  Task[]         @relation("creator")
  projectMembers ProjectMember[]

  @@index([email])
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
  source      String?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace  Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  properties Property[]
  deals      Deal[]
  projects   Project[]
  tasks      Task[]
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
  label     String
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
  margin        Float?
  expectedClose DateTime?
  closedAt      DateTime?
  fitScore      Int?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client    @relation(fields: [clientId], references: [id])
  property  Property? @relation(fields: [propertyId], references: [id])
  notes     Note[]
  files     File[]
  tasks     Task[]

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
  projectId String?
  createdAt DateTime @default(now())

  author  User    @relation(fields: [authorId], references: [id])
  client  Client? @relation(fields: [clientId], references: [id], onDelete: Cascade)
  deal    Deal?   @relation(fields: [dealId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([dealId])
  @@index([projectId])
}

// =========================================
// PROJECTS (core in v1; full pay app in v2)
// =========================================

model Project {
  id            String   @id @default(cuid())
  workspaceId   String
  clientId      String?      // optional — speculative projects allowed
  name          String
  code          String?      // internal code e.g. "PRJ-2026-014"
  description   String?
  status        ProjectStatus @default(ACTIVE)
  startDate     DateTime?
  endDate       DateTime?
  contractValue Decimal?  @db.Decimal(12, 2)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspace Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client    Client?       @relation(fields: [clientId], references: [id])
  members   ProjectMember[]
  tasks     Task[]
  files     File[]
  notes     Note[]
  // v2 stub: divisions ProjectDivision[]
  // v2 stub: draws PayApp[]

  @@index([workspaceId, status])
  @@index([workspaceId, clientId])
}

enum ProjectStatus { ACTIVE  ON_HOLD  COMPLETED  CANCELLED }

model ProjectMember {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  role      String?     // free text: "PM", "Superintendent", "Field" — v1
  joinedAt  DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId])
}

// =========================================
// TASKS
// =========================================

model Task {
  id          String   @id @default(cuid())
  workspaceId String
  title       String
  description String?
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(NORMAL)
  dueDate     DateTime?
  startDate   DateTime?    // for Gantt
  endDate     DateTime?    // for Gantt
  assigneeId  String?
  createdById String
  clientId    String?
  dealId      String?
  projectId   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  assignee  User?     @relation("assignee", fields: [assigneeId], references: [id])
  createdBy User      @relation("creator", fields: [createdById], references: [id])
  client    Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  deal      Deal?     @relation(fields: [dealId], references: [id], onDelete: SetNull)
  project   Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([workspaceId, status])
  @@index([workspaceId, assigneeId])
  @@index([workspaceId, dueDate])
  @@index([workspaceId, projectId])
}

enum TaskStatus   { TODO  IN_PROGRESS  BLOCKED  DONE  CANCELLED }
enum TaskPriority { LOW  NORMAL  HIGH  URGENT }

// =========================================
// FILES / DOCUMENTS
// =========================================

model File {
  id          String   @id @default(cuid())
  workspaceId String
  uploaderId  String
  url         String
  filename    String
  mimeType    String
  size        Int
  kind        FileKind @default(DOCUMENT)
  category    String?       // v1: free text — "Brochures", "Marketing", "Floorplans", etc.
  clientId    String?
  dealId      String?
  projectId   String?
  createdAt   DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  uploader  User      @relation("uploader", fields: [uploaderId], references: [id])
  client    Client?   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  deal      Deal?     @relation(fields: [dealId], references: [id], onDelete: Cascade)
  project   Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([workspaceId, kind])
  @@index([workspaceId, category])
  @@index([clientId])
  @@index([dealId])
  @@index([projectId])
}

enum FileKind { DOCUMENT  PHOTO  FLOORPLAN  CONTRACT  INVOICE  OTHER }

// =========================================
// v2 STUBS (do not implement in v1, just reserved names)
// model ProjectDivision { ... }  // AIA divisions
// model Subcontractor   { ... }
// model PayApp          { ... }
// model PayAppLineItem  { ... }
// =========================================
```

**Key decisions:**
- `Workspace.id` mirrors Clerk's Organization ID
- Money is `Decimal(12,2)`, never `Float`
- `Task` is a polymorphic-ish link — can attach to Client OR Deal OR Project (any combination; nullable foreign keys)
- `Task.startDate` / `endDate` power the Gantt
- `File.category` is free text in v1 (brochures, marketing, floorplans, etc.) — keeps schema simple, can be enum in v2
- v2 modules (divisions, subs, pay app) are documented in comments, NOT created yet

---

## 3. Auth & RBAC

Unchanged from previous spec. Clerk owns identity, we own the role mapping.

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
| Create/assign task | ✅ | ✅ | ✅ | ✅ | — |
| Update task status (own) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update task status (others) | ✅ | ✅ | ✅ | — | — |
| Create project | ✅ | ✅ | ✅ | — | — |
| Edit project | ✅ | ✅ | ✅ | — | — |
| Delete project | ✅ | ✅ | — | — | — |
| Upload file | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete file | ✅ | ✅ | ✅ | own only | own only |
| See $/margin | ✅ | ✅ | ✅ | own deals | — |

### Enforcement layers

1. **Middleware** — auth check + active workspace resolution
2. **Server Actions** — every mutation calls `requireRole(workspaceId, [...allowed])` first
3. **Page components** — `requireRole([...])` to gate UI; **server-side enforcement only**

### Workspace switching

Clicking a workspace tile calls Clerk's `setActive({ organization })`. URL is the
source of truth: `/w/[slug]/...`.

---

## 4. Routes & Features (v1)

### Public

| Route | Purpose |
|---|---|
| `/` | Landing (placeholder) |
| `/sign-in/[[...rest]]` | Clerk hosted, UDGOK-styled |
| `/sign-up/[[...rest]]` | Same |
| `/invite/[token]` | Accept workspace invite |

### Onboarding (no workspace yet)

| Route | Purpose |
|---|---|
| `/onboarding` | 3 steps: name → industry → invite teammates (optional) |

### Workspace switcher

| Route | Purpose |
|---|---|
| `/workspaces` | 2-up grid of workspace tiles |

### Workspace-scoped (`/w/[workspace]/...`)

| Route | Purpose | PDF? |
|---|---|---|
| `/dashboard` | KPI row, pipeline, closing this week, my tasks | ✅ |
| `/clients` | List (search, filter, sort) | — |
| `/clients/[id]` | Detail (avatar, 4-cell stats, timeline, properties) | ✅ |
| `/deals` | Pipeline kanban | — |
| `/deals/[id]` | Detail (client, value, margin, fit score, notes, files, tasks) | ✅ |
| `/projects` | List (status, dates, contract value) | — |
| `/projects/[id]` | Project dashboard (overview, status, contract value, % complete, key dates) | ✅ |
| `/projects/[id]/financials` | Financial summary (contract value, invoiced, collected, by-division stub for v2) | ✅ |
| `/projects/[id]/schedule` | Gantt chart of project tasks | ✅ |
| `/projects/[id]/files` | Project-scoped files | — |
| `/projects/[id]/team` | Project members + their roles | — |
| `/tasks` | All tasks in workspace, filterable by assignee/status/due date | ✅ |
| `/tasks/[id]` | Task detail | — |
| `/documents` | Document library (workspace-wide, organized by category) | — |
| `/settings` | Workspace settings | — |
| `/settings/members` | Invite, change role, remove | — |

### Server Actions

| Action | Purpose |
|---|---|
| `createWorkspace` | Onboarding step 1 (atomic Clerk + DB) |
| `inviteMember` / `updateMemberRole` / `removeMember` | Settings |
| `createClient` / `updateClient` / `archiveClient` | CRM |
| `createDeal` / `updateDeal` / `moveDealStage` / `closeDeal` | Pipeline |
| `createProject` / `updateProject` / `archiveProject` | Projects |
| `addProjectMember` / `updateProjectMember` / `removeProjectMember` | Project team |
| `createTask` / `updateTask` / `updateTaskStatus` / `assignTask` / `deleteTask` | Tasks |
| `addNote` | Client / deal / project timeline |
| `uploadFile` / `deleteFile` / `updateFileCategory` | Documents |
| `scoreDeal` | AI scoring (auto on `createDeal`) |
| `renderPDF` | Server-side PDF generation for any printable view |

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
| Project dashboard hero | 3D schematic of the project (rotating, mouse-parallax) | Sets the project in physical space |

**NOT 3D:** tables, lists, forms, charts, modals, dropdowns, Gantt.

### Performance

- Each scene < 100KB JS, < 2s TTI
- Respect `prefers-reduced-motion` → static fallback
- `<Canvas frameloop="demand">` — render only when interacting
- Lazy-load via `next/dynamic` with `ssr: false`
- CSS shimmer placeholder during load

---

## 6. AI Touchpoints in v1

**One AI feature only in v1: Deal fit scoring.**

- Trigger: on `createDeal` server action
- Provider: `@vercel/ai` SDK, default Anthropic Claude Haiku (cost), configurable via env
- Inputs: deal value, source, client history, workspace stage velocity
- Output: 0-100 integer, validated with zod, stored on `Deal.fitScore`
- UI: UDGOK badge "FIT 87" on deal cards (orange background, white text)
- Sort: pipeline kanban sorts by `fitScore DESC` by default
- Execution: async fire-and-forget, doesn't block user; UI shows "—" until it arrives
- Failure: silent — deal created without score, retry endpoint available

AI teammate, file intelligence, transcription, SMS AI — all v3.

---

## 7. Errors, Loading, Empty States, Offline

### Errors

- **Route-level:** error boundary at each segment → UDGOK-styled card "Something went wrong" + retry + `mailto:support@udgok.com`
- **Form-level:** inline below each field, UDGOK typography
- **Auth-level:** Clerk's built-in errors, styled via Clerk appearance props to match
- **Network:** top-right toast, orange retry button, 200ms slide-in

### Loading

- **Routes:** streaming RSC + skeleton UI matching final layout
- **Mutations:** optimistic UI for creates/updates/deletes, inline spinner on the action button
- **3D scenes:** shimmer placeholder
- **First paint target:** < 200ms perceived (above fold is server-rendered)

### Empty states

Every list has a designed empty state with:
- Small isometric line drawing (brand-consistent)
- One-sentence prompt
- Primary CTA in UDGOK orange

Examples:
- "No clients yet. Add your first one and start tracking relationships."
- "No deals in this stage yet. Move a deal here from another column."
- "No tasks. Create one to start assigning work."

### Offline (v1 lite)

- Banner: "You're offline — changes will sync when you reconnect"
- Writes queue in IndexedDB, retry on reconnect
- Full offline sync deferred to v2 (where field workers actually live)

---

## 8. PDF Generation

Every route marked with ✅ in section 4 has a "Save as PDF" action (top-right of the
page). PDF generation happens **server-side** via `@react-pdf/renderer`.

### PDF templates

| Template | Source | Style |
|---|---|---|
| Pay App (v1 light) | Project financials page | UDGOK invoice format: dark navy header, UDGOK orange "DRAW No. X", division table, sub backup, certification block. **v1 light = single draw, no division tracking — full v2 in v2 spec.** |
| Project summary | Project dashboard | Single page, hero block + key metrics + status |
| Client summary | Client detail | Avatar + stats + recent timeline |
| Deal summary | Deal detail | Single page, value/margin/fit + linked client + notes |
| Tasks summary | Tasks list (filtered) | Tabular, filter preserved, assignee grouping |

### Branding

Every PDF embeds UDGOK branding:
- Logo (UDGOK wordmark) in top-left
- "UDGOK Construction" in header
- Color palette matches the app
- Page numbers in footer: "Page 1 of N"
- Generation timestamp
- Self-hosted fonts (no Google Fonts in PDFs)

### Implementation

- `lib/pdf/` — render functions per template, take typed data, return `ReadableStream`
- Server action `renderPDF(template, id)` called from a "Save as PDF" button on each page
- Files are NOT stored — generated on demand, downloaded to user's machine
- For batch/export: v2

---

## 9. Testing Approach

Pragmatic, not paranoid. Test what breaks.

### Unit (Vitest)

- Every server action: happy path + permission denied
- RBAC helpers: `requireRole`, `canEditDeal`, `canViewMargin`
- zod schemas (form validation)
- Formatters (money, dates, addresses)
- PDF renderers (snapshot of generated PDF structure)

### Integration (Vitest + MSW)

- Clerk webhook handlers
- Server actions against throwaway Neon branch
- File upload flow with mocked Vercel Blob
- AI deal scoring (mocked provider)
- Gantt date math (working days, dependencies v2)

### E2E (Playwright)

Critical user paths (against Vercel preview URLs):

1. **Sign up → create workspace → land on dashboard** (golden path)
2. **Add client → create deal → drag through pipeline to WON**
3. **Create project → add members → create tasks → view Gantt**
4. **Invite member → accept invite → see same workspace**
5. **Workspace switcher → switch between two orgs**
6. **Generate PDF from project dashboard → download succeeds**

Visual regression on: login, workspace switcher, dashboard, client detail, deal
detail, project dashboard, project Gantt, tasks board.

### CI

PR → unit + integration → E2E against preview URL → block merge on any failure.
No coverage threshold (vanity metric for v1).

### Don't test

- Pure presentational components (snapshot tests are noise)
- Three.js scenes (visual-only, manual QA)
- Clerk's hosted UI (their problem)
- Tailwind class output (Tailwind's problem)
- PDF visual output (manual QA, byte-comparison is too brittle)

---

## 10. Open questions

1. **Onboarding atomic create:** if Clerk org succeeds but DB upsert fails, we have an orphan. Plan will add a retry/DLQ pattern.
2. **AI provider env vars:** `ANTHROPIC_API_KEY` (primary), `OPENAI_API_KEY` (fallback). Confirmed in plan.
3. **`Workspace.industry` is free-text** in v1 — defer enum to v2.
4. **`ProjectMember.role` is free-text** in v1 — defer enum to v2 (or until we have a clear list of project roles from user).
5. **PDF pay app v1 light** — what's the minimum acceptable? My take: a single draw summary + division table (manually entered for v1) + cert block. Full automation of retainage / division tracking is v2.
6. **Brand name in app** — currently calling the app "Atelier" internally. User's actual brand is "UDGOK Construction". Should the app's wordmark say "Atelier" (as a design system name) or "UDGOK" (as the user's brand)? Default to "UDGOK Bold" / "UDGOK" wordmark, with the design system internally called "Atelier". User to confirm.

---

## 11. Next step after sign-off

Invoke `superpowers:writing-plans` to break this spec into a buildable task list,
then begin implementation in `/workspace` with `npx create-next-app@latest`.
