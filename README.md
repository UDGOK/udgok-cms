# UDGOK CMS

Internal construction management CMS for UDGOK Construction. Built on the UDGOK Bold design system.

## Stack

- **Next.js 14.2** (App Router) + React 18 + TypeScript 5
- **Tailwind CSS 3.4** (UDGOK Bold theme)
- **Prisma 6.19** ORM + **Neon** Postgres
- **Clerk** for auth + organizations (= workspaces)
- **Vercel Blob** for file storage
- **Resend** for transactional email
- **@react-pdf/renderer** for PDF generation
- **React Three Fiber + drei** for 3D scenes
- **Vitest** + **Playwright** for testing

## Local development setup

### 1. Install dependencies

```bash
corepack enable pnpm
pnpm install
```

### 2. Provision Neon Postgres

1. Sign up at https://neon.tech (free tier is fine)
2. Create a new project: `udgok-cms-dev`
3. Copy the connection string from the Neon dashboard
4. Paste it into `.env` as `DATABASE_URL`

Then apply the schema:

```bash
pnpm db:push
```

### 3. Set up Clerk

1. Sign up at https://clerk.com and create a new application called "UDGOK CMS"
2. Enable **Organizations** in the Clerk dashboard (this is how workspaces work)
3. Copy the publishable key and secret key into `.env`
4. Set up a webhook endpoint (use the Clerk CLI to proxy locally or ngrok) and copy the signing secret into `.env`
5. Subscribe the webhook to: `user.*`, `organization.*`, `organizationMembership.*`

### 4. Set up Vercel Blob

1. In your Vercel project dashboard, go to Storage → Create → Blob
2. Copy the `BLOB_READ_WRITE_TOKEN` into `.env`

### 5. Set up Resend

1. Sign up at https://resend.com (free tier: 100 emails/day, 3,000/month)
2. Verify your sending domain (or use `onboarding@resend.dev` for dev)
3. Copy the API key into `.env` as `RESEND_API_KEY`
4. Set `RESEND_FROM_ADDRESS` to something like `noreply@udgok.app`

### 6. Run the dev server

```bash
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Build for production |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier (write) |
| `pnpm format:check` | Prettier (check) |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:push` | Apply schema to dev DB |
| `pnpm db:migrate` | Create a new migration |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Run the seed script |

## Project structure

```
/app
  /api/webhooks/clerk   Clerk webhook handler (Task 4)
  /(app)                 Authenticated app
  /(auth)                Sign-in / sign-up
/components
  /ui                    UDGOK Bold primitives
  /workspace             Sidebar, topbar, switcher
  /three                 3D scenes
/lib
  /db                    Prisma client
  /auth                  Clerk helpers, RBAC
  /workspace             Workspace context
/prisma
  schema.prisma          Full v1 schema
/docs
  /superpowers/specs     Design spec
  /superpowers/plans     Implementation plan
```

## Documentation

- **Design spec:** `docs/superpowers/specs/2026-08-16-handoff-cms-slice-b-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-08-16-udgok-cms-slice-b.md`
- **Visual design references:** `visual-pages/`
  - `cms-design-directions/index.html` — 4 design directions
  - `cms-architect-studio-deep/index.html` — Design system deep-dive
  - `cms-backend-ui/index.html` — 15-screen backend product UI
