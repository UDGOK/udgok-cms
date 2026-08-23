# UDGOK CMS — Integration Map for Change Orders, Lien Waivers & Submittals/RFIs

> Survey of the existing data model, UI patterns, and risk areas
> in `/workspace`, written to inform the addition of three new
> compliance/contract features. All line numbers refer to files at
> `/workspace/...` as they exist today.

---

## 1. Data model

The Prisma schema (`/workspace/prisma/schema.prisma`, 2,656 LOC) is
the source of truth. **All money columns are `Decimal` (never
`Float`); all `id` columns are `cuid()` unless the row is auth-synced
from Clerk (`Workspace.id` and `User.id` use the Clerk ID directly).**
Most models use the `Workspace → Membership → User` shape as their
tenant boundary. Cross-tenant access is impossible because every
query filters by `workspaceId` (sometimes via the parent FK, e.g.
`project.workspaceId`).

### 1.1 Models to know

#### `Workspace` (lines 18–75)
The Clerk-org-synced tenant.
- **Fields**: `id` (== Clerk org ID), `name`, `slug` (@unique),
  `industry?`, `plan: Plan` (`STARTER`/`PRO`/`ENTERPRISE`, default
  `STARTER`), `trialEndsAt?`, timestamps.
- **Cascade**: 50+ reverse relations; all tenant data. Deleting
  the workspace cascades to almost everything.
- **Note**: `Workspace.id` is NOT a cuid — it is whatever Clerk
  sends in the webhook. This is the foreign key every other
  workspace-scoped model points at.

#### `User` (lines 77–116)
- **Fields**: `id` (== Clerk user ID), `email` (@unique), `name?`,
  `avatarUrl?`, `timezone?` (IANA), timestamps.
- **Cascade**: 25+ reverse relations. Note pattern: many
  "owner/creator" FKs use `onDelete: NoAction` so deleting a user
  never cascades through that FK. (See `Membership.user` comment
  at lines 131–137 for the rationale.)

#### `Membership` (lines 118–142)
- **Fields**: `id`, `userId`, `workspaceId`, `role: Role`, `joinedAt`,
  `lastSeenAt?`, `isOnline` (presence; updated by
  `/api/presence/heartbeat`).
- **Unique**: `@@unique([userId, workspaceId])`.
- **Cascade**: `user` is `NoAction` (deliberate), `workspace` is
  `Cascade`.
- **Enum `Role`** (lines 144–151): `OWNER | ADMIN | PM |
  ESTIMATOR | FIELD | MEMBER`.

#### `Client` (lines 180–203)
- **Fields**: `id`, `workspaceId`, `name`, `email?`, `phone?`,
  `type: ClientType` (`RESIDENTIAL`/`COMMERCIAL`/`PROPERTY_MANAGER`),
  `status: ClientStatus` (`ACTIVE`/`INACTIVE`/`ARCHIVED`),
  `source?`, timestamps.
- **Cascade**: `workspace` → `Cascade`.
- **Relations**: `properties`, `deals`, `projects`, `estimates`,
  `tasks`, `notes`, `files`.

#### `Property` (lines 217–233)
Address of a client-owned site. `clientId`, `label`, `address`,
`city`, `state`, `zip`, `yearBuilt?`, `sqft?`, `notes?`. Cascade
delete on Client. Not directly used by Projects today — projects
carry their own address.

#### `Deal` (lines 235–267)
Pipeline record. `id`, `workspaceId`, `clientId`, `propertyId?`,
`title`, `description?`, `stage: DealStage`
(`LEAD`/`CONTACTED`/`ESTIMATE_SENT`/`NEGOTIATING`/`WON`/`LOST`),
`value` (Decimal(12,2)), `margin?` (Float), `expectedClose?`,
`closedAt?`, `fitScore?`, timestamps.
- **Special relation**: `convertedProject` (`@relation("DealConversion")`
  on Project side, `@unique` on Deal side — at most one project
  per deal).

#### `Project` (lines 492–566) — the centre of gravity
- **Fields**: `id`, `workspaceId`, `clientId?`, `dealId?`
  (@unique — one project per deal), `name`, `code?`,
  `description?`, `status: ProjectStatus`
  (`PROSPECT`/`ACTIVE`/`ON_HOLD`/`COMPLETED`/`CANCELLED`),
  `startDate?`, `endDate?`, `contractValue?` (Decimal(12,2)),
  `address?`, `city?`, `state?`, `zip?`, `latitude?` (Float),
  `longitude?` (Float), `geocodedAt?`, `geocodeSource?`,
  `geocodedAddress?`, per-project permit portal override
  (`permitPortalUrl?`, `permitPortalLabel?`, `permitPortalNotes?`),
  timestamps.
- **Cascade**: `workspace` → `Cascade`, `client` → `NoAction`
  (default), `deal` → `SetNull` (deleting a deal does NOT delete
  the project).
- **Relations** (15+): `members` (ProjectMember), `tasks`, `files`,
  `notes`, `divisions`, `payApps`, `subAssignments`, `photos`,
  `photoFolders`, `permits`, `bimModels`, `bimTakeoffs`,
  `materials`, `equipment`, `siteCheckInCodes`, `checkInEvents`,
  `estimates` (scope changes), `sourceEstimate` (the estimate
  that converted to this project, @unique inverse).

#### `ProjectDivision` (lines 1066–1082) — the SOV
- **Fields**: `id`, `projectId`, `code` (CSI number), `trade`,
  `subcontractorName?` (free-text), `budget` (Decimal(12,2)),
  `sortOrder`, timestamps.
- **Cascade**: `project` → `Cascade`.
- **Relations**: `payAppLines` (PayAppDivision[]), `subLinks`
  (ProjectDivisionAssignment[]).

#### `PayApp` (lines 1084–1125)
- **Fields**: `id`, `projectId`, `drawNumber` (per-project
  monotonic), `periodStart`, `periodEnd`, `status: PayAppStatus`
  (`DRAFT`/`SENT`/`VIEWED`/`ACKNOWLEDGED`/`PAID`/`DISPUTED`/`SUPERSEDED`),
  `totalContract` (Decimal(12,2)), `totalPrevious`,
  `totalThisDraw`, `totalBalance`, `notes?`, `pdfUrl?`,
  `shareToken` (@unique), `sentAt?`, `sentToEmail?`,
  `acknowledgedAt?`, `acknowledgedByEmail?`, `acknowledgedByName?`,
  `firstViewedAt?`, `paidAt?`, `paidById?`, `disputedAt?`,
  `disputedReason?`, `viewCount` (default 0), `createdById`,
  timestamps.
- **Unique**: `@@unique([projectId, drawNumber])`.
- **Cascade**: `project` → `Cascade`. Note: `payApps` already
  model a DRAFT→SENT→VIEWED→…→PAID lifecycle; this is the closest
  existing analogue for change orders.

#### `PayAppDivision` (lines 1137–1150) — the SOV line on a draw
- **Fields**: `id`, `payAppId`, `projectDivisionId`, `previousAmount`,
  `thisDrawAmount`, `balanceAfter`, `sortOrder`.

#### `PayAppViewEvent` (lines 1152–1164) — audit row per view
- `payAppId`, `viewedAt`, `viewerEmail?`, `ipAddress?`, `userAgent?`,
  `referrer?`. Append-only — every public page hit writes one.

#### `Subcontractor` (lines 1212–1240)
- **Fields**: `id`, `workspaceId`, `name`, `primaryTrade?` (CSI
  number), `contactName?`, `contactEmail?`, `contactPhone?`,
  `address?`, `licenseNumber?`, `insuranceExpiry?`, `w9OnFile`
  (default false), `w9ScannedAt?`, `idScanned`, `idScannedAt?`,
  `hourlyRate?` (Decimal(10,2)), `notes?`, `rating?` (1–5),
  timestamps.
- **Cascade**: `workspace` → `Cascade`.

#### `ProjectSubcontractorAssignment` (lines 1242–1258)
- **Fields**: `id`, `projectId`, `subcontractorId`, `contractAmount`
  (Decimal(12,2), default 0), `status: SubcontractorStatus`
  (`PROPOSED`/`CONTRACTED`/`ACTIVE`/`COMPLETED`/`CANCELLED`),
  `notes?`, timestamps.
- **Cascade**: both → `Cascade`.
- **Relations**: `divisionLinks` (ProjectDivisionAssignment[]).

#### `ProjectDivisionAssignment` (lines 1271–1282) — sub → SOV line
- `id`, `assignmentId`, `divisionId`, `amount` (Decimal(12,2)).
- Unique `(assignmentId, divisionId)`.

#### `Task` (lines 924–957)
- **Fields**: `id`, `workspaceId`, `title`, `description?`,
  `status: TaskStatus` (`TODO`/`IN_PROGRESS`/`BLOCKED`/`DONE`/`CANCELLED`),
  `priority: TaskPriority` (`LOW`/`NORMAL`/`HIGH`/`URGENT`),
  `dueDate?`, `startDate?`, `endDate?`, `assigneeId?`,
  `createdById`, `clientId?`, `dealId?`, `projectId?`,
  `taskId?` (sub-task self-FK), timestamps.
- **Cascade**: all parent FKs use `SetNull` so deleting a
  Client/Project/Deal doesn't delete tasks; `assignee`/`createdBy`
  use `SetNull`/`NoAction` respectively.
- **Relations**: `files` (File[] via "taskFiles").

#### `File` (lines 978–1018) — the universal document model
- **Fields**: `id`, `workspaceId`, `uploaderId`, `url` (Vercel Blob
  public URL), `filename`, `mimeType`, `size` (Int),
  `kind: FileKind` (`DOCUMENT`/`PHOTO`/`FLOORPLAN`/`CONTRACT`/`INVOICE`/`OTHER`),
  `category?` (free-text — see `app/api/files/upload/route.ts`
  for the allowlist: `brochures`, `marketing`, `floorplans`,
  `contracts`, `site_photos`, `submittals`, `invoices`, `drawings`,
  `other`), plus optional FKs to `clientId`, `dealId`, `projectId`,
  `taskId`, `subcontractorId`. GPS fields (`latitude?`, `longitude?`,
  `takenAt?`).
- **Cascade**: `workspace`, `client`, `deal`, `project`, `task`,
  `subcontractor` all → `Cascade`. `uploader` is `NoAction`.
- **Note**: `kind = CONTRACT` already exists — it's a stub today
  but ready to use for CO PDFs and lien waivers. `category =
  'submittals'` already exists in the upload allowlist.

#### `Note` (lines 469–486)
- **Fields**: `id`, `authorId`, `body` (max 4000), `clientId?`,
  `dealId?`, `projectId?`, `createdAt`.
- **Cascade**: author is `NoAction`; client/deal/project are
  `Cascade`.
- **Pattern**: polymorphic via three nullable FKs. Server action
  `createClientNoteAction` / `createDealNoteAction` set the
  appropriate FK based on which entity the form was opened from
  (see `lib/notes/actions.ts`).

#### `ActivityLog` (lines 1290–1308) — the workspace audit log
- **Fields**: `id`, `workspaceId`, `actorId?` (null = system event),
  `action: string` (constrained in `lib/activity/log.ts` to:
  `created`/`updated`/`deleted`/`sent`/`viewed`/`acknowledged`/
  `paid`/`disputed`/`assigned`/`unassigned`/`invited`/`joined`/
  `left`/`imported`/`exported`/`regenerated`),
  `entityType: string` (`client`/`project`/`pay_app`/`subcontractor`/
  `task`/`team`/`workspace`/`member`/`note`/`file`/`division`/
  `comment`/`message`/`user`), `entityId`, `entityName?`
  (denormalized for display), `details?` (one-line summary),
  `metadata?` (Json), `createdAt`.
- **Cascade**: `workspace` → `Cascade`, `actor` → `SetNull`.
- **Indexes**: `(workspaceId, createdAt)`,
  `(workspaceId, entityType, entityId)`, `(actorId, createdAt)`.
- **Pattern**: every state transition calls `logActivity()` from
  `lib/activity/log.ts` (try/catch — never throws to the caller).
  This is what makes the per-entity "History" tab and the workspace
  activity page work.

#### `Message` (lines 1316–1334) — per-entity comment threads
- **Fields**: `id`, `workspaceId`, `authorId`, `body`,
  `entityType: MessageEntityType` (enum: `PROJECT`/`CLIENT`/`DEAL`/
  `SUBCONTRACTOR`/`PAY_APP`/`WORKSPACE`), `entityId`,
  `threadId?` (null = top-level; otherwise = root id), timestamps,
  `editedAt?`.
- **Cascade**: `workspace`/`author` → `Cascade`.
- **Pattern**: polymorphic (entityType, entityId) pair; the project
  page renders `<MessageThread entityType="PROJECT" entityId={id} />`.

### 1.2 Existing approval / state machines

| Model        | Enum              | Values                                                                                          | File / lines                  |
|--------------|-------------------|-------------------------------------------------------------------------------------------------|-------------------------------|
| Pay app      | `PayAppStatus`    | DRAFT → SENT → VIEWED → ACKNOWLEDGED → PAID (also: DISPUTED, SUPERSEDED)                        | `prisma/schema.prisma:1127–1135` |
| Estimate     | `EstimateStatus`  | DRAFT → SENT → VIEWED → APPROVED / REJECTED → CONVERTED                                        | `prisma/schema.prisma:410–436`  |
| RFQ          | `RfqStatus`       | DRAFT / SENT / VIEWED / RESPONDED / ACCEPTED / DECLINED / EXPIRED / CANCELLED / SUPERSEDED / REVOKED | `prisma/schema.prisma:1800–1818` |
| PO           | `PoStatus`        | DRAFT → PENDING_APPROVAL → ISSUED → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED → CLOSED; CANCELLED | `prisma/schema.prisma:1827–1836` |
| PO invoice   | `PoInvoiceStatus` | SUBMITTED → APPROVED → PAID; DISPUTED; VOID                                                    | `prisma/schema.prisma:2442–2448` |
| Timesheet    | `WeeklyTimesheetStatus` | DRAFT → SUBMITTED → APPROVED / REJECTED                                                     | `prisma/schema.prisma:1644–1663` |
| Task         | `TaskStatus`/`TaskPriority` | TODO/IN_PROGRESS/BLOCKED/DONE/CANCELLED + LOW/NORMAL/HIGH/URGENT                          | `prisma/schema.prisma:959–972`  |
| Project      | `ProjectStatus`   | PROSPECT / ACTIVE / ON_HOLD / COMPLETED / CANCELLED                                             | `prisma/schema.prisma:789–803`  |
| Sub assignment | `SubcontractorStatus` | PROPOSED / CONTRACTED / ACTIVE / COMPLETED / CANCELLED                                      | `prisma/schema.prisma:1260–1266` |

**Pattern to follow for COs / Lien Waivers / Submittals**:
every existing workflow (pay app, estimate, RFQ, PO, timesheet) has
the same shape — a status enum + a `*ViewEvent` table (or
`RfqEvent`/`PoEvent`) for append-only per-event audit. The new
features should follow this exact pattern.

### 1.3 What's *not* in the schema (gap analysis for the new features)

There is **no** model for:
- Change orders / scope changes (closest analogue: `Estimate` with
  `projectId` set, but it's not wired through a SOV delta).
- Lien waivers (conditional / unconditional / progress / final
  flavors).
- Submittals / RFIs (closest analogue: `Estimate` flow, but
  submittals traditionally have a due date and a
  reviewer/responder cycle that's distinct from estimates).
- Signatures (the only "signature" today is the
  `acknowledgedByEmail`/`acknowledgedByName` strings on
  `PayApp`/`PayAppViewEvent`-style flows; no real e-sign
  primitive).

---

## 2. UI patterns

### 2.1 Server vs client components
Pages are server components by default. A page that needs
interactivity imports a `'use client'` child for the interactive
bits. See e.g.
`app/(app)/w/[workspace]/subcontractors/page.tsx` (server, fetches
data) → `SubsListClient.tsx` (client, has `useState` for filter /
form / modal). The same pattern is used for
`/w/[w]/projects` → `TaskBoard.tsx`, `/w/[w]/timesheets` →
`TimesheetsView.tsx`, and the entire `procurement/*` tree.

### 2.2 Form actions (`useFormState` + server action with `bind`)
- Canonical example: `app/(app)/w/[workspace]/subcontractors/SubsListClient.tsx`
  lines 28–30: `useFormState(createSubcontractorAction.bind(null, workspaceSlug), undefined)`.
- Server action signature (e.g. `lib/subs/actions.ts:31–35`):
  `(workspaceSlug, _prev: State, formData: FormData) => Promise<State>`.
- `State` is a tagged union: `{ error?; fieldErrors?; ok?; id? }`.
- Roles are enforced inside the action via
  `requireRole(workspaceId, ['OWNER', 'ADMIN', 'PM', 'ESTIMATOR'])`
  (`lib/auth/require-role.ts`); field-level errors come back in
  `fieldErrors[name]`.
- Forms always `revalidatePath` after a successful mutation
  (e.g. `lib/subs/actions.ts:96`).
- The whole pattern is reused identically in `lib/pay-apps/actions.ts`,
  `lib/permits/actions.ts`, `lib/estimates/actions.ts`, `lib/notes/actions.ts`,
  `lib/projects/actions.ts`, and the procurement tree.

### 2.3 Tables / lists
**No table component is shared across the app.** Each list rolls
its own layout. Two common shapes:
- **Filterable client lists** with a search input + filter state
  (e.g. `SubsListClient.tsx` lines 136–147, `VendorsList.tsx`).
- **Kanban boards** for `Task` (5 columns by status;
  `TaskBoard.tsx` lines 58–60). Tasks do drag-to-status via
  `setTaskStatus(taskId, status)` server action.
- **Grouped server-rendered tables** for pay apps (`PayAppsTab.tsx`),
  sub assignments (`SubsTab.tsx`), permits (`PermitsTab.tsx`).

**No sortable, paginated, or server-driven tables exist.**
Everything is rendered all-at-once and filtered in memory. (The
largest list — pay app divisions — is at most ~50 rows per
project.)

### 2.4 Modals / sheets
- **Modal** for the new-sub form (`SubsListClient.tsx` lines 25–120):
  a `'use client'` component with `useState` for open/close + a
  child form that calls the action and `window.location.reload()`
  on success. No portal — the form replaces the page content
  in-place.
- **BottomSheet** component at
  `components/ui/BottomSheet.tsx` (see the export list) — used
  for mobile photo capture, but the contract is small.
- **Note**: there is NO shared `Modal` / `Dialog` component in
  `components/ui/`. New modals are written from scratch each time.
  This is the pattern CO / Lien-Waiver / Submittal detail modals
  will follow.

### 2.5 Sidebar / nav
Two distinct sidebars:
- **Workspace-level** (left rail, dark `bg-ink` background): see
  `components/workspace/Sidebar.tsx`. Items live in
  `lib/nav/items.tsx` as a flat array of
  `NavItem { href, label, icon, section? }`. Adding a new top-level
  item means adding a `NavItem` to that array — there is no
  per-role filtering.
- **Project-level** (the new vertical grouped sidebar):
  `app/(app)/w/[workspace]/projects/[id]/_components/ProjectSidebar.tsx`
  + its config in `lib/projects/sidebar-status.ts` lines 281–320.
  The config (`SIDEBAR_GROUPS`) defines `Working / Schedule /
  Money / Site` groups. Each item has `useTabParam` (drives
  `?tab=KEY`) or `subRoute` (drives `/projects/[id]/...`). The
  same config powers the mobile drawer (slide-in from the left,
  rendered via `ProjectMobileTrigger` hamburger).

### 2.6 File uploads (the `@vercel/blob/client` pattern)
**The single most important pattern to follow.** Spec is in
`/workspace/lib/blob/client-upload.ts` and
`/workspace/app/api/files/upload/route.ts`.

- **Why this matters**: the codebase had two production bugs
  (PR `a033643`, PR `b7bde87`) where files >4.5MB silently
  failed because upload routes POSTed through the Vercel function
  body. A regression test now enforces the correct pattern —
  `app/api/__tests__/upload-routes.test.ts` greps every upload
  route's source for `handleUpload` from `@vercel/blob/client` and
  fails the build if a route uses raw `req.formData()`.
- **Architecture**:
  1. Browser calls `useBlobUpload().upload(file, { workspaceId,
     category, projectId?, ... })` from
     `lib/blob/client-upload.ts`.
  2. Client gets a token from `POST /api/.../upload` (the
     `handleUpload` route).
  3. Client `PUT`s the file directly to Vercel Blob
     (`*.public.blob.vercel-storage.com`).
  4. Vercel calls back to `onUploadCompleted` on the same route
     with the tokenPayload; the route then writes the DB row.
- **CSP**: `connect-src` must include `https://vercel.com` and
  `https://*.public.blob.vercel-storage.com` (see
  `__tests__/csp.test.ts` line 130). `img-src` must include
  the same blob host (line 91). CSP lives in
  `next.config.mjs` lines 123–166.
- **Allowed categories** in the upload token
  (`app/api/files/upload/route.ts:24–27`): add `'lien_waivers'`
  and `'change_orders'` (or rename `'contracts'`) to this list
  when wiring up CO / lien-waiver uploads.

### 2.7 Email (Resend)
- Single Resend client in `lib/email/resend.ts` — exports
  `sendEmail({ to, subject, react, from?, replyTo?, text? })`.
  React Email templates (`react: ReactElement`) are the default;
  a `text` fallback should always be supplied for transactional.
- Owner alerts (signups, leads) live in `lib/email/owner-alerts.ts`
  and use plain HTML strings via `fetch('https://api.resend.com/...')`
  rather than the React helper.
- Per-feature email modules:
  - `lib/pay-apps/actions.ts:189–224` — inline HTML in
    `sendPayAppAction`. (Older; could be migrated to a React
    Email template.)
  - `lib/procurement/email.ts` — fully fledged RFQ email
    (no PII leak, big button + raw link, reply-to
    `purchasing@udgok.com`).
  - PO emails are sent inline in
    `lib/procurement/po-actions.ts:issuePoAction`.
- **Env shims** for the Resend key live in
  `next.config.mjs:24–35`. Two `from` addresses matter:
  `RESEND_FROM_ADDRESS` (pay apps, estimates) and
  `PROCUREMENT_FROM_EMAIL` (RFQs / POs).

### 2.8 PDF generation
- Library: `@react-pdf/renderer`.
- Entry point: `lib/pdf/render.tsx` — `renderProjectPdf(data,
  generatedAt) → Buffer` via `renderToBuffer(<ProjectPdf ... />)`.
- The Project Book PDF is a `Document` with one `<Page>` per
  section (`lib/pdf/components/`): `CoverPage`, `OverviewSection`,
  `SovSection`, `PayAppsSection`, `TasksSection`, `TeamSection`,
  `SubsSection`, `PermitsSection`, `PhotosSection`, `NotesSection`,
  `ActivitySection`. Each has its own header/footer from
  `components/shared/PageHeader.tsx` and `PageFooter.tsx`.
- Styles are token-driven via `lib/pdf/styles.ts` (the same UDGOK
  palette as the web — orange `#f06a2d`, ink `#1e2a3a`, etc.).
- PO PDFs use a sibling `lib/procurement/render-po-pdf.tsx` and
  `lib/pdf/PoDocument.tsx`; the route lives at
  `app/(app)/w/[workspace]/procurement/pos/[id]/pdf/route.tsx`.
- Timesheet PDFs: `lib/pdf/render-timesheet.tsx` and
  `TimesheetPdf.tsx`. The pattern (one route, one Document, one
  per-section component, one shared styles file) is what COs and
  Lien Waivers should follow.

### 2.9 3D viewers (Three.js)
Three components, all using the same shape:
- `components/3d/ProgressRing3D.tsx` (impl) +
  `components/3d/ProgressRing3DViewer.tsx` (wrapper).
- Same for `PayAppFlow3D` / `PayAppFlow3DViewer` and
  `ThreeDGantt` / `ThreeDGanttViewer`.
- The `Viewer` wrapper is `'use client'`, uses
  `next/dynamic({ ssr: false })`, and shows a loading state. The
  raw `*3D.tsx` does the actual Three.js work.
- All three use `import * as THREE from 'three'` directly; no
  `@react-three/fiber`. Light PBR materials, drag-to-orbit
  camera, no auto-rotation.
- Mounted in three places: `OverviewTab.tsx` (completion ring),
  `ScheduleTab.tsx` (3D gantt), `PayAppsTab.tsx` (pay app
  flow).

### 2.10 The Atelier (UDGOK Bold) design system
- **Palette tokens** (source of truth: `styles/globals.css:10–35`):
  - `--ink: #1e2a3a` (default ink), `--ink-2`, `--ink-70/50/30/15/08`
    (transparency ladder).
  - `--orange: #f06a2d` (primary brand), `--orange-d: #d44a1a` (hover),
    `--orange-l: #ff8a5a` (light), `--orange-bg: rgba(240,106,45,0.08)`.
  - `--paper: #ffffff`, `--cream: #f5f1ea`, `--cream-2: #ede7d9`.
  - `--success: #2d6a4f`, `--warn: #b08900`, `--error: #9d2c2c`.
- **Typography** (Tailwind extends in `tailwind.config.ts:31–35`):
  - Sans: Inter (variable, weight 900/black for headings).
  - Mono: JetBrains Mono (for eyebrow labels + codes).
  - Serif: DM Serif (used sparingly on cover pages / PDFs).
- **Component layer** (`styles/globals.css:46–63`):
  - `.label-eyebrow` — Inter 800, 12px, `letter-spacing: 0.2em`,
    color `var(--orange-d)`.
  - `.label-mono` — JetBrains Mono 700, 10px, `letter-spacing:
    0.15em`, color `var(--ink-50)`.
- **Display sizes** (`tailwind.config.ts:36–41`): `display-xl/lg/md`
  for big headings; Inter Black 900 with negative letter-spacing.
- **No card shadows.** Cards are bordered (`border-line`,
  `border-2 border-ink`) with sharp corners (`border-radius:
  0`). The 3px "chip" pills use `border-3` and `letter-spacing:
  0.12em` uppercase.

### 2.11 Badge / status pill patterns
Two flavours:
- **`<Badge variant="…">`** (`components/ui/Badge.tsx`):
  bordered, mono-9px, variants `navy`/`copper`/`success`/`warn`/
  `neutral`/`error`. Used in the lower-stakes spots.
- **`<StatusBadge status="…">`** (`components/ui/StatusBadge.tsx`):
  wraps `<Badge>` with a label-by-status map and a
  variant-by-status map. Variants: `active`/`inactive`/`archived`/
  `lead`/`draft`/`sent`/`viewed`/`acknowledged`/`paid`/`disputed`/
  `won`/`lost`/`blocked`/`todo`/`in_progress`/`done`/`cancelled`/
  `overdue`.
- The same colour-mapping convention is inlined everywhere it
  doesn't go through `<StatusBadge>`: e.g. `PayAppControls.tsx`
  has its own `PAY_APP_STATUS_COLOR` map (`orange-l` for
  VIEWED, `orange` for ACKNOWLEDGED, `success` for PAID, `error`
  for DISPUTED). **Adding a new status (e.g. `CO_APPROVED`)
  means touching this map in 3–4 places.**

### 2.12 The new vertical grouped project sidebar
Covered above (§2.5). The full config is
`lib/projects/sidebar-status.ts:281–320`. Current 13 items
across 4 groups (Working / Schedule / Money / Site):

| Group    | Items                                                            |
|----------|------------------------------------------------------------------|
| Working  | overview, ai, photos, tasks, team                                |
| Schedule | schedule, takeoff, map                                           |
| Money    | pay-apps, financials, subs, inventory                            |
| Site     | checkins, permits                                                |

- The sidebar surfaces **badges** computed in
  `getProjectSidebarStatus()` (lines 67–254) — one batched
  Prisma query for counts + dollars + warning dots.
- Adding a new tab is a 2-line config change plus a new item in
  `SIDEBAR_GROUPS` and an optional `badges[key]` entry.
- **Mobile drawer**: same config, renders as a slide-in panel
  (see `ProjectSidebar.tsx` lines 88–110, `body { overflow:
  hidden }` while open).

---

## 3. Critical files for the new features

### 3.1 Vendor / sub portal
There are **two** vendor portals today, both token-authenticated
(no Clerk):
- **RFQ portal**: `app/q/[token]/page.tsx` + `QuoteForm.tsx`.
  Pattern in spec §7.2 (see file comments lines 4–18). The vendor
  types in prices → submits → `Rfq.status` flips to `RESPONDED`.
  Old tokens on a revised RFQ show a `RevisedNotice`; expired
  tokens show `ExpiredNotice`. The route is registered in
  `middleware.ts:67` as a public route.
- **PO portal**: `app/p/[token]/page.tsx` + `PoResponseForm.tsx`
  + `PoSubmittedView.tsx` + `PoPortalExpired.tsx`. The vendor
  can `ACCEPTED`/`COUNTERED`/`REJECTED` and pick a payment
  method (`ON_FILE`/`PAYMENT_LINK`/`INVOICE_BY_EMAIL`/`CHECK`).
- **Subs don't sign in**. They use the public **check-in** portal
  `app/c/[token]/page.tsx` (QR codes); the same sub also gets
  "magic link" emails for the RFQ/PO portal.
- The link-audit public-pattern allowlist in
  `scripts/audit-links.ts:87–101` must be updated for any new
  public vendor URL.

### 3.2 Project page (9 tabs after the recent refactor)
`app/(app)/w/[workspace]/projects/[id]/page.tsx` is a **server
component** that fans out 13 parallel `Promise.all` queries then
routes by `searchParams.tab`:

| Tab key      | Rendered component                                      | URL form                       |
|--------------|---------------------------------------------------------|--------------------------------|
| `overview` (default) | `OverviewTab` + `FinancialSummary`                 | `…/projects/[id]`              |
| `ai`         | `AIBoard`                                                | `…/projects/[id]?tab=ai`       |
| `tasks`      | `TasksTab`                                               | `…/projects/[id]?tab=tasks`    |
| `team`       | `TeamTab`                                                | `…/projects/[id]?tab=team`     |
| `schedule`   | `ScheduleTab`                                            | `…/projects/[id]?tab=schedule` |
| `subs`       | `SubsTab`                                                | `…/projects/[id]?tab=subs`     |
| `permits`    | `PermitsTab`                                             | `…/projects/[id]?tab=permits`  |
| `takeoff`    | `TakeoffTab`                                             | `…/projects/[id]?tab=takeoff`  |
| `inventory`  | `InventoryTab`                                           | `…/projects/[id]?tab=inventory`|
| `map`        | `MapTab` (gated on `hasValidCoords`) or `MapLocationIssue` | `…/projects/[id]?tab=map`     |
| `pay-apps`   | **sub-route**: `app/.../pay-apps/page.tsx` (NOT a `?tab=`)  | `…/projects/[id]/pay-apps`     |

**Two patterns coexist**: most tabs are `?tab=key` query params
on the same page; `pay-apps` (and `photos`, `financials`,
`checkins` from the new sidebar) are sub-routes under
`/projects/[id]/...`. The CO / Lien Waiver / Submittal tab
should pick one of these. **Recommendation: sub-routes**, to keep
the project page manageable. The config is in
`lib/projects/sidebar-status.ts:281–320` — add a new item
(`{ key: 'change-orders', label: 'Change orders', subRoute:
'change-orders' }`) and a new `app/(app)/w/[workspace]/projects/
[id]/change-orders/page.tsx`.

### 3.3 Activity feed
- **Writer**: `lib/activity/log.ts:logActivity({ workspaceId,
  actorId?, action, entityType, entityId, entityName?, details?,
  metadata? })`. **Errors are caught silently** (line 67) so a
  logging failure never breaks the calling action.
- **Reader**: `lib/activity/queries.ts:listWorkspaceActivity(wsId,
  take=50)` + `listEntityActivity(wsId, entityType, entityId,
  take=50)`.
- **UI**: `components/activity/ActivityFeed.tsx` — single
  component used in two places:
  1. The workspace-wide activity page (`/w/[w]/...`).
  2. The per-entity "History" panel on the project page (shown
     on `overview` / `ai` / `team` tabs only — see
     `page.tsx:471–488`).
- Every new feature should:
  1. Add `change_order` / `lien_waiver` / `submittal` /
     `rfi` to the `ActivityEntityType` union in
     `lib/activity/log.ts:21–35`.
  2. Add `created` / `sent` / `viewed` / `acknowledged` / `paid`
     (already in the `ActivityAction` union).
  3. Call `logActivity(...)` after every state transition in
     the corresponding `lib/<feature>/actions.ts`.
  4. The history tab will then "just work".

### 3.4 Share token / public link pattern
- **Generated server-side** with `crypto.randomBytes(24).toString(
  'base64url')` (e.g. `lib/pay-apps/actions.ts:25–27`).
- Stored in the row as a unique column (`shareToken @unique`).
- The token **is the credential** — no Clerk session.
- The public route is registered in `middleware.ts` `isPublicRoute`
  (see current entries at lines 31–70). Adding a new public route
  for CO signatures or lien-waiver delivery means **two** updates:
  1. Add the path to `isPublicRoute` in `middleware.ts:7–87`.
  2. Add the matching pattern to `MIDDLEWARE_PUBLIC_PATTERNS` in
     `scripts/audit-links.ts:87–101`, otherwise `pnpm tsx
     scripts/audit-links.ts` flags the new link as broken.
- **The token also gets the audit pattern**:
  - `PayApp.viewCount` + `firstViewedAt` + `PayAppViewEvent`
    (append-only, with IP/UA/referrer).
  - `Estimate.firstViewedAt` + audit fields (`approvedByEmail`,
    `approvedByName`, `rejectedByEmail`, `rejectedByName`,
    `rejectNote`).
  - `RfqEvent` (created/sent/viewed/submitted/declined/accepted/
    revoked/resent/expired, with `actor: "vendor"` for portal
    events).
  - `PoEvent` (more events than RFQ; see the `type` enum
    documented at `prisma/schema.prisma:2305–2309`).
- **CSP rules** for public portals: `frame-ancestors 'none'`,
  `form-action 'self'`, and per-route `X-Robots-Tag:
  noindex, nofollow, noarchive, nosnippet` + `Cache-Control:
  no-store, no-cache, must-revalidate, private` — see
  `next.config.mjs:228–254` (the existing `X-Robots-Tag` is on
  `/q/:path*`; add the same for `/co/:path*` and
  `/lien/:path*`).

### 3.5 Email pattern (Resend)
Two flavours, both already wired up — pick the one that fits.
- **React Email** (`lib/email/resend.ts:sendEmail(...)`): the
  preferred approach for any new feature. Build a TSX template in
  e.g. `emails/ChangeOrderEmail.tsx`, pass it as `react:`.
- **Plain HTML** (used for owner alerts in
  `lib/email/owner-alerts.ts:97–115`): fetch the Resend API
  directly. Use this for internal-only alerts, not for
  customer-facing COs / lien-waiver delivery.
- The PDF should be uploaded to Vercel Blob and the URL included
  in the email (see the pattern in
  `lib/procurement/po-actions.ts:issuePoAction` — `pdfUrl` is set
  after render, then included in the email body).

### 3.6 Pay-app lifecycle (DRAFT → SENT → VIEWED → … → PAID)
Reference implementation. Pattern to copy for COs:
- **Server actions** in `lib/pay-apps/actions.ts`:
  - `generatePayAppAction` (line 29): validates project, builds
    `PayAppDivision` rows, computes totals, generates `shareToken`,
    returns `{ id }` for redirect.
  - `sendPayAppAction` (line 160): gated on `DRAFT` or `SENT`,
    sets `status='SENT'`, stamps `sentAt` + `sentToEmail`, sends
    email via Resend, writes `ActivityLog`.
  - `acknowledgePayAppAction` (line 250): admin-side
    acknowledgement, sets `status='ACKNOWLEDGED'`.
  - `markPayAppPaidAction` (line 266): PM/ESTIMATOR gated,
    sets `status='PAID'`, stamps `paidAt`+`paidById`.
  - `markPayAppDisputedAction` (line 306): only OWNER/ADMIN/PM
    can dispute.
  - `updatePayAppAction` (line 347): **only DRAFT can be
    edited**. Once sent, numbers are locked.
- **Public route** `app/pay-apps/[token]/page.tsx`: server
  component, calls `recordPayAppView` (server action in
  `actions.ts` adjacent) on first render, hands off to
  `<PublicPayAppView>`.
- **Public API endpoint** `app/api/pay-apps/[id]/acknowledge/
  route.ts`: the **IDOR-safe** acknowledge pattern — looks up
  by `shareToken` (not by `id`), checks `payApp.id ===
  params.id`, then mutates. **10 test cases** in
  `__tests__/acknowledge.test.ts` cover this; reuse the same
  shape for CO acknowledgement.
- **PDF**: rendered inline on the public page via `@react-pdf`
  with a print-only stylesheet (`PublicPayAppView.tsx:62–76`).
  The "official" PDF (also stored to Blob as `payApp.pdfUrl`) is
  rendered server-side in `lib/pdf/render.tsx`.
- **CRITICAL**: `generateShareToken()` is **server-side only**
  and **never sent to the client until "Send" is clicked**. The
  link is built on send and emailed.

---

## 4. Risk areas — top 10 things NOT to break

These are ranked by blast radius (user impact × regression-test
coverage).

1. **Pay-app acknowledge API** — `app/api/pay-apps/[id]/acknowledge/`
   has the most-tested public API in the app (10 cases in
   `acknowledge.test.ts`, including IDOR / tamper / idempotency).
   Touching the public-token pattern for COs / lien waivers must
   keep the same shape (look up by token, verify id matches,
   idempotent, 404 on tamper).

2. **CSP** — `__tests__/csp.test.ts` parses
   `next.config.mjs:123–166` and asserts that any host in
   `connect-src` is also in `img-src`, that `vercel.com` is in
   `connect-src` (for the @vercel/blob PUT), and that `blob:` is
   in `worker-src` / `child-src`. **If you add a new blob
   subdomain, CDN, or worker URL, both this test and the header
   config must be updated in lockstep.**

3. **Vercel Blob upload routes** —
   `app/api/__tests__/upload-routes.test.ts` enforces the
   `handleUpload` pattern across 5 routes
   (`app/api/files/upload/route.ts`,
   `app/api/clients/files/route.ts`,
   `app/api/subs/[id]/documents/route.ts`,
   `app/api/projects/[id]/bim/route.ts`,
   `app/api/projects/[id]/photos/upload/route.ts`). Adding a
   new upload route for CO PDFs or signed lien-waiver PDFs
   **must** follow the same pattern, or the test will fail.
   The test also asserts the route lists `handleUpload` in
   `middleware.ts:isPublicRoute`.

4. **The 9-tab project page** — `page.tsx:312–469` is a
   13-Promise `Promise.all` waterfall. **Don't break the
   `searchParams.tab` switch** — if you add a tab, you must
   update both the conditional render block AND the
   `SIDEBAR_GROUPS` config in `lib/projects/sidebar-status.ts`
   AND any badges the new tab should show. Forgetting any one
   of these will produce a sidebar item that 404s on click.

5. **The new vertical project sidebar**
   (`ProjectSidebar.tsx` + `sidebar-status.ts`) — a 2-line
   config + 1 file is the difference between a working tab and
   a 404. The `useTabParam` vs `subRoute` distinction is also
   load-bearing: pick the wrong one and the active-state
   highlight breaks.

6. **Workspace tenant scoping** — every Prisma `where` in every
   server action must include `workspaceId` (or filter via the
   parent FK). The `auth` test suite
   (`lib/auth/__tests__/require-membership.test.ts`,
   `require-role.test.ts`) catches the obvious misses; the
   procurement tree has explicit tenant-scoping comments
   (e.g. `lib/procurement/rfq-actions.ts:9`). **The new CO /
   Lien Waiver actions must follow this exactly.**

7. **Public-route middleware allowlist** —
   `middleware.ts:7–87` is the public-route list. The link
   audit (`scripts/audit-links.ts:87–101`) mirrors it. Adding
   a new public token route (e.g. `/co/[token]`, `/lien/[token]`)
   requires adding it in **both** places, or the link audit
   fails CI.

8. **Resend env shims** — `next.config.mjs:23–35` defines the
   alias map (`UDGOK_MESSAGING_RESEND_API_KEY` →
   `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` →
   `PROCUREMENT_FROM_EMAIL`). The pay-app `sendPayAppAction`
   reads these directly. Adding CO email sending should use the
   same helper, not `new Resend(apiKey)` directly, to keep
   "RESEND_API_KEY not set" warning behaviour consistent.

9. **`/w/[workspace]/procurement/*` route group** — the
   procurement module is the most polished existing analogue
   for COs (vendor portal, token auth, status state machine,
   `RfqEvent`/`PoEvent` audit). It has 12 test files
   (`lib/procurement/__tests__/`). New tests for COs should
   mirror the structure of `lib/procurement/__tests__/`
   (token.test.ts, resolveRfqToken.test.ts, render-po-pdf.test.ts).

10. **PDF generation (react-pdf) edge cases** —
    `app/api/projects/[id]/pdf/__tests__/pdf.test.ts` is the
    only PDF test. It mocks `renderToBuffer` and verifies auth
    gates. The route has `maxDuration = 60` (line 36) and
    `dynamic = 'force-dynamic'` (line 41). If you build a CO /
    Lien Waiver PDF route, follow the same auth-then-render
    pattern; the existing PDF build is **slow** (~1.5s for a
    30-photo project book, longer with more) and Vercel's
    default 10s function ceiling is too tight for any complex
    document.

Other risk areas (top 10 honourable mentions):
- **Project sidebar badge query** (`sidebar-status.ts:67–254`)
  fires 14 Prisma queries. Adding a "Change orders" badge
  requires adding one more `prisma.changeOrder.count` to the
  `Promise.all` — keep it parallel.
- **Stripe / payment settings** (`WorkspacePaymentSettings`,
  `PoPaymentMethod`, `PoInvoiceStatus`) — COs probably don't
  need these directly, but **lien waivers often require a
  payment-method choice** (the same enum already exists for
  POs).
- **OCR / handwriting** is *not* present anywhere — lien
  waivers today would be plain text + a PDF.
- **Multi-tenant row-level security**: Prisma doesn't enforce
  it; the action layer does. Every new action must call
  `requireRole(...)` before any DB write.
- **Clock skew** (`components/ClockSkewIndicator.tsx` + the
  `__tests__` test) — if CO due dates need reminders, the
  user-side clock-skew UI is already there to reuse.

---

## 5. Existing audit / compliance features

There's already substantial compliance infrastructure in place —
**the new features should hook into it rather than reinvent
it**:

- **Universal activity log** (`ActivityLog` +
  `lib/activity/log.ts` + `ActivityFeed.tsx`). Every state
  transition on every workflowable entity writes one row.
  Indexed on `(workspaceId, entityType, entityId)` for fast
  per-entity history lookups, plus `(workspaceId, createdAt)`
  for the workspace feed.

- **View-event append-only logs** for every public-token entity:
  - `PayAppViewEvent` (`prisma/schema.prisma:1152–1164`) — IP,
    UA, referrer, viewer email.
  - `RfqEvent` (`prisma/schema.prisma:2091–2109`) — typed events
    (CREATED/SENT/VIEWED/SUBMITTED/...), actor (Clerk userId or
    `'vendor'`), IP hash (SHA-256, never raw), metadata JSON.
  - `PoEvent` (`prisma/schema.prisma:2299–2319`) — same shape
    with more event types.
  - `ScanEvent` (`prisma/schema.prisma:1036–1051`) — every
    barcode scan on the system is logged.
  - `WeeklyTimesheet` has its own approval timestamps
    (`submittedById`/`submittedAt`, `approvedById`/`approvedAt`,
    `rejectedById`/`rejectedAt`/`rejectNote`) and a
    `totalHoursAtApproval` snapshot.

- **Per-entity "History" panel** in the project page
  (rendered on `overview`/`ai`/`team` tabs; see
  `page.tsx:471–488`).

- **Per-entity comment threads** (`Message` model +
  `components/messages/MessageThread.tsx`). Polymorphic over
  `MessageEntityType`: PROJECT/CLIENT/DEAL/SUBCONTRACTOR/PAY_APP/
  WORKSPACE. **Add `CHANGE_ORDER` / `LIEN_WAIVER` / `SUBMITTAL`
  to this enum** to get free in-entity commenting.

- **Sign-off audit fields** are already in the schema for pay
  apps (`acknowledgedByEmail`/`acknowledgedByName`/
  `acknowledgedAt`) and estimates (`approvedByEmail`/
  `approvedByName`/`approvedAt` + `rejectedByEmail`/
  `rejectedByName`/`rejectNote`/`rejectedAt`). Same pattern
  should be used for CO signatures and lien-waiver
  acknowledgements.

- **Document numbering** — `DocCounter` table
  (`prisma/schema.prisma:2386–2395`) is the race-safe, per-
  workspace/year gapless sequence used by RFQs (`RFQ-YYYY-NNNN`)
  and POs (`PO-YYYY-NNNN`). **Reuse for COs**
  (`CO-YYYY-NNNN`) and **Lien Waivers**
  (`LW-YYYY-NNNN`). The `nextDocNumber(tx, workspaceId, type)`
  helper in `lib/procurement/number.ts` is the implementation.

- **PDF storage** — every workflowable entity has a
  `pdfUrl?` column (PayApp, Estimate, PurchaseOrder). The
  action uploads the rendered PDF to Vercel Blob and sets
  `pdfUrl` in the same transaction. Same pattern for COs and
  lien-waiver PDFs.

- **Geo-fenced site check-in** (`SiteCheckInCode` +
  `CheckInEvent`) already provides the audit trail for "who
  was on site when". This is useful for COs that require an
  on-site witness, but more importantly: it shows the project
  already tolerates the kind of long-lived + high-volume
  audit row pattern the new features will need.

- **Audit fields on User changes** (`presence/lastSeenAt`,
  `User.upsert` is called defensively in
  `app/api/files/upload/route.ts:120–140` so a Clerk-webhook
  race never loses a file row — same defensive pattern for
  any new public token route that creates a row before
  Clerk has fully synced).

- **Timesheet "lock" semantics** (`WeeklyTimesheet.APPROVED` →
  events can't be edited without an explicit unlock + audit
  row). This is the closest existing analogue to a "CO
  contract" that should be locked once approved.

---

## 6. Integration points — where the new features should hook in

### Change orders
- **New model**: `ChangeOrder` (workspaceId, projectId, dealId? —
  CO can also originate from a deal), `number` (from `DocCounter`
  with `type='CO'`), `title`, `description?`, `status: ChangeOrderStatus`
  (`DRAFT` → `SENT` → `APPROVED` / `REJECTED` → `EXECUTED` →
  `VOID`), `requestedAmount` / `approvedAmount` (Decimal(12,2)),
  `requestedAt`, `sentAt?`, `approvedAt?`, `approvedByEmail?`,
  `approvedByName?`, `rejectedAt?` / `rejectedByEmail?` etc.,
  `executedAt?`, `shareToken` (@unique), `pdfUrl?`, `createdById`,
  timestamps.
- **Child table** `ChangeOrderDivision` (mirrors `PayAppDivision`):
  one row per `ProjectDivision` affected, with
  `deltaThisCOAmount` (Decimal(12,2)). Reuse the cumulative math
  pattern from `lib/pay-apps/actions.ts:75–106`.
- **Activity log entity type**: add `'change_order'` to
  `ActivityEntityType` in `lib/activity/log.ts:21–35`.
- **Project page**: add `change-orders` to `SIDEBAR_GROUPS` in
  `lib/projects/sidebar-status.ts:281–320` (suggested group:
  `Money`, with `subRoute: 'change-orders'`).
- **Public route**: `app/co/[token]/page.tsx` + `actions.ts`,
  modelled on `app/e/[token]/page.tsx` (estimate approval). Add
  to `isPublicRoute` (`middleware.ts:7–87`) and
  `MIDDLEWARE_PUBLIC_PATTERNS`
  (`scripts/audit-links.ts:87–101`). The portal renders
  "Approve / Reject" with name + email + optional signature
  field.
- **PDF**: new component `lib/pdf/components/ChangeOrderSection.tsx`
  consumed by `ProjectPdf.tsx` (so the CO shows up in the
  monthly project book).
- **Financial rollup**: `lib/projects/financial-summary.ts`
  should include `openChangeOrderTotal` and `approvedChangeOrderTotal`
  in the AR / margin calculation, and the `FinancialSummary` card
  on `OverviewTab` should display them. Add the count to
  `getProjectSidebarStatus` for the sidebar badge.

### Lien waivers
- **New model**: `LienWaiver` (workspaceId, projectId,
  subAssignmentId? — the waiver can be tied to a specific
  sub's progress, or unconditional), `number`
  (from `DocCounter`, `type='LW'`), `kind: LienWaiverKind`
  (`CONDITIONAL_PROGRESS` / `UNCONDITIONAL_PROGRESS` /
  `CONDITIONAL_FINAL` / `UNCONDITIONAL_FINAL` — these are the
  four CSLB-recognized flavors), `amount` (Decimal(12,2) — the
  amount being waived through this draw), `payAppId?` (link
  to the draw that triggered it), `status: LienWaiverStatus`
  (`DRAFT` → `SENT` → `SIGNED` / `EXPIRED` / `VOID`),
  `shareToken` (@unique), `signedAt?`, `signedByName?`,
  `signedByTitle?` (e.g. "President"), `signedByIp?`,
  `pdfUrl?`, `notaryRequired: Boolean`, `notarizedAt?`,
  `notarizedBy?`, `createdById`, timestamps.
- **Append-only event log**: `LienWaiverEvent` (mirrors
  `RfqEvent`: CREATED/SENT/VIEWED/SIGNED/VOIDED/EXPIRED,
  `actor`, `ipHash`, `meta Json?`).
- **Activity log entity type**: add `'lien_waiver'`.
- **Project page**: new sidebar item `lien-waivers` in the
  `Money` group. Sub-route `/projects/[id]/lien-waivers`.
  Each pay app detail page (`app/.../pay-apps/[payAppId]/
  page.tsx`) should show a "Generate lien waiver" button that
  creates a `LienWaiver` prefilled with `payAppId`,
  `subcontractorId` (if any), and `amount` from the
  sub-assignment breakdown.
- **Public route**: `app/lw/[token]/page.tsx` + `actions.ts`,
  modelled on `app/p/[token]/page.tsx` (PO portal). The vendor
  sees a "Release of Lien" form with a typed signature line,
  printed name, title, company, and a checkbox for the
  four-flavour acknowledgment language (statutory wording
  varies by state — the form should be workspace-configurable
  via `WorkspacePaymentSettings` analog).
- **CSP / link audit**: same as COs above.

### Submittals / RFIs
- **New models**:
  - `Submittal` (workspaceId, projectId, `number` from
    `DocCounter`, `type='SUB'`), `specSection` (e.g.
    "09 30 00"), `title`, `description?`,
    `status: SubmittalStatus` (`DRAFT` → `SENT` → `UNDER_REVIEW` →
    `APPROVED` / `APPROVED_AS_NOTED` / `REVISE_AND_RESUBMIT` /
    `REJECTED` / `VOID`), `requiredByDate?`, `submittedAt?`,
    `submittedById?` (sub or staff), `reviewerId?` (the
    architect/engineer), `dueDate?`, `shareToken?` (@unique, if
    sent to an external reviewer), `pdfUrl?`, `createdById`,
    timestamps.
  - `SubmittalReview` (parentId, reviewerId?, reviewerName?,
    reviewerEmail? (typed, for external reviewers),
    `decision: SubmittalStatus` (the new status set),
    `comments?`, `reviewedAt`, `ipHash?`).
  - `Rfi` (workspaceId, projectId, `number` from `DocCounter`,
    `type='RFI'`), `question`, `answer?`, `status: RfiStatus`
    (`DRAFT` → `SENT` → `ANSWERED` / `VOID`),
    `assignedToId?` (the responder, e.g. architect),
    `dueDate?`, `shareToken?` (@unique), `costImpact?`
    (Decimal — yes/no may require a CO), `scheduleImpactDays?`,
    `answeredAt?`, `answeredById?`, timestamps.
- **Activity log entity types**: add `'submittal'` and `'rfi'`.
- **Sidebar**: add a new group `Documents` between `Money` and
  `Site` (or inside `Money`): `submittals` and `rfis` as
  sub-routes under `/projects/[id]/...`.
- **Public reviewer routes**: same pattern as COs — `/sub/[token]`
  and `/rfi/[token]`. External reviewers (architects, engineers)
  don't sign in; the token IS the credential.
- **Project page** wiring: the existing `takeoff` tab and the
  submittals / RFIs are a natural pair (both deal with
  "what the drawings say"). Could optionally live as a
  new `Documents` group at the bottom of the sidebar.
- **PDF** (architect-style): new components
  `lib/pdf/components/SubmittalSection.tsx` and
  `RfiSection.tsx` for the project book.

### Shared plumbing
For all three features, in the same PR (or at minimum the same
milestone):
- `prisma/schema.prisma` — add the models above + the
  `ChangeOrderStatus` / `LienWaiverKind` / `LienWaiverStatus` /
  `SubmittalStatus` / `RfiStatus` enums.
- `lib/activity/log.ts:21–35` — add the new entity types.
- `lib/projects/sidebar-status.ts:281–320` — add the new sidebar
  items + badge entries.
- `lib/pdf/components/` — add the per-section PDF components and
  wire them into `lib/pdf/ProjectPdf.tsx`.
- `lib/projects/financial-summary.ts` — add CO totals to the
  financial rollup.
- `middleware.ts` + `scripts/audit-links.ts` — add the new
  public token routes.
- `app/api/files/upload/route.ts:24–27` — add the new
  `category` allowlist values.
- `__tests__/csp.test.ts` — if any new blob host, add the
  assertion (the test enumerates the image hosts; just match
  the pattern).

---

## Quick reference: where to look for inspiration

| New feature      | Closest existing analogue        | Key files to copy from                                          |
|------------------|----------------------------------|-----------------------------------------------------------------|
| Change Order     | `Estimate` (client-approval flow)| `app/e/[token]/*`, `lib/estimates/*`, `lib/pay-apps/*` for the SOV delta math |
| Lien Waiver      | `PayApp` (token-auth signature)  | `app/pay-apps/[token]/*`, `app/api/pay-apps/[id]/acknowledge/*` |
| Submittal        | `PurchaseOrder` (vendor response loop) | `app/p/[token]/*`, `lib/procurement/po-*`                 |
| RFI              | `PayApp` (simpler lifecycle)     | `lib/pay-apps/actions.ts:sendPayAppAction`                      |
| Project page tab | `pay-apps` sub-route             | `app/(app)/w/[workspace]/projects/[id]/pay-apps/page.tsx`       |
| Public token route | `app/e/[token]/page.tsx`        | Same shape, swap the entity                                     |
| Sidebar item     | `pay-apps` config                | `lib/projects/sidebar-status.ts:281–320`                        |
| Status pill      | `<StatusBadge>` variants         | `components/ui/StatusBadge.tsx` (add to its `StatusVariant` union + maps) |
| Audit event row  | `RfqEvent` / `PoEvent`           | `prisma/schema.prisma:2091–2109`                                |
| Document number  | `nextDocNumber(tx, ws, 'RFQ')`   | `lib/procurement/number.ts`                                     |
| Email            | `lib/procurement/email.ts` (full HTML, no PII leak) | Same module, swap the template                            |
| PDF              | `lib/pdf/ProjectPdf.tsx` section pattern | `lib/pdf/components/PayAppsSection.tsx`                 |

