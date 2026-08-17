# UDGOK CMS — Slice B v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, internal construction management CMS for UDGOK Construction — auth, workspace, CRM, tasks, documents, projects (with Gantt), and the full Pay App workflow (auto-numbered draws, send-to-customer, view tracking) — built on the UDGOK Bold design system. ~40 tasks, 5 phases, each phase produces a deployable artifact.

**Architecture:** Next.js 15 App Router modular monolith. Server Components by default, Server Actions for mutations. Three.js scenes (R3F + drei) lazy-loaded on a few specific screens. PDF generation server-side via @react-pdf/renderer. Resend for transactional email. Neon Postgres + Prisma for data. Clerk for auth + orgs (= workspaces). Vercel Blob for files. Deployed to Vercel.

**Tech Stack:**
- Next.js 15 (App Router) · TypeScript 5.x · Tailwind v3 · Prisma 5.x
- Neon Postgres · Clerk (auth + orgs) · Vercel Blob · React Three Fiber + drei
- @react-pdf/renderer · @vercel/ai · Resend (transactional email)
- Vitest + @testing-library/react · Playwright (E2E) · MSW (mock server)
- pnpm · ESLint · Prettier · GitHub Actions

---

## Global Constraints

These are the project-wide requirements from the spec. Every task implicitly follows them.

- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind v3, Prisma, Neon Postgres, Clerk, Vercel Blob, R3F + drei, @react-pdf/renderer, @vercel/ai, Resend
- **Package manager:** pnpm (not npm/yarn)
- **Workspace ID == Clerk Organization ID** (1:1 mapping; never write to Workspace directly outside webhook handler)
- **Money:** `Decimal(12, 2)` in Prisma, never `Float`
- **Server-first:** Server Components default, Client Components only when needed (interactivity, state, browser APIs, Three.js)
- **Mutations:** Server Actions only. No REST CRUD. Webhooks (Clerk) are the only `/api/*` route, plus the public view-logging endpoint.
- **Auth/RBAC:** every mutation calls `requireRole(workspaceId, [...allowedRoles])` first. UI gates are convenience only — server enforces.
- **Design system:** UDGOK Bold — cream `#f5f1ea`, ink `#1e2a3a`, orange `#f06a2d`, paper `#ffffff`. Inter Black 900 headlines, Inter 800 labels, Inter 500 body, JetBrains Mono 500-700 mono. All in `tailwind.config.ts → theme.extend` + CSS variables in `globals.css`.
- **3D:** lazy-load via `next/dynamic` with `ssr: false`, respect `prefers-reduced-motion`, `<Canvas frameloop="demand">`, JS budget <100KB per scene.
- **PDF:** server-side only via @react-pdf/renderer; self-hosted fonts; UDGOK branding.
- **Testing:** Vitest for unit/integration (with real Neon branch for DB), Playwright for E2E against Vercel preview URLs. No coverage threshold.
- **Env vars (canonical names):**
  - `DATABASE_URL` (Neon connection string)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` / `CLERK_WEBHOOK_SECRET`
  - `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
  - `ANTHROPIC_API_KEY` (primary AI), `OPENAI_API_KEY` (fallback)
  - `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` (e.g. `payapps@udgok.app`)
  - `NEXT_PUBLIC_APP_URL` (e.g. `https://udgok.app`)
- **Git:** `main` branch, conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`), every task ends with a commit, push to `origin/main` after every task.
- **Naming:** workspace == "UDGOK" (user's brand). Internal design system codename = "Atelier". Don't expose "Atelier" in customer-facing surfaces.

---

## Phase 0 — Bootstrap & Design System Foundation (Tasks 1–6)

The skeleton. After this phase: deployed Next.js app with UDGOK Bold design system rendered, can sign in (Clerk test mode), but no workspace/business logic yet.

### Task 1: Scaffold Next.js + TypeScript + Tailwind + ESLint + Prettier

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.editorconfig`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `.nvmrc` (node 20), `.gitignore` updates (already done, .next, node_modules, .env*)

**Interfaces:**
- `pnpm dev` → http://localhost:3000 shows the default Next.js starter
- `pnpm build` succeeds with no errors
- `pnpm lint` passes

**Steps:**
- [ ] Run `pnpm create next-app@latest udgok-cms --typescript --tailwind --eslint --app --src-dir=false --import-alias='@/*' --use-pnpm` then move all files up to repo root (we want `/workspace` to BE the project, not `/workspace/udgok-cms`). Use `mv` to flatten the directory.
- [ ] Update `package.json` name to `udgok-cms`, set `"private": true`, ensure `"engines": { "node": ">=20" }`.
- [ ] Install Prettier: `pnpm add -D prettier prettier-plugin-tailwindcss` and add `.prettierrc.json` with `{"semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100}`.
- [ ] Add `pnpm format` and `pnpm format:check` scripts to `package.json`.
- [ ] Verify `pnpm dev` shows Next.js starter at localhost:3000.
- [ ] Commit: `git add . && git commit -m "chore: scaffold Next.js 15 + TypeScript + Tailwind + Prettier"`

### Task 2: Set up Prisma + Neon + base schema

**Files:**
- Create: `prisma/schema.prisma`, `prisma/migrations/.gitkeep`, `lib/db/client.ts`
- Create: `.env.example`, `.env.local` (gitignored)

**Interfaces:**
- `lib/db/client.ts` exports a singleton `prisma` PrismaClient (HMR-safe via globalThis pattern)
- `prisma/schema.prisma` matches the schema in spec section 2
- `pnpm db:generate` regenerates the Prisma client
- `pnpm db:push` applies schema to dev DB
- `pnpm db:studio` opens Prisma Studio

**Steps:**
- [ ] `pnpm add prisma @prisma/client && pnpm add -D dotenv-cli`
- [ ] `pnpm prisma init --datasource-provider postgresql`
- [ ] Replace generated `schema.prisma` with the full v1 schema from spec section 2 (Workspace, User, Membership, Client, Property, Deal, Note, Project, ProjectMember, Task, File, ProjectDivision, PayApp, PayAppDivision, PayAppViewEvent, all enums).
- [ ] Create `lib/db/client.ts`:
  ```ts
  import { PrismaClient } from '@prisma/client';
  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
  export const prisma = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
  ```
- [ ] Sign up for Neon (free tier), create a `udgok-cms-dev` database, copy the connection string to `.env.local` as `DATABASE_URL`.
- [ ] Run `pnpm prisma db push` to apply schema. Verify all tables created in Neon dashboard.
- [ ] Add scripts to `package.json`: `"db:generate": "prisma generate"`, `"db:push": "prisma db push"`, `"db:studio": "prisma studio"`, `"db:migrate": "prisma migrate dev"`.
- [ ] Commit: `git add . && git commit -m "chore: set up Prisma + Neon with v1 schema"`

### Task 3: Set up Clerk authentication

**Files:**
- Modify: `app/layout.tsx` (wrap with ClerkProvider)
- Create: `middleware.ts` (root)
- Create: `app/(auth)/sign-in/[[...rest]]/page.tsx`, `app/(auth)/sign-up/[[...rest]]/page.tsx`
- Modify: `.env.example`, `.env.local`

**Interfaces:**
- `<ClerkProvider>` wraps the app in `app/layout.tsx`
- `middleware.ts` uses `clerkMiddleware` from `@clerk/nextjs/server`, protects all routes except `/_next/*`, `/sign-in*`, `/sign-up*`, `/share/*`
- Visiting `/` while signed out redirects to `/sign-in`; signed in users with no org see `/onboarding` (placeholder for now)
- `pnpm dev` and visit `/sign-in` shows Clerk's hosted sign-in

**Steps:**
- [ ] `pnpm add @clerk/nextjs`
- [ ] Sign up for Clerk, create a new app called "UDGOK CMS", enable Organizations.
- [ ] Copy publishable key and secret key to `.env.local`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
- [ ] Wrap `app/layout.tsx` with `<ClerkProvider>`.
- [ ] Create `middleware.ts` at repo root with `clerkMiddleware` that protects everything except the listed public routes.
- [ ] Create `app/(auth)/sign-in/[[...rest]]/page.tsx` and `app/(auth)/sign-up/[[...rest]]/page.tsx` using `<SignIn />` and `<SignUp />` from `@clerk/nextjs`.
- [ ] Test: `pnpm dev`, visit localhost:3000, get redirected to sign-in, sign up with test email, land somewhere (404 OK for now).
- [ ] Commit: `git add . && git commit -m "chore: set up Clerk auth with sign-in/sign-up pages"`

### Task 4: Set up Clerk webhook → DB sync (Workspace, User, Membership)

**Files:**
- Create: `app/api/webhooks/clerk/route.ts`
- Create: `lib/auth/sync.ts` (functions: `upsertUserFromClerk`, `upsertWorkspaceFromClerk`, `upsertMembershipFromClerk`, `deleteMembership`)
- Create: `lib/auth/svix.ts` (Svix signature verification helper)

**Interfaces:**
- `POST /api/webhooks/clerk` — Svix-verified, handles `user.created`, `user.updated`, `user.deleted`, `organization.created`, `organization.updated`, `organization.deleted`, `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`
- Each handler calls the corresponding `upsert*FromClerk` function, which writes to the DB using `Workspace.id == clerkOrg.id`, `User.id == clerkUser.id`

**Steps:**
- [ ] `pnpm add svix`
- [ ] Set up Clerk webhook in dashboard: endpoint URL `https://<your-tunnel>/api/webhooks/clerk` (use ngrok or Clerk's local proxy for dev), subscribe to all the events above. Copy signing secret to `.env.local` as `CLERK_WEBHOOK_SECRET`.
- [ ] Create `lib/auth/svix.ts` exporting `verifyWebhook(req: Request)` that returns the parsed Clerk event or throws.
- [ ] Create `lib/auth/sync.ts` with the 4 upsert functions. Each takes a Clerk payload, writes to Prisma. Membership role is read from `publicMetadata.role` on the Clerk user (default: `MEMBER`).
- [ ] Create `app/api/webhooks/clerk/route.ts` exporting `POST` that calls `verifyWebhook`, switches on `evt.type`, calls the right sync function, returns 200.
- [ ] Test: sign up a new test user in dev, check Neon DB — `User` row created. Create an org in Clerk dashboard, check — `Workspace` + `Membership` rows created.
- [ ] Commit: `git add . && git commit -m "feat: Clerk webhook sync (user, workspace, membership)"`

### Task 5: UDGOK Bold design system + base components

**Files:**
- Create: `styles/globals.css` (CSS variables)
- Modify: `tailwind.config.ts` (theme.extend with UDGOK colors, fonts, spacing)
- Create: `components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Input.tsx`, `components/ui/Badge.tsx`, `components/ui/SectionNumber.tsx`, `components/ui/StatusBadge.tsx`
- Create: `app/layout.tsx` modifications (font loading, theme)

**Interfaces:**
- `Button` props: `{ variant?: 'primary' | 'secondary' | 'copper' | 'ghost'; size?: 'sm' | 'md' | 'lg'; ...ButtonHTMLAttributes }`
- `Card` props: `{ className?: string; children: ReactNode }` — paper background, 1px line, optional hover
- `Badge` props: `{ variant?: 'navy' | 'copper' | 'success' | 'warn' | 'neutral'; children: ReactNode }` — uppercase mono 10px
- `SectionNumber` props: `{ num: number; children: ReactNode }` — orange circle + label
- `StatusBadge` props: `{ status: 'active' | 'lead' | 'archived' | 'viewed' | 'sent' | 'paid' | 'disputed'; children: ReactNode }`

**Steps:**
- [ ] Replace `styles/globals.css` with the UDGOK Bold CSS variables (cream, ink, orange, paper, lines, etc.) and base resets.
- [ ] Replace `tailwind.config.ts` content with the UDGOK theme.extend (colors mapped to CSS vars, Inter font family, custom font weights, letter spacing, etc.).
- [ ] `pnpm add @fontsource-variable/inter @fontsource-variable/jetbrains-mono` for self-hosted fonts. Import in `globals.css` via `@import`.
- [ ] Create `components/ui/Button.tsx` with the 4 variants. Use Inter 800, uppercase, letter-spacing 0.1em. Primary = ink bg + cream text. Hover transitions.
- [ ] Create `components/ui/Card.tsx`, `Input.tsx`, `Badge.tsx`, `SectionNumber.tsx`, `StatusBadge.tsx` per interfaces above.
- [ ] Create `app/showcase/page.tsx` (dev-only) that renders one of each component to verify the styling works.
- [ ] Test: visit `/showcase`, confirm everything renders in UDGOK Bold.
- [ ] Commit: `git add . && git commit -m "feat: UDGOK Bold design system + base UI components"`

### Task 6: Vercel Blob + Resend + base env setup

**Files:**
- Create: `lib/blob/upload.ts` (server-side upload helper)
- Create: `lib/email/resend.ts` (Resend client wrapper)
- Create: `lib/env.ts` (typed env access)
- Modify: `.env.example`

**Interfaces:**
- `lib/blob/upload.ts` exports `uploadFile(file: File, prefix: string): Promise<{ url: string; pathname: string }>` — uploads to Vercel Blob under `prefix/{nanoid}-{filename}`
- `lib/email/resend.ts` exports `sendEmail({ to, subject, react, from? }): Promise<{ id: string }>` — wraps `resend.emails.send`
- `lib/env.ts` exports a typed `env` object with all the env vars from the global constraints. Throws on missing required vars at startup.

**Steps:**
- [ ] `pnpm add @vercel/blob resend nanoid`
- [ ] Set up Vercel Blob in your Vercel project dashboard (Storage → Create → Blob). Copy `BLOB_READ_WRITE_TOKEN` to `.env.local`.
- [ ] Sign up for Resend, verify your sending domain (or use the sandbox domain for dev), copy `RESEND_API_KEY` and set `RESEND_FROM_ADDRESS` to `noreply@yourdomain.com` (or `onboarding@resend.dev` for dev).
- [ ] Create `lib/env.ts` with all the env vars from global constraints. Export `env` object. Use `zod` or just runtime checks that throw.
- [ ] Create `lib/blob/upload.ts` per interface.
- [ ] Create `lib/email/resend.ts` per interface.
- [ ] Test: write a quick script in `app/showcase/page.tsx` that uploads a test file and sends a test email. Verify both work.
- [ ] Commit: `git add . && git commit -m "chore: set up Vercel Blob + Resend + typed env"`

---

## Phase 1 — App Shell, Workspace, Onboarding (Tasks 7–12)

After this phase: signed-in users land on a workspace switcher, can create a workspace, switch between workspaces, and see the app shell (sidebar + topbar) with navigation. No business modules yet.

### Task 7: App layout shell (sidebar + topbar)

**Files:**
- Create: `components/workspace/Sidebar.tsx`, `components/workspace/Topbar.tsx`, `components/workspace/WorkspaceSwitcher.tsx`
- Create: `app/(app)/layout.tsx` (the authenticated app shell)
- Create: `lib/nav/items.ts` (sidebar nav config)

**Interfaces:**
- `Sidebar` reads active workspace from `useWorkspace()` hook (defined in Task 11), highlights active route via `usePathname()`, shows nav items from `lib/nav/items.ts` (Dashboard, Clients, Deals, Projects, Tasks, Documents, Settings)
- `Topbar` shows breadcrumb, search placeholder (no functionality yet), notifications button (placeholder), user button (Clerk `<UserButton />`)
- `app/(app)/layout.tsx` renders `<Sidebar />` + `<Topbar />` + `{children}` in a CSS grid

**Steps:**
- [ ] Create `lib/nav/items.ts` exporting an array of `{ href, label, icon, badge? }` for the sidebar.
- [ ] Create `components/workspace/Sidebar.tsx` — dark navy, UDGOK wordmark at top, nav items from config, user chip at bottom, active state = orange left rail + bg tint. Match the design in `cms-backend-ui/index.html` exactly.
- [ ] Create `components/workspace/Topbar.tsx` — cream bg, breadcrumb on left (`<Breadcrumb />` from shadcn or hand-rolled), search input placeholder, notifications icon, user button on right.
- [ ] Create `app/(app)/layout.tsx` that renders the shell.
- [ ] Create `app/(app)/dashboard/page.tsx` as a placeholder ("Welcome, {user.firstName}").
- [ ] Test: sign in, land on `/dashboard`, see sidebar + topbar with proper styling. Sign in as a user with no org — get redirected to `/workspaces` (Task 8).
- [ ] Commit: `git add . && git commit -m "feat: app shell (sidebar + topbar) with UDGOK Bold styling"`

### Task 8: Workspace switcher page (`/workspaces`)

**Files:**
- Create: `app/(app)/workspaces/page.tsx`
- Create: `components/workspace/WorkspaceTile.tsx`
- Create: `lib/auth/getUserWorkspaces.ts`

**Interfaces:**
- `lib/auth/getUserWorkspaces.ts` exports `getUserWorkspaces(userId): Promise<Workspace[]>` — returns all workspaces the user is a member of, ordered by most recently joined
- `/workspaces` is a server component that calls `getUserWorkspaces`, renders a 2-up grid of `WorkspaceTile`s + a "+ New workspace" tile that links to `/onboarding` (Task 9)

**Steps:**
- [ ] Create `lib/auth/getUserWorkspaces.ts` per interface.
- [ ] Create `components/workspace/WorkspaceTile.tsx` — paper card, workspace name (serif), member count, last activity, click navigates to `/w/[slug]/dashboard`.
- [ ] Create `app/(app)/workspaces/page.tsx` — server component, fetches workspaces, renders tiles.
- [ ] Test: sign in with the test user, create a workspace manually in Clerk dashboard, visit `/workspaces`, see the tile. Click it, get redirected to `/w/{slug}/dashboard` (which 404s — fine for now, we'll add the dynamic route in Task 11).
- [ ] Commit: `git add . && git commit -m "feat: workspace switcher page"`

### Task 9: Onboarding flow (`/onboarding`)

**Files:**
- Create: `app/(app)/onboarding/page.tsx`
- Create: `components/onboarding/WorkspaceNameStep.tsx`, `IndustryStep.tsx`, `InviteStep.tsx`
- Create: `app/(app)/onboarding/actions.ts` (Server Actions: `createWorkspaceAction`)

**Interfaces:**
- `createWorkspaceAction({ name, industry, invites: { email, role }[] })` creates a Clerk org + Workspace in our DB + Memberships for invited users (if they exist) atomically. Returns `{ workspaceSlug }` on success.
- 3-step wizard: Name → Industry → Invite. Each step is a Server Action that advances. Final step navigates to `/w/{slug}/dashboard`.

**Steps:**
- [ ] Use Clerk's `createOrganization` from `@clerk/nextjs/server` API. The org ID becomes the workspace ID.
- [ ] Create `app/(app)/onboarding/actions.ts` with the `createWorkspaceAction`. It:
  1. Creates a Clerk org with the name → returns clerk org ID
  2. Inserts Workspace row (id = clerk org ID, slug = name-slugified)
  3. Inserts Membership for the creator with role OWNER
  4. For each invited email, if a User exists, insert a Membership with the chosen role
  5. Returns `{ workspaceSlug }`
  6. On any error, attempts cleanup (delete Clerk org if DB insert failed)
- [ ] Create the 3 step components as client components (form state).
- [ ] Create `app/(app)/onboarding/page.tsx` that orchestrates the 3 steps.
- [ ] Test: sign in as a user with no org, visit `/onboarding` (or get redirected there), complete the wizard, land on `/w/{slug}/dashboard`. Verify Workspace + Membership rows in Neon.
- [ ] Commit: `git add . && git commit -m "feat: onboarding flow (create workspace + invite teammates)"`

### Task 10: Auth helpers (requireRole, getCurrentUser, getActiveWorkspace)

**Files:**
- Create: `lib/auth/require-role.ts`, `lib/auth/get-current-user.ts`, `lib/auth/get-active-workspace.ts`, `lib/auth/index.ts`
- Create: `lib/auth/__tests__/require-role.test.ts`

**Interfaces:**
- `requireRole(workspaceId: string, allowed: Role[]): Promise<{ userId, role }>` — throws if not authenticated or insufficient role
- `getCurrentUser(): Promise<{ id, email, name, memberships } | null>` — current Clerk user + memberships from our DB
- `getActiveWorkspace(): Promise<{ id, slug, name, role }>` — reads `orgId` from Clerk auth, fetches workspace, returns user's role in it. Throws if no active org.

**Steps:**
- [ ] Implement each helper in `lib/auth/`. All use `@clerk/nextjs/server`'s `auth()` to get `userId` and `orgId`.
- [ ] Write Vitest tests for `requireRole` covering: owner can, member can't, unauth throws, no membership throws.
- [ ] Test: call `requireRole(workspaceId, ['PM'])` in a test page, verify it works.
- [ ] Commit: `git add . && git commit -m "feat: auth helpers (requireRole, getCurrentUser, getActiveWorkspace) + tests"`

### Task 11: Dynamic workspace routes (`/w/[workspace]/...`)

**Files:**
- Create: `app/(app)/w/[workspace]/layout.tsx`
- Create: `app/(app)/w/[workspace]/page.tsx` (dashboard placeholder for now)
- Modify: `app/(app)/layout.tsx` (add workspace resolution)

**Interfaces:**
- `/w/[workspace]` matches against the workspace slug in the URL
- The layout calls `getActiveWorkspace()` from Clerk auth, validates the URL slug matches the active workspace's slug (otherwise redirect)
- Sets workspace context for child pages via React context

**Steps:**
- [ ] Create `app/(app)/w/[workspace]/layout.tsx` — Server Component, fetches active workspace, validates URL matches, sets up `WorkspaceContext` for children.
- [ ] Create `app/(app)/w/[workspace]/page.tsx` — redirects to `/w/{slug}/dashboard` (we'll build that in Phase 2).
- [ ] Create `components/workspace/WorkspaceContext.tsx` — Client context provider that exposes `{ workspace, role }` to descendants via `useWorkspace()` hook.
- [ ] Update `Sidebar` to read the active workspace from context and link to `/w/{slug}/...` routes.
- [ ] Test: create a workspace via onboarding, get redirected to `/w/{slug}/dashboard`. Visit `/w/wrong-slug/dashboard` — get redirected to `/workspaces` (or the correct slug).
- [ ] Commit: `git add . && git commit -m "feat: dynamic workspace routes with slug validation + context"`

### Task 12: Empty-state dashboard + 404 page

**Files:**
- Create: `app/(app)/w/[workspace]/dashboard/page.tsx`
- Create: `app/not-found.tsx`

**Interfaces:**
- `/dashboard` shows the UDGOK Bold dashboard layout from the design (KPI row, pipeline placeholder, closing-this-week placeholder, my tasks placeholder) with proper empty states
- `app/not-found.tsx` is the UDGOK-styled 404 page

**Steps:**
- [ ] Create `dashboard/page.tsx` per the design. Use the same KPI row, panels, deal list, task list structure from the design (with empty states for "no data yet" since no modules are built).
- [ ] Create `app/not-found.tsx` — UDGOK Bold, "404 · Page not found", link back to dashboard.
- [ ] Test: visit dashboard, see properly styled empty state. Visit `/nonexistent`, see 404.
- [ ] Commit: `git add . && git commit -m "feat: dashboard placeholder + UDGOK-styled 404 page"`

---

## Phase 2 — CRM (Clients, Deals, Properties, Notes) + AI Scoring (Tasks 13–20)

After this phase: users can manage clients, create deals, move them through the pipeline, attach notes, and AI scores each deal automatically. End-to-end CRM works.

### Task 13: Client list + create

**Files:**
- Create: `app/(app)/w/[workspace]/clients/page.tsx`
- Create: `app/(app)/w/[workspace]/clients/actions.ts` (`createClientAction`, `archiveClientAction`)
- Create: `components/clients/ClientList.tsx`, `ClientRow.tsx`, `ClientSearchBar.tsx`
- Create: `lib/clients/queries.ts` (`listClients(workspaceId, filters)`)
- Create: `lib/clients/__tests__/queries.test.ts`

**Interfaces:**
- `listClients(workspaceId, { search?, status?, type? })` — returns paginated client list
- `createClientAction({ name, email?, phone?, type?, source? })` — RBAC: PM/ADMIN/OWNER/ESTIMATOR

**Steps:**
- [ ] Implement `lib/clients/queries.ts` with Prisma queries + filters.
- [ ] Write tests for `listClients` (search, filter, sort).
- [ ] Build the list UI per the design (search bar, filter chips, data table).
- [ ] Add "New client" button → opens a modal/form → calls `createClientAction`.
- [ ] Test: create a few clients, verify they show up in the list. Search works. Filter by status works.
- [ ] Commit: `git add . && git commit -m "feat: client list + create with search and filters"`

### Task 14: Client detail page

**Files:**
- Create: `app/(app)/w/[workspace]/clients/[id]/page.tsx`
- Create: `app/(app)/w/[workspace]/clients/[id]/actions.ts` (`updateClientAction`)
- Create: `components/clients/ClientHeader.tsx`, `ClientStatRow.tsx`, `ClientTabs.tsx`, `ClientTimeline.tsx`, `ClientPropertiesPanel.tsx`

**Interfaces:**
- `[id]` is the client ID; page fetches the client + properties + deals + tasks + files + notes
- 6 tabs: Overview, Deals, Projects, Tasks, Files, Notes
- Header has avatar (initials in copper circle), name, contact info, action buttons
- 4-cell stat row: Total Billed, Active, Margin, NPS (NPS = 9.4 default for now, v2)

**Steps:**
- [ ] Build the page server component that fetches all related data.
- [ ] Build the header, stat row, tabs.
- [ ] Build the timeline (fetch notes, render with the dot/cu styling from the design).
- [ ] Build the properties side panel.
- [ ] Test: click a client in the list, see the detail page with all sections rendered. Add a note, see it appear in the timeline.
- [ ] Commit: `git add . && git commit -m "feat: client detail page with timeline + tabs + properties"`

### Task 15: Properties (sub-form of clients)

**Files:**
- Create: `app/(app)/w/[workspace]/clients/[id]/properties/actions.ts` (`addPropertyAction`, `updatePropertyAction`, `deletePropertyAction`)
- Create: `components/clients/PropertyForm.tsx`, `PropertyCard.tsx`

**Interfaces:**
- Properties are nested under clients (always queried via `clientId`)
- `addPropertyAction({ clientId, label, address, city, state, zip, yearBuilt?, sqft? })`
- "Add property" button on the client detail side panel

**Steps:**
- [ ] Build the add/edit property form (modal or inline).
- [ ] Render properties in the side panel.
- [ ] Test: add a property to a client, see it appear. Edit it. Delete it.
- [ ] Commit: `git add . && git commit -m "feat: client properties (add, edit, delete)"`

### Task 16: Deals pipeline (kanban)

**Files:**
- Create: `app/(app)/w/[workspace]/deals/page.tsx`
- Create: `app/(app)/w/[workspace]/deals/actions.ts` (`createDealAction`, `updateDealAction`, `moveDealStageAction`, `closeDealAction`)
- Create: `components/deals/DealKanban.tsx`, `DealColumn.tsx`, `DealCard.tsx`
- Create: `lib/deals/queries.ts`, `lib/deals/__tests__/queries.test.ts`

**Interfaces:**
- 6 columns: LEAD, CONTACTED, ESTIMATE_SENT, NEGOTIATING, WON, LOST
- `moveDealStageAction({ dealId, newStage })` — RBAC: PM/ADMIN/OWNER/ESTIMATOR
- `closeDealAction({ dealId, won: boolean })` — sets `closedAt` and stage
- Drag-and-drop between columns (use `@dnd-kit/core`)

**Steps:**
- [ ] `pnpm add @dnd-kit/core @dnd-kit/sortable`
- [ ] Implement server actions and queries.
- [ ] Build the kanban with 6 columns, deal cards, drag-and-drop.
- [ ] Test: create deals, drag them between columns, close one (mark as WON), see it in the closed column.
- [ ] Commit: `git add . && git commit -m "feat: deals pipeline kanban with drag-and-drop"`

### Task 17: Deal detail page

**Files:**
- Create: `app/(app)/w/[workspace]/deals/[id]/page.tsx`
- Create: `app/(app)/w/[workspace]/deals/[id]/actions.ts`
- Create: `components/deals/DealHeader.tsx`, `DealStatRow.tsx`, `DealTasks.tsx`, `DealNotes.tsx`

**Interfaces:**
- Same shape as client detail — header, stats (value, margin, fit score, expected close), tabs (Tasks, Notes, Files, Activity)

**Steps:**
- [ ] Build the page per the design.
- [ ] Test: open a deal, see stats + tabs. Add a note, see it.
- [ ] Commit: `git add . && git commit -m "feat: deal detail page with stats + tasks + notes"`

### Task 18: Notes (polymorphic across client/deal/project)

**Files:**
- Create: `app/(app)/.../actions.ts` for each entity (`addNoteAction`)
- Create: `components/notes/NoteForm.tsx`, `NoteList.tsx`
- Create: `lib/notes/actions.ts` (shared `addNoteAction` that takes entity refs)

**Interfaces:**
- `addNoteAction({ clientId?, dealId?, projectId?, body })` — at least one of the entity refs is required
- Notes are append-only; no edit/delete in v1

**Steps:**
- [ ] Build the shared action.
- [ ] Build the note form (textarea + submit).
- [ ] Wire it into client detail, deal detail, project detail (Phase 3).
- [ ] Test: add a note on a client, see it in the timeline. Add on a deal, see it there too.
- [ ] Commit: `git add . && git commit -m "feat: notes (polymorphic across client/deal/project)"`

### Task 19: AI deal scoring (background)

**Files:**
- Create: `lib/ai/score-deal.ts` (`scoreDeal(dealId)` — generates fit score using Anthropic Haiku)
- Create: `lib/ai/__tests__/score-deal.test.ts` (mock the AI provider)
- Modify: `app/(app)/w/[workspace]/deals/actions.ts` `createDealAction` (call `scoreDeal` async fire-and-forget)

**Interfaces:**
- `scoreDeal(dealId): Promise<number | null>` — fetches the deal, builds a prompt with context, calls `@vercel/ai` with Anthropic, validates output with zod, writes to `Deal.fitScore`. Returns the score or null on failure.

**Steps:**
- [ ] `pnpm add @ai-sdk/anthropic @ai-sdk/openai ai zod`
- [ ] Implement `scoreDeal` per interface. Use Anthropic Haiku by default. Structured output (zod schema for 0-100 int).
- [ ] Hook into `createDealAction`: after creating the deal, fire `scoreDeal(dealId)` in the background (don't await — fire-and-forget with `.catch(console.error)`).
- [ ] Write tests with MSW mocking the AI provider.
- [ ] Test: create a deal, see `fitScore` populated within 3 seconds. The deal card in the kanban shows the FIT badge.
- [ ] Commit: `git add . && git commit -m "feat: AI deal scoring (background, structured output)"`

### Task 20: Dashboard wiring (real CRM data)

**Files:**
- Modify: `app/(app)/w/[workspace]/dashboard/page.tsx` (replace placeholders with real data)
- Create: `lib/dashboard/queries.ts`

**Interfaces:**
- Dashboard fetches: total revenue Q3, pipeline total, active jobs, margin, my tasks today
- Pipeline chart: 12 months of deal values grouped by month
- Closing this week: deals with `expectedClose` in next 7 days
- My tasks: tasks assigned to current user, sorted by due date

**Steps:**
- [ ] Build the queries.
- [ ] Wire up the dashboard with real data.
- [ ] Test: with some clients + deals + tasks, dashboard shows real numbers.
- [ ] Commit: `git add . && git commit -m "feat: dashboard wired to real CRM data"`

---

## Phase 3 — Tasks, Documents, Settings/Members (Tasks 21–26)

### Task 21: Tasks (kanban + list views)

**Files:**
- Create: `app/(app)/w/[workspace]/tasks/page.tsx`
- Create: `app/(app)/w/[workspace]/tasks/[id]/page.tsx`
- Create: `app/(app)/w/[workspace]/tasks/actions.ts` (`createTaskAction`, `updateTaskAction`, `updateTaskStatusAction`, `assignTaskAction`, `deleteTaskAction`)
- Create: `components/tasks/TasksBoard.tsx`, `TaskColumn.tsx`, `TaskCard.tsx`
- Create: `lib/tasks/queries.ts`, `lib/tasks/__tests__/queries.test.ts`

**Interfaces:**
- Same DnD pattern as deals — 5 columns: TODO, IN_PROGRESS, BLOCKED, REVIEW, DONE
- Each task can be linked to client, deal, OR project (nullable FKs)
- Status updates use optimistic UI

**Steps:**
- [ ] Implement queries and actions with RBAC.
- [ ] Build the board with drag-and-drop.
- [ ] Build the task detail page (modal or full page).
- [ ] Test: create tasks, drag between columns, assign to teammates.
- [ ] Commit: `git add . && git commit -m "feat: tasks board (kanban) with status updates and assignments"`

### Task 22: Documents library

**Files:**
- Create: `app/(app)/w/[workspace]/documents/page.tsx`
- Create: `app/(app)/w/[workspace]/documents/actions.ts` (`uploadFileAction`, `deleteFileAction`, `updateFileCategoryAction`)
- Create: `components/documents/DocumentSidebar.tsx`, `DocumentGrid.tsx`, `DocumentCard.tsx`, `UploadDropzone.tsx`
- Create: `lib/documents/queries.ts`, `lib/documents/__tests__/queries.test.ts`

**Interfaces:**
- Sidebar with category list (All, Brochures, Marketing, Floorplans, Contracts, Site Photos, Submittals, Invoices, Drawings) — counts per category
- Grid of file cards with type-specific icons
- Drag-drop upload zone
- `uploadFileAction({ file, kind, category?, clientId?, dealId?, projectId? })` — RBAC: all roles (FIELD can upload photos)

**Steps:**
- [ ] `pnpm add react-dropzone`
- [ ] Implement upload via Vercel Blob.
- [ ] Build the UI per the design.
- [ ] Test: upload a file, see it in the grid. Filter by category. Delete.
- [ ] Commit: `git add . && git commit -m "feat: documents library with upload, categories, and Vercel Blob"`

### Task 23: File attachments on client/deal/project/task (cross-cutting)

**Files:**
- Create: `components/files/FileAttachmentList.tsx`, `FileAttachmentPicker.tsx`
- Modify: client/deal/project/task detail pages to show attached files

**Interfaces:**
- The `File` model already has `clientId/dealId/projectId` (nullable). Task will need a `taskId` field added to the model (migration).
- Each detail page shows attached files in its "Files" tab.

**Steps:**
- [ ] Add `taskId` to `File` model in Prisma, run `db push`, regenerate client.
- [ ] Build the file attachment components.
- [ ] Wire into all 4 detail pages.
- [ ] Test: upload a file from the client detail "Files" tab, see it. Same for deal/project/task.
- [ ] Commit: `git add . && git commit -m "feat: file attachments across all entities"`

### Task 24: Settings — General (workspace name, industry, danger zone)

**Files:**
- Create: `app/(app)/w/[workspace]/settings/page.tsx`
- Create: `app/(app)/w/[workspace]/settings/actions.ts` (`updateWorkspaceAction`, `deleteWorkspaceAction`)

**Interfaces:**
- Edit workspace name + industry
- Danger zone: delete workspace (OWNER only, with confirmation modal)

**Steps:**
- [ ] Build the form per the design.
- [ ] Test: edit name, see it update. Delete workspace (with confirmation), verify it's removed.
- [ ] Commit: `git add . && git commit -m "feat: workspace settings (general, danger zone)"`

### Task 25: Settings — Members (invite, change role, remove)

**Files:**
- Create: `app/(app)/w/[workspace]/settings/members/page.tsx`
- Create: `app/(app)/w/[workspace]/settings/members/actions.ts` (`inviteMemberAction`, `updateMemberRoleAction`, `removeMemberAction`)

**Interfaces:**
- List of members with avatars, names, emails, current role
- Role dropdown per member (OWNER can change anyone, ADMIN can change non-owners, others can't)
- Invite form (email + role) — creates a Clerk org invitation
- Shareable invite link with token

**Steps:**
- [ ] Build the page per the design.
- [ ] Wire up Clerk's `createOrganizationInvitation` for invites.
- [ ] Handle role changes by updating Clerk `publicMetadata` AND our Membership table.
- [ ] Test: invite a user, change roles, remove. Verify in Clerk dashboard + DB.
- [ ] Commit: `git add . && git commit -m "feat: workspace members management (invite, role change, remove)"`

### Task 26: Onboarding → first-run checklist

**Files:**
- Modify: `app/(app)/w/[workspace]/dashboard/page.tsx` (show a "Get started" card for new workspaces)
- Create: `components/onboarding/FirstRunChecklist.tsx`

**Interfaces:**
- If the workspace was created < 7 days ago AND has < 3 clients, show a "Get started" card with 3-4 steps: Create client, Create deal, Invite team, Generate first pay app

**Steps:**
- [ ] Build the checklist component.
- [ ] Wire into dashboard.
- [ ] Test: new workspace, see the checklist. Complete a step, see it check off.
- [ ] Commit: `git add . && git commit -m "feat: first-run checklist for new workspaces"`

---

## Phase 4 — Projects, Schedule of Values, Pay Apps, Gantt (Tasks 27–34)

The heart of UDGOK's workflow. After this phase: full project + pay app loop works end-to-end.

### Task 27: Project list + create

**Files:**
- Create: `app/(app)/w/[workspace]/projects/page.tsx`
- Create: `app/(app)/w/[workspace]/projects/actions.ts` (`createProjectAction`, `updateProjectAction`, `archiveProjectAction`)
- Create: `components/projects/ProjectGrid.tsx`, `ProjectCard.tsx`, `NewProjectModal.tsx`
- Create: `lib/projects/queries.ts`, `lib/projects/__tests__/queries.test.ts`

**Interfaces:**
- Card grid (2 columns on desktop, 1 on mobile)
- Each card: project code, name, client, contract value, dates, % drawn, orange progress bar
- "New project" opens a modal with name + client (optional) + contract value (optional) + start/end dates

**Steps:**
- [ ] Implement queries and actions.
- [ ] Build the card grid per the design.
- [ ] Test: create projects, see them in the grid. Click one, navigate to project detail (Task 28).
- [ ] Commit: `git add . && git commit -m "feat: project list with card grid and create modal"`

### Task 28: Project dashboard (hero, KPIs, schedule, divisions)

**Files:**
- Create: `app/(app)/w/[workspace]/projects/[id]/page.tsx`
- Create: `app/(app)/w/[workspace]/projects/[id]/layout.tsx` (project shell with tabs)
- Create: `app/(app)/w/[workspace]/projects/[id]/actions.ts`
- Create: `components/projects/ProjectHero.tsx`, `ProjectKPIs.tsx`, `ProjectScheduleBar.tsx`, `ProjectDivisionsList.tsx`
- Create: `components/projects/ProjectTabs.tsx` (Overview, Financials, Schedule, Files, Team, Pay Apps)

**Interfaces:**
- Hero: code, name, client, NTP date, target completion, status badge
- 5 KPIs: Contract Value, Drawn, Balance, Margin, Due This Week
- Schedule bar: 20-week Gantt preview
- Division status list (left empty until Schedule of Values is built in Task 29)
- Tabs: Overview, Financials, Schedule, Files, Team, Pay Apps

**Steps:**
- [ ] Build the page per the design.
- [ ] Test: open a project, see hero + KPIs + schedule + tabs. Pay Apps tab is empty for now.
- [ ] Commit: `git add . && git commit -m "feat: project dashboard (hero, KPIs, schedule, tabs)"`

### Task 29: Schedule of Values (ProjectDivision CRUD)

**Files:**
- Create: `app/(app)/w/[workspace]/projects/[id]/financials/page.tsx`
- Create: `app/(app)/w/[workspace]/projects/[id]/financials/actions.ts` (`createDivisionAction`, `updateDivisionAction`, `deleteDivisionAction`, `reorderDivisionsAction`)
- Create: `components/projects/DivisionEditor.tsx`, `DivisionRow.tsx`
- Create: `lib/projects/divisions.ts` (`computeProjectTotals(projectId)` — returns `{ totalBudget, totalDrawn, totalBalance, percentComplete }`)

**Interfaces:**
- Editable table of divisions per project (code, trade, subcontractor, budget, sort order)
- Drag to reorder
- Compute totals on the fly by summing across all pay app divisions

**Steps:**
- [ ] Implement the table editor with drag-to-reorder.
- [ ] Build the totals computation.
- [ ] Test: add divisions to a project, reorder, edit, delete. See totals update.
- [ ] Commit: `git add . && git commit -m "feat: schedule of values editor with drag-to-reorder"`

### Task 30: Pay App list + create (auto-generate next draw)

**Files:**
- Create: `app/(app)/w/[workspace]/projects/[id]/payapps/page.tsx`
- Create: `app/(app)/w/[workspace]/projects/[id]/payapps/actions.ts` (`createPayAppAction` — the auto-generate function)
- Create: `components/payapps/PayAppsList.tsx`, `PayAppRow.tsx`
- Create: `lib/payapps/cumulative.ts` (`computePreviousAmounts(projectId, drawNumber)` — returns array of `{ projectDivisionId, previousAmount, balanceAfter }`)

**Interfaces:**
- `createPayAppAction({ projectId, periodStart, periodEnd })`:
  1. Get max `drawNumber` for the project, increment by 1
  2. Get all `ProjectDivision` rows for the project
  3. For each, compute `previousAmount` = sum of all prior `PayAppDivision.thisDrawAmount` for that division
  4. Compute `balanceAfter` = `budget - previousAmount` (the `thisDrawAmount` is 0 at creation)
  5. Insert `PayApp` + `PayAppDivision` rows in a transaction
  6. Return `{ payAppId }`

**Steps:**
- [ ] Implement the cumulative helper with proper SQL aggregation.
- [ ] Build the list UI per the design.
- [ ] Wire up "Generate Draw N" button.
- [ ] Test: create a project with SOV, generate Draw 1, see it with $0 this-draw and previous=$0. Set Draw 1 amounts. Generate Draw 2, see `previousAmount` pre-filled with Draw 1's totals.
- [ ] Commit: `git add . && git commit -m "feat: pay app list + auto-generate next draw with cumulative math"`

### Task 31: Pay App detail (edit, view)

**Files:**
- Create: `app/(app)/w/[workspace]/projects/[id]/payapps/[drawId]/page.tsx`
- Create: `app/(app)/w/[workspace]/projects/[id]/payapps/[drawId]/actions.ts` (`updatePayAppLineAction`, `updatePayAppNotesAction`, `markAsPaidAction`)
- Create: `components/payapps/PayAppDetail.tsx`, `PayAppDivisionRow.tsx` (editable), `PayAppSummary.tsx`

**Interfaces:**
- Same UDGOK-styled pay app design as the preview
- Editable `thisDrawAmount` per division (orange-bordered input)
- "Mark as paid" button (only enabled when status is SENT or VIEWED)
- Status badge in the send bar

**Steps:**
- [ ] Build the page per the design.
- [ ] Make the division inputs editable (optimistic updates).
- [ ] Test: open a pay app, edit amounts, see totals recalc. Mark as paid, status updates.
- [ ] Commit: `git add . && git commit -m "feat: pay app detail (editable divisions, totals, mark as paid)"`

### Task 32: Pay App — send to customer (Resend + share token)

**Files:**
- Create: `app/(app)/w/[workspace]/projects/[id]/payapps/[drawId]/actions.ts` (add `sendPayAppAction`, `resendPayAppAction`)
- Create: `components/emails/PayAppEmail.tsx` (React Email template)
- Create: `components/payapps/SendPanel.tsx` (the To/Subject/Message form)

**Interfaces:**
- `sendPayAppAction({ payAppId, to, subject, message })`:
  1. Generate shareToken (32 bytes base64url) if not already set
  2. Generate the PDF (Task 37 will build the proper PDF; for now generate a simple HTML-to-text version OR a placeholder PDF)
  3. Upload PDF to Vercel Blob
  4. Send email via Resend with `PayAppEmail` template
  5. Set `status=SENT`, `sentAt`, `sentToEmail`
  6. Return success

**Steps:**
- [ ] `pnpm add @react-email/components @react-email/render`
- [ ] Build the React Email template (UDGOK-styled, with secure link CTA).
- [ ] Implement the action.
- [ ] Build the Send Panel UI.
- [ ] Test: send a pay app, verify email arrives (use a real email for testing — Mailtrap or your own). Verify the share token is set in DB.
- [ ] Commit: `git add . && git commit -m "feat: send pay app to customer (Resend + share token)"`

### Task 33: Public share page (`/share/payapp/[token]`) + view tracking

**Files:**
- Create: `app/share/payapp/[token]/page.tsx` (public, no auth)
- Create: `app/api/payapp/[token]/view/route.ts` (view-logging endpoint)
- Create: `lib/payapps/views.ts` (`logPayAppView(token, metadata)` — append to `PayAppViewEvent`, update firstViewedAt + viewCount if null)
- Create: `components/payapps/PublicPayAppView.tsx`

**Interfaces:**
- `/share/payapp/[token]` renders the pay app with no app chrome, UDGOK-styled, with "✓ Acknowledge receipt" + "Download PDF" CTAs
- On mount, a client-side beacon fires `POST /api/payapp/[token]/view` (1×1 image, returns 204)
- View endpoint: looks up the pay app by token, inserts a `PayAppViewEvent` row, updates firstViewedAt + viewCount if needed
- "Acknowledge receipt" calls `acknowledgePayAppAction` (sets `acknowledgedAt` + status)

**Steps:**
- [ ] Build the public page.
- [ ] Build the view-logging API route.
- [ ] Build the public view component (mirror the GC's pay app detail but read-only).
- [ ] Test: open the share link in an incognito window, check the DB — `PayAppViewEvent` row created, `viewCount` incremented. Open the GC's pay app detail, see the view log.
- [ ] Commit: `git add . && git commit -m "feat: public share page + view tracking endpoint"`

### Task 34: View tracking UI in pay app detail

**Files:**
- Create: `components/payapps/ViewTrackingPanel.tsx`
- Modify: `app/(app)/w/[workspace]/projects/[id]/payapps/[drawId]/page.tsx` (add the panel)
- Create: `app/(app)/w/[workspace]/projects/[id]/payapps/[drawId]/actions.ts` (add `resendPayAppAction`, `regenerateShareTokenAction`)

**Interfaces:**
- Panel shows: First viewed timestamp + relative time, total views, unique viewers, full view log (timestamp, viewer email, device, IP for audit)
- Resend button (re-sends email with same link)
- Regenerate token button (invalidates old link, creates new one)

**Steps:**
- [ ] Build the panel UI per the design.
- [ ] Wire up resend + regenerate actions.
- [ ] Test: send a pay app, open the link in 2 browsers, see "2 views · 2 unique viewers" + the view log. Resend works. Regenerate invalidates the old link.
- [ ] Commit: `git add . && git commit -m "feat: view tracking UI + resend + regenerate share token"`

---

## Phase 5 — Gantt, 3D, PDF, Polish, E2E (Tasks 35–40)

The finish. After this phase: production-ready v1 with visual polish, E2E tests, deployed to Vercel.

### Task 35: Gantt schedule view

**Files:**
- Create: `app/(app)/w/[workspace]/projects/[id]/schedule/page.tsx`
- Create: `components/projects/GanttChart.tsx`, `GanttRow.tsx`
- Create: `lib/gantt/compute.ts` (`computeGanttRows(tasks)` — calculates bar positions by week)

**Interfaces:**
- Renders the Gantt chart from the design — task rows with bars by week
- 20 weeks visible, scrollable horizontally
- Bar colors: navy = done, orange = in progress, dashed gray = upcoming, red = blocked, orange diamond = milestone

**Steps:**
- [ ] Implement the bar position calculation.
- [ ] Build the Gantt chart UI.
- [ ] Test: with tasks on a project, see them in the Gantt with correct positions.
- [ ] Commit: `git add . && git commit -m "feat: Gantt schedule view"`

### Task 36: 3D scenes (Three.js + R3F)

**Files:**
- Create: `components/three/HeroBuilding.tsx`, `WorkspaceSwitcherEmpty.tsx`, `DashboardAccent.tsx`
- Create: `lib/three/scene-registry.ts`

**Interfaces:**
- All 3D components are client components, lazy-loaded via `next/dynamic` with `ssr: false`
- Use R3F + drei helpers, follow the design (wireframe buildings, copper accents)
- Respect `prefers-reduced-motion` — render a static fallback
- Each scene < 100KB JS, < 2s TTI

**Steps:**
- [ ] `pnpm add three @react-three/fiber @react-three/drei && pnpm add -D @types/three`
- [ ] Build the 3 scenes, mirroring the design.
- [ ] Wire into Login hero, Workspace switcher empty state, Dashboard top-right accent.
- [ ] Test: visit each location, see the 3D scene. Disable motion in OS settings, see the static fallback.
- [ ] Commit: `git add . && git commit -m "feat: Three.js scenes (hero building, workspace empty, dashboard accent)"`

### Task 37: PDF generation (pay app + summaries)

**Files:**
- Create: `lib/pdf/render.ts` (`renderPayAppPDF(payAppId): Promise<Buffer>`, `renderProjectSummaryPDF(projectId)`, etc.)
- Create: `components/pdf/PayAppPDF.tsx` (the @react-pdf/renderer template)
- Create: `components/pdf/ProjectSummaryPDF.tsx`, `ClientSummaryPDF.tsx`, `DealSummaryPDF.tsx`, `TaskListPDF.tsx`
- Create: `app/(app)/.../actions.ts` (add `renderPDFAction({ kind, id })` per entity)

**Interfaces:**
- All PDFs render server-side via @react-pdf/renderer, return a Buffer
- Pay app PDF matches the UDGOK Bold design exactly (dark navy header, orange "DRAW No. X", division table)
- "Save as PDF" button on every page marked with ✅ in spec section 4

**Steps:**
- [ ] `pnpm add @react-pdf/renderer`
- [ ] Build the 5 PDF templates.
- [ ] Wire the "Save as PDF" buttons.
- [ ] Test: generate each PDF type, download, verify the styling matches.
- [ ] Commit: `git add . && git commit -m "feat: PDF generation (pay app, project/client/deal/task summaries)"`

### Task 38: E2E tests (Playwright) + CI (GitHub Actions)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/auth.spec.ts`, `tests/e2e/crm.spec.ts`, `tests/e2e/payapp.spec.ts`, `tests/e2e/tasks.spec.ts`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Playwright config points at the Vercel preview URL
- 4 critical paths tested: sign up → workspace → dashboard, client → deal → WON, invite member, generate pay app → send
- CI runs unit + E2E on every PR

**Steps:**
- [ ] `pnpm add -D @playwright/test && pnpm exec playwright install`
- [ ] Write the 4 E2E specs.
- [ ] Set up GitHub Actions workflow: install pnpm, run unit, run E2E against preview.
- [ ] Add `DATABASE_URL` (test branch), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` as GitHub secrets.
- [ ] Test: open a PR, verify CI runs all checks.
- [ ] Commit: `git add . && git commit -m "chore: Playwright E2E tests + GitHub Actions CI"`

### Task 39: Polish — empty states, loading skeletons, error boundaries, 404/500

**Files:**
- Create: `app/error.tsx`, `app/global-error.tsx`, `app/(app)/error.tsx`
- Create: `components/ui/EmptyState.tsx`, `LoadingSkeleton.tsx`
- Modify: each list page to show a proper empty state when there's no data
- Modify: each list page to show a skeleton while loading

**Interfaces:**
- Route-level error boundaries render UDGOK-styled "Something went wrong" with retry
- Every list has a designed empty state (illustration, prompt, CTA)
- Every route shows a skeleton matching the final layout while data loads

**Steps:**
- [ ] Build the error boundaries.
- [ ] Build the empty state component.
- [ ] Build the skeleton component.
- [ ] Audit every page for proper empty/loading states.
- [ ] Test: empty workspace, see empty states. Slow connection, see skeletons. Trigger an error, see the boundary.
- [ ] Commit: `git add . && git commit -m "feat: empty states, loading skeletons, error boundaries"`

### Task 40: Deploy to Vercel + final verification

**Files:**
- Create: `vercel.json` (if needed for build settings)
- Modify: `package.json` (add `postinstall` for Prisma generate, add `vercel-build` script)

**Steps:**
- [ ] Connect the GitHub repo to Vercel (one click in Vercel dashboard).
- [ ] Add all the env vars from global constraints in Vercel project settings.
- [ ] Add a Neon database branch for the preview environment.
- [ ] Trigger a deploy. Verify the preview URL works.
- [ ] Run through the 4 critical user paths manually on the deployed preview.
- [ ] Tag the release: `git tag v0.1.0 && git push --tags`
- [ ] Commit: `git add . && git commit -m "chore: v0.1.0 deploy configuration"`

---

## End of Plan

40 tasks across 5 phases. Each task is independently testable and ends with a commit. The product ships after Phase 5 with: auth, workspace, CRM, tasks, documents, projects (with SOV, Gantt, Pay Apps), 3D accents, PDF generation, public customer view, view tracking, Resend email, Clerk auth, Vercel Blob, Neon DB, and UDGOK Bold design throughout.

**Open decisions before execution (defaults applied if no input):**
- Resend for email (default: Resend)
- Share link expiration: 90 days (default)
- Brand wordmark: UDGOK (default)
- Workspace industry: free text (default)
- Project member role: free text (default)
