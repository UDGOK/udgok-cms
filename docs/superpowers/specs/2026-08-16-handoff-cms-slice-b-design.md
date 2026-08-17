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
- **Pay Apps (full workflow)** — schedule of values per project, auto-numbered draws, editable this-draw amounts, cumulative tracking per division/subcategory, send-to-customer with email + signed share link, view tracking (who viewed, when, how often)
- **PDF generation** — pay app template, project summary, client summary, deal summary, tasks summary
- **Email service** — Resend for transactional pay app sends + view notifications

**v2 — next 4-6 weeks (separate spec):**
- AIA G702/G703 compliance refinements (retainage rules, lien waivers, sworn statements, conditional/unconditional waivers)
- Subcontractor management (sub list, contacts, sub needs, sub tasks, sub insurance tracking)
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
  divisions ProjectDivision[]
  payApps   PayApp[]

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
// PAY APPS (full workflow in v1)
// =========================================

model ProjectDivision {
  id                 String   @id @default(cuid())
  projectId          String
  code               String                       // "DIV 01", "DIV 26", "DIV 09 30 00"
  trade              String                       // "General Conditions", "Electrical", "Tile"
  subcontractorName  String?                      // "BM Quality", "Louis & Company"
  budget             Decimal  @db.Decimal(12, 2)
  sortOrder          Int      @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  payAppLines PayAppDivision[]

  @@index([projectId, sortOrder])
}

model PayApp {
  id            String      @id @default(cuid())
  projectId     String
  drawNumber    Int                            // 1, 2, 3, ...
  periodStart   DateTime
  periodEnd     DateTime
  status        PayAppStatus @default(DRAFT)
  totalContract Decimal     @db.Decimal(12, 2)  // snapshot
  totalPrevious Decimal     @db.Decimal(12, 2)  // sum of all prior draws
  totalThisDraw Decimal     @db.Decimal(12, 2)
  totalBalance  Decimal     @db.Decimal(12, 2)  // totalContract - totalPrevious - totalThisDraw
  notes         String?
  pdfUrl        String?                         // Vercel Blob URL of generated PDF
  shareToken    String      @unique            // signed token for public share link
  sentAt        DateTime?
  sentToEmail   String?
  acknowledgedAt DateTime?                     // when customer clicks "Acknowledge receipt"
  firstViewedAt DateTime?
  viewCount     Int         @default(0)
  createdById   String
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  project    Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  divisions  PayAppDivision[]
  viewEvents PayAppViewEvent[]

  @@unique([projectId, drawNumber])
  @@index([projectId, status])
  @@index([shareToken])
}

enum PayAppStatus { DRAFT  SENT  VIEWED  ACKNOWLEDGED  PAID  DISPUTED  SUPERSEDED }

model PayAppDivision {
  id                String   @id @default(cuid())
  payAppId          String
  projectDivisionId String
  previousAmount    Decimal  @db.Decimal(12, 2)   // snapshot: sum of all prior draws for this division
  thisDrawAmount    Decimal  @db.Decimal(12, 2)   // user-editable
  balanceAfter      Decimal  @db.Decimal(12, 2)   // snapshot: budget - previous - thisDraw
  sortOrder         Int

  payApp          PayApp          @relation(fields: [payAppId], references: [id], onDelete: Cascade)
  projectDivision ProjectDivision @relation(fields: [projectDivisionId], references: [id])

  @@index([payAppId])
}

model PayAppViewEvent {
  id          String   @id @default(cuid())
  payAppId    String
  viewedAt    DateTime @default(now())
  viewerEmail String?     // parsed from ?email= param if present
  ipAddress   String?
  userAgent   String?
  referrer    String?

  payApp PayApp @relation(fields: [payAppId], references: [id], onDelete: Cascade)

  @@index([payAppId, viewedAt])
}

// =========================================
// v2 STUBS (do not implement in v1, just reserved names)
// model Subcontractor { ... }       // proper sub management w/ contacts, insurance, etc.
// model LienWaiver   { ... }       // conditional/unconditional waiver tracking
// =========================================
```

**Key decisions:**
- `Workspace.id` mirrors Clerk's Organization ID
- Money is `Decimal(12,2)`, never `Float`
- `Task` is a polymorphic-ish link — can attach to Client OR Deal OR Project (any combination; nullable foreign keys)
- `Task.startDate` / `endDate` power the Gantt
- `File.category` is free text in v1 (brochures, marketing, floorplans, etc.) — keeps schema simple, can be enum in v2
- **Pay App cumulative magic:** when a new draw is generated, the server queries all prior `PayAppDivision` rows for the same `projectDivisionId` and sums `thisDrawAmount` to fill the `previousAmount` snapshot. Users can never get the cumulative math wrong.
- **`PayApp.shareToken` is the only public attack surface** — a long random token (32+ bytes), no auth required to view, but the page is read-only and logs every view. Tokens can be regenerated (which invalidates the old link).
- **`PayAppViewEvent` is append-only** — every page load = one row. We never aggregate on read; we aggregate on the fly when displaying "view count" and "first viewed". This gives us the full audit trail for free.
- v2 modules (sub management, lien waivers) are still stubbed.

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
| `/projects/[id]/financials` | Financial summary (contract value, drawn, balance, by-division breakdown) | ✅ |
| `/projects/[id]/schedule` | Gantt chart of project tasks | ✅ |
| `/projects/[id]/payapps` | Pay Apps list (all draws for project, status, views) | ✅ |
| `/projects/[id]/payapps/new` | Generate next draw (auto-fills previous amounts per division) | — |
| `/projects/[id]/payapps/[drawId]` | Pay App detail (edit this-draw amounts, send to customer, view tracking) | ✅ |
| `/projects/[id]/files` | Project-scoped files | — |
| `/projects/[id]/team` | Project members + their roles | — |
| `/share/payapp/[token]` | **Public read-only customer view** (no auth, logs view event) | ✅ |
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
| `createProjectDivision` / `updateProjectDivision` / `deleteProjectDivision` / `reorderDivisions` | Schedule of Values |
| `createPayApp` | Auto-generate next draw (cumulative math pre-filled) |
| `updatePayAppLine` / `updatePayAppNotes` | Edit this-draw amounts per division |
| `sendPayAppToCustomer` | Generate PDF, create share token, send Resend email, set status=SENT |
| `resendPayApp` | Re-send email with existing share link |
| `regenerateShareToken` | Invalidate old link, create new one (security) |
| `markPayAppPaid` | Mark draw as PAID, optionally record payment reference |
| `acknowledgePayApp` | Customer-facing action (called from public page) |
| `logPayAppView` | Called from public page on mount |

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

## 8.5. Email Service & Customer Share (Resend + View Tracking)

The pay app workflow needs three things the rest of the app doesn't: a transactional email service, a public share URL, and view tracking. All three are scoped narrowly to the pay app feature — we don't need email anywhere else in v1.

### Provider

**Resend** (https://resend.com) — the best DX in the transactional email space, generous free tier (100 emails/day, 3,000/month), React Email templates, great deliverability. Configurable via:
- `RESEND_API_KEY` (required)
- `RESEND_FROM_ADDRESS` (e.g. `payapps@udgok.app`, verified domain required)

### Email template (React Email)

`/components/emails/PayAppEmail.tsx`:
- Renders with the same UDGOK Bold styling as the app
- Subject: `Draw No. {N} — {Project Name} · ${amount} due {date}`
- Body: short message (user-provided or template default) + the secure link CTA
- "View secure pay application" button → opens the share URL
- Footer: "Sent via UDGOK CMS · unsubscribe / preferences"

### Public share URL

**Format:** `https://atelier.app/share/payapp/{token}`

- `token` = `crypto.randomBytes(32).toString('base64url')` — 256 bits of entropy, unguessable
- Stored as `PayApp.shareToken` (unique index)
- No auth required to view
- The page is **read-only** — no editing, no JS that mutates state (except the view-logging beacon)
- Token expiration: **90 days from creation**, configurable per workspace
- Workspace owners can **regenerate** the token (which invalidates the old link) via the pay app detail page

### Public page behavior

- Server Component renders the pay app (same UDGOK Bold template, no app chrome)
- On mount, a tiny client-side `<img>` beacon fires `POST /api/payapp/{token}/view` with the page metadata
- The endpoint:
  - Inserts a `PayAppViewEvent` row (id, payAppId, viewedAt, viewerEmail, ipAddress, userAgent, referrer)
  - If `firstViewedAt IS NULL` on the pay app, sets it + bumps `viewCount` to 1
  - Else, just bumps `viewCount` by 1
  - Returns 204 No Content (the beacon doesn't care about the response)
- The email optional `?email=` query param (e.g. when the link is `?email=james@...` from the email body) is parsed and recorded as `viewerEmail` — that's how we identify "james@coldstone-tulsa.com viewed it"

### View tracking UI (in our app)

On the pay app detail page, when status is `SENT` or later:
- **First viewed** timestamp + relative time ("2h ago")
- **Total views** count
- **Unique viewers** count (distinct viewerEmail)
- **View log:** timestamp · viewer (email or "Unknown") · device (parsed from userAgent) · IP (for audit, not displayed by default)
- Resend button: re-sends the email
- Copy share link button: puts the URL on the clipboard

### What we don't do in v1

- No email open tracking pixel (Resend supports it, but it's noisy and often blocked)
- No link click heatmap
- No "customer spent 3 min on the page" analytics
- No in-app notification when customer views (could add to v2 if useful)

### What we explicitly do

- **Append-only audit trail** — every view is a row, never deleted
- **IP + user agent recorded** for security (so GC can spot suspicious views on a share link that's been forwarded)
- **Token regeneration** invalidates the old link cleanly
- **No PII in URLs** beyond the optional `?email=` (which the customer already gave us)

### Implementation files

- `lib/email/resend.ts` — Resend client wrapper
- `components/emails/PayAppEmail.tsx` — React Email template
- `app/share/payapp/[token]/page.tsx` — public read-only page
- `app/api/payapp/[token]/view/route.ts` — view-logging endpoint
- `lib/payapp/cumulative.ts` — `computePreviousAmounts(projectId, upToDraw)` helper

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
5. ~~PDF pay app v1 light~~ **RESOLVED** — moved full Pay App workflow to v1 (auto-numbered draws, schedule of values, cumulative tracking per division, send-to-customer with email + share link, view tracking). See section 8.5.
6. **Brand name in app** — currently calling the app "Atelier" internally. User's actual brand is "UDGOK Construction". Default: "UDGOK" wordmark in the app, "Atelier" as the internal design system name. User to confirm at sign-off.
7. **Email service:** Resend (proposed, see section 8.5). Free tier is 100/day, 3,000/month. Easy to swap for Postmark/SendGrid later if needed. User to confirm.
8. **Share link expiration:** 90 days from creation (proposed). User can regenerate tokens manually. Confirm.
9. **Viewer identification:** the customer's email is captured from the `?email=` query param appended to the share link in the email body. If customer forwards the link to someone else, that second viewer shows as "Unknown" (no email). Acceptable for v1?

---

## 11. Next step after sign-off

Invoke `superpowers:writing-plans` to break this spec into a buildable task list,
then begin implementation in `/workspace` with `npx create-next-app@latest`.
