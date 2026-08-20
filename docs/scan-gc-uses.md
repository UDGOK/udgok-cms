# What a GC should actually do with a barcode scanner on site

**For:** UDGOK Construction, Tulsa GC. Internal CMS at `/w/[workspace]/scan`.
**Question:** the scanner works, but there's no load-bearing use case yet. Which on-site workflows should a project manager, field engineer, or foreman reach for the scanner 5+ times a day for?
**Answer in one line:** **Material receiving against an open PO line**. That is the single daily, no-new-hardware, audit-trail-friendly flow that makes the scanner a tool instead of a curiosity. Build that first. Everything else is secondary.

---

## 1. Executive summary

A small-to-mid commercial GC runs a daily receiving problem: 2–12 deliveries per site, 5–30 line items per delivery, and the difference between what the invoice says and what actually showed up is a constant, painful, money-losing reconciliation problem three weeks later. Phones already have cameras. Most delivered materials (lumber, fasteners, electrical, plumbing, paint, drywall, fixtures, even rebar bundles) already have scannable UPCs on the label. The existing `Material` and `Equipment` models already store per-project codes and a running quantity. The existing `ScanEvent` already records who-scanned-what-when. The missing piece is the wire-up: when a foreman scans a code at the tailgate and the code already exists as a Material on this project, the system should ask "**+20 to quantity, $X total, on PO 4521?**" — not drop them on a "create new" form. That one decision — *scan against the project's own inventory first* — turns the scanner from a novelty into the receiving station. Tool check-in/out is a strong runner-up and the second thing to ship. Time tracking and OSHA safety inspections are real but later.

---

## 2. Top 3 recommended flows (ranked)

### Flow #1 — **Receiving** (build this first)

- **The trigger.** A delivery truck pulls up to the laydown yard. The foreman walks to the pallets with their phone. They scan each item's barcode as it comes off the truck. Sometimes 5 items, sometimes 50.
- **The flow.**
  1. Foreman opens `/w/[slug]/scan?projectId=XYZ` (link is in the project INVENTORY tab and the project header — already wired today).
  2. Camera starts. Foreman scans item 1.
  3. **The scan first hits the project's own `Material` and `Equipment` tables** (this lookup does not exist yet — current code only checks sub/project/client). If matched: show a **"Found in your inventory"** card with: item name, current qty on hand, the existing unit cost, and a single primary action: **"+ ___ to quantity"** with a delta field (default 1) and an optional PO/division field. The foreman taps "Add", the quantity bumps, a `MaterialDelivery` row is created (workspaceId, materialId, delta, poNumber?, divisionId?, scannedById, photoUrl?, createdAt), and the project inventory tab revalidates.
  4. If not in project inventory but the product catalog cache has it (UPCitemdb / Open Food Facts — already cached per workspace): same **"Add to inventory"** card as today, but with the new "qty delta" semantic so re-scanning the same code on this project *increments* instead of erroring.
  5. If not in any of the above: online lookup (UPCitemdb / OFF) as today, then drop to the existing `CreateInventoryFromScan` form.
  6. **Every step writes a `ScanEvent`** with `source = 'camera' | 'manual'`, the resolved match, and now (in this flow) the qty delta and PO/division. A delivery is therefore a small batch of `ScanEvent` rows in a single afternoon — perfect audit trail for "what was on this truck when it left the supplier."
  7. **Auto-drop a line into the project daily log**: "Delivered: +20 2x4 stud @ $4.50/ea = $90.00, PO 4521, scanned by John F. at 2:14pm." The log entry is a side effect of the ScanEvent batch; it gives the PM a real-time timeline of site activity without anyone writing a paragraph at the end of the day.
- **Why a GC cares.**
  - **Discrepancies caught at the tailgate, not three weeks later when the invoice arrives.** This is the entire pitch of every construction-receiving product on the market. From the Yukti barcode generator: *"When a delivery truck arrives, scanning the barcodes on received materials matches them against the purchase order. Discrepancies are caught immediately rather than discovered weeks later when the project manager reviews invoices and cannot reconcile the charges."* (Yukti, 2024) — the cost of one missed discrepancy ($2,000+ on a lumber drop) pays for the whole system for a year.
  - **Time saved on the receiving clipboard.** 3–5 minutes per delivery, per a support.construction reference procedure and industry standard. A medium Tulsa site doing 6 deliveries/day saves 20+ minutes/day of clerical work — half a labor-hour a day.
  - **Audit trail GCs are paranoid about.** "Who signed for that?" is the #1 question in any material-loss or damage dispute. The ScanEvent + PO link answers it in two clicks.
  - **Job-cost accuracy.** If the receiving row carries the `divisionId` (CSI cost code — your `ProjectDivision` table already exists), the cost posts to the right SOV line the moment the truck pulls away, not 30 days later when the AP clerk finally processes the invoice.
- **Data model impact.**
  - **One new model: `MaterialDelivery`.** Fields: `id`, `workspaceId`, `materialId`, `delta` (Decimal, can be negative), `poNumber` (string, optional), `divisionId` (string, optional, FK to `ProjectDivision`), `scannedById` (FK to `User`), `note` (string, optional), `photoUrl` (string, optional, Vercel Blob), `createdAt`. Indexes: `(materialId, createdAt)`, `(workspaceId, createdAt)`, `(poNumber)`.
  - **One small schema addition to `ScanEvent`**: add `delta: Decimal?` and `poNumber: String?` so the audit trail captures the receiving intent in one row, not two.
  - **No new routes.** The existing `/scan?code=…&projectId=…` flow gets a new lookup step (try `Material`/`Equipment` first), a new branch in `page.tsx` rendering a "Found in your inventory" card instead of the create form, and a new server action `recordMaterialDelivery(workspaceSlug, materialId, delta, poNumber?, divisionId?, note?, photoUrl?)`.
  - **One new view: per-project scan history.** The current `listRecentScansForWorkspace` is workspace-wide; add `listRecentScansForProject(workspaceId, projectId, limit)` and surface it on the project's INVENTORY tab.
- **Effort estimate: M (medium).** Two new server actions, one new model + migration, one new branch in the scan page render, one new "Found in your inventory" component, and the per-project history query. About 3–4 dev days if you also include the migration + tests.
- **Competitive reference.**
  - **Procore** does not have first-party barcode receiving. They expose the gap via the Procore App Marketplace — **QR Inventory** is a paid add-on whose entire pitch is "scan items at delivery, validate against the PO, post to Procore daily logs automatically" (QR Inventory + Procore integration page, 2024). UDGOK can ship this without the integration tax.
  - **Yukti** (construction barcode generator vendor) calls out PO-matching-on-receipt as the #1 barcode use case for construction in their free-tool landing page (Yukti, 2024).
  - **Cleverence** sells the same story for non-construction-vertical warehouses, but the workflow is identical: "scan at point of delivery, validate against PO, post to ERP" (Cleverence construction article, April 2025).
  - **SysGenPro's** "Construction Warehouse Automation" article identifies the exact failure mode UDGOK would solve: *"receiving materials against the wrong purchase order, incomplete lot or serial capture for regulated items, poor visibility into reserved stock for active projects"* — all solved by scan-at-receipt (SysGenPro, May 2026).
  - **support.construction's** "Material Receiving Procedure" is a 6-step field procedure (Prepare → Verify → Inspect → Document → Process → Store) that maps 1:1 to the receiving card design (support.construction, Feb 2026).

> **Sources for this flow:** Yukti construction barcode generator page (`withyukti.ai/free/barcode-generator-for-construction/`); QR Inventory + Procore integration page (`small-business-inventory-management.com/job-site-equipment-tracking-inventory-software-procore.htm`); Cleverence construction article (`cleverence.com/articles/use-cases/building-construction-scan-barcodes-of-materials-8137/`); SysGenPro construction warehouse automation article (`sysgenpro.com/construction-warehouse-automation-for-better-material-tracking-and-site-delivery-coordination`); support.construction Material Receiving Procedure (`support.construction/workflows/field-operations/material-receiving/`); QR Inventory construction overview (`small-business-inventory-management.com/inventory-asset-management/construction-inventory-asset-management.htm`).

---

### Flow #2 — **Tool Checkout** (build this second)

- **The trigger.** A carpenter needs the cordless drill and the laser level for a half-day on Level 2. They walk to the gang box, scan the QR on the tool case with their phone, scan their own crew QR to claim it, walk away. When they return at 4pm, they re-scan to check back in.
- **The flow.**
  1. Shop steward or foreman prints a sheet of unique QR codes (the UDGOK scanner page already accepts a generated QR as a code value; the admin just hands each one a unique cuid). Labels are stuck on every shared tool. One-time setup.
  2. To check out: open `/w/[slug]/scan`, scan the tool's QR.
  3. The code matches an `Equipment` row (projectId = null or = "shop"). The page now shows a **"Check out / Check in"** card with: tool name, condition (NEW/GOOD/FAIR/POOR), current holder (if any), and the primary action: **"Check out to <me> for project X"**.
  4. Tap → an `EquipmentCheckout` row is created: `id`, `workspaceId`, `equipmentId`, `checkedOutById`, `checkedOutAt`, `projectId` (optional — if used on a project), `dueAt` (optional, default end of week), `note`. The `Equipment.checkedOutToId` (a new FK) is set. A `ScanEvent` is written with `source = 'camera'`, `matched = 'equipment'`, `matchedId = equipmentId`.
  5. To check in: scan again → page reads the active `EquipmentCheckout` for that equipment → "Check in" button → sets `checkedInAt`, clears `Equipment.checkedOutToId`, opens the form to update condition if needed.
  6. **Visible where:** the project INVENTORY tab shows checkouts with timestamps ("Drill is with Mike on Project X, due Friday"). The shop view shows everything out. A late-return alert appears in the project activity log.
- **Why a GC cares.**
  - **Stops tool loss.** This is the single most common pain point cited in every tool-tracking product on the market. From GoCodes' product page: *"You're replacing $5,000–$10,000 worth of equipment every year"* (GoCodes tool tracking, 2024). Even recovering one stolen $400 impact driver per quarter pays for the labels.
  - **Ends the "who has it?" argument.** From Shelf's marketing: *"When a $2,000 camera goes missing, there is no custody trail showing who took it"* (Shelf, 2024). A scan log is the custody trail.
  - **Creates utilization data you can act on.** "Nobody's checked out the chop saw in 6 weeks" → sell it. "The miter saw is always out on Tuesdays" → buy a second one. GoCodes' check-in/out feature is built around exactly this report.
  - **OSHA / insurance posture.** Knowing where every power tool is and when it was last inspected is a meaningful improvement on your insurance questionnaire. From Yukti: *"Barcodes thoroughly monitor construction equipment and tools throughout their complete lifecycle as they are initially rented, actively used on-site, and eventually returned to storage facilities. This comprehensive tracking system provides exceptionally accurate records of usage patterns and maintenance schedules"* (Yukti, 2024).
- **Data model impact.**
  - **One new model: `EquipmentCheckout`.** Fields: `id`, `workspaceId`, `equipmentId`, `checkedOutById`, `checkedOutAt`, `checkedInAt?`, `projectId?`, `dueAt?`, `note?`. Indexes: `(equipmentId, checkedInAt)`, `(workspaceId, checkedOutAt)`, `(checkedOutById, checkedInAt)`.
  - **Two new columns on `Equipment`**: `checkedOutToId: String?` (FK to User) and `currentCheckoutId: String?` (FK to EquipmentCheckout). Backfilled null. These make "is this tool out right now and to whom?" a one-row query.
  - **No new routes.** Same `/scan` page, same `?code=` flow, new branch: match against workspace Equipment where the code maps to a tool (not a material). Render a new `EquipmentCheckoutCard` component.
  - **One new view: shop-wide open checkouts.** `listOpenEquipmentCheckouts(workspaceId)` for a "Tool Room" page or sidebar panel.
  - **One-time setup work (not in the M):** print QR labels and stick them on every shared tool. Done by the shop, not the app. ~30 minutes per trailer.
- **Effort estimate: M (medium).** One new model, two columns, one new branch in scan page, two new server actions (`checkoutEquipment`, `checkinEquipment`), one new view. ~3 dev days including tests.
- **Competitive reference.**
  - **GoCodes** ($30–50/mo at scale) is built around this exact flow: QR labels, smartphone scan, "check out to a person or project" with return date and email reminders for overdue items (GoCodes help center, "Check in and Out", June 2023).
  - **Shelf** (free, open source) does the same with a "scan, transfer custody, move on" UX; they explicitly cite sign-out-sheet failure as the problem to solve (Shelf, 2024).
  - **toolQR** ($15–$59/mo) ships the absolute minimum viable version: print label, scan to check out, scan to check in, with no app install required (toolQR.com, 2024). UDGOK's scanner UI is already a no-install phone-camera flow — we have a structural advantage.
  - **ShareMyToolbox** is the incumbent in this space for contractors; their whole pitch is "scan with a phone, audit tools in the field" (sharemytoolbox.com, 2024).
  - The GoCodes "Top Tool Check-In and Check-Out Systems Reviewed" article (Dec 2025) lists 8+ vendors all doing basically the same thing — proving this is the demand-tested workflow.

> **Sources for this flow:** GoCodes "Check in and Out" help article (`support.gocodes.com/en/articles/7974294-check-in-and-out`); GoCodes product page (`gocodes.com/solution/tool-tracking/`); Shelf equipment check-in (`shelf.nu/solutions/equipment-check-in`); toolQR homepage (`gettoolqr.com/`); ShareMyToolbox homepage (`sharemytoolbox.com/`); GoCodes "Top Tool Check-In and Check-Out Systems Reviewed" (`gocodes.com/tool-tracking/tool-check-in-check-out-system/`); Yukti construction barcode page (`withyukti.ai/free/barcode-generator-for-construction/`); Barkoder construction industry page (`barkoder.com/industries/construction`).

---

### Flow #3 — **Sub Time-Tracking / Site Entry** (build later, but design the data model for it now)

- **The trigger.** A sub crew pulls up to the site at 6:55am. The foreman scans a QR sticker on the truck (one per sub) as the crew walks in. At 4:30pm they scan again on the way out. Two scans = one timecard.
- **The flow.**
  1. Each subcontractor gets a unique QR code (the page already auto-matches `Subcontractor.id`). The QR is printed on a vinyl sticker for the truck or on a hard-hat sticker per foreman. `Subcontractor.idScanned` / `idScannedAt` flags in the schema are already half-built for this — finish the job.
  2. Scan → matches Subcontractor → "Clock in / Clock out" card (toggles based on whether the sub has an open `SubTimeEntry` for today).
  3. Clock in: `SubTimeEntry` row created: `id`, `workspaceId`, `subcontractorId`, `projectId` (optional, picked from active projects), `clockedInAt`, `clockedInById`, `clockedInLat?`, `clockedInLng?`.
  4. Clock out: same row, `clockedOutAt` set, plus a `note?` for the day's work. The entry rolls up to a weekly timecard view on the sub's page.
  5. **Visible where:** the subcontractor page shows this week's entries, totals, and which project the sub was on. The project's daily log gets a "Sub X on-site 6:55am–4:32pm" entry. The office payroll feed (later) can pull from this.
- **Why a GC cares.**
  - **Sub time fraud is a real, well-documented cost.** From Barkoder's construction industry page: *"Construction workers can conveniently scan personalized barcodes using standard mobile devices to accurately clock in and out of job sites, providing management with extremely precise data regarding actual hours worked on specific projects and effectively preventing potential time theft issues"* (Barkoder, 2024).
  - **Liability & prevailing wage.** If you're on a Davis-Bacon or Oklahoma state prevailing-wage job, you need a defensible record of who was on site when. A scan log is the defensible record.
  - **Foreman doesn't fill out a paper log.** Manual timecards get lost, edited after the fact, and disputed. A scan at the gate is harder to dispute.
- **Data model impact.**
  - **One new model: `SubTimeEntry`.** Fields: `id`, `workspaceId`, `subcontractorId`, `projectId?`, `clockedInAt`, `clockedInById`, `clockedInLat?`, `clockedInLng?`, `clockedOutAt?`, `clockedOutById?`, `clockedOutLat?`, `clockedOutLng?`, `note?`. Indexes: `(subcontractorId, clockedInAt)`, `(projectId, clockedInAt)`, `(workspaceId, clockedInAt)`.
  - **No new routes.** Same `/scan` flow, new branch: match against Subcontractor → render `SubClockCard`. Toggle "Clock in" / "Clock out" based on whether an open entry exists.
  - **No QR sticker generation** — the page can already print the workspace's sub list as a sheet of QRs (or use a third-party free QR generator the sub crew can print themselves). The web tool already exists in countless free QR generators; one is even called "Free Barcode Generator for Construction" (Yukti) and gives you printable Code 128 labels at no cost.
- **Effort estimate: M–L (medium-large).** A new model, a new branch in the scan page, two server actions, a per-sub timecard view. ~4–5 dev days. The L part is the geolocation prompt + offline queue + the "what if two subs are on the same truck" edge case.
- **Competitive reference.**
  - **Barkoder's** construction industry page explicitly lists "Time and attendance tracking" as one of the three core barcode use cases for construction, alongside material tracking and equipment tracking (Barkoder, 2024).
  - **The support.construction** field operations index treats time tracking and crew management as distinct procedures that need to be tracked in the field system (support.construction, 2026).
  - This is the weakest of the three competitive references because no one vendor "owns" this flow the way GoCodes owns tool checkout — but it's also the one with the least product maturity in the SMB GC market. UDGOK can carve out a niche here if they want to.

> **Sources for this flow:** Barkoder construction industry page (`barkoder.com/industries/construction`); Yukti construction barcode page (`withyukti.ai/free/barcode-generator-for-construction/`); support.construction Field Operations index (`support.construction/workflows/field-operations/`).

---

## 3. Quick wins (M-effort or less, no new models)

These ship in a week and don't require any schema changes. They get the scanner used 3–5x more per day before the big flows land.

- **Try the project's own `Material` and `Equipment` first.** Today the scan page only checks `Subcontractor`, `Project`, `Client`. Add two more `prisma.findFirst` calls in `page.tsx` — one against `Material` and one against `Equipment`, scoped to the workspace (and the `?projectId` if present). If matched, jump to that row in the project's INVENTORY tab instead of dropping the user on a create form. **This alone turns the most common scan (re-scanning a code that's already on the project) into a one-tap "go to it" flow.** ~half a day.

- **"Increment qty" instead of always "create new" on duplicate code.** The current `createMaterialAction` errors out with `"Code already exists on this project"` (see `lib/inventory/actions.ts:80-86` and the duplicate check at lines 94-105). The error is the worst possible UX for a foreman who just got a delivery of more 2x4s. Replace the error with a "you already have this material; add ___ to quantity" prompt. This is a change to the same action, not a new model. ~one day.

- **Recent scans scoped to the current project.** `listRecentScansForWorkspace` exists and is wired into the `ScanPageClient` panel. Add `listRecentScansForProject(workspaceId, projectId, limit)` and render it as a small panel on the project's INVENTORY tab. The foreman sees "this morning I scanned 3 deliveries into this project" without leaving the project page. ~half a day.

- **"Recent project" sticky in the scanner.** When the user opens `/scan` with no `projectId`, pre-select their most recently active project in the project dropdown. Today the form has to ask "which project?" every time, even though 90% of scans are for one site. ~2 hours.

- **Better default form prefill when the catalog hits.** The current `CreateInventoryFromScan` already accepts `prefilled.name/description`. Extend `lookupProduct` to also pull `manufacturer` and `category` into the form. A pre-filled material entry drops from 12 fields typed to 4. ~half a day.

- **Switch the recent-scans `source` default from `'manual'` to actual source for camera scans.** Look at the page.tsx comment at line ~60 — the `?code=` path always writes `source: 'manual'`, even when the user came from a camera scan. Add a `?source=camera` query param and respect it. The "who used the camera vs. typed" metric is the only way to tell which entry path is working. ~1 hour.

- **A `Materials received this week` line on the project header.** One server component, one Prisma group-by query, one number. PM sees at a glance whether the project is "on track to receive" vs. "behind on materials." Bonus: surface the `MaterialDelivery` rows here once Flow #1 lands. ~half a day.

- **Make the "what to scan" examples more obvious on the empty scanner UI.** The current `BarcodeScanner` view says "Point your camera" with no examples. Add 2–3 chips below the manual input: `[ + Receive materials ] [ + Check out a tool ] [ + Look up a project ]` that route to the right flow. Discovery is the silent killer. ~2 hours.

**Total quick-wins effort: ~3 dev days.** Ship these together the same week the bigger Flow #1 lands, or ship them as a "while we build Receiving" interim release.

---

## 4. What I'd build first if it were my call

**Flow #1 — Receiving.** Build the material-receiving flow against the project's own `Material` table first, with a `MaterialDelivery` model and an `incrementMaterialQuantity` server action that wraps a transaction.

The argument is that this is the *only* flow that:
1. Hits the scanner 5+ times a day, every day, on a live site (deliveries don't stop).
2. Pays for itself on the first day (one caught discrepancy on a lumber drop is worth the whole feature).
3. Needs no new hardware (phone camera; most materials are already barcoded at the manufacturer).
4. Costs the least to build (the `Material` model is already shaped correctly; the `ScanEvent` is already there; only the wire-up and one new model are missing).
5. Has a clear audit trail a lawyer can read in a dispute (the ScanEvent + MaterialDelivery pair is the paper trail).
6. Has a real competitor (QR Inventory's whole business model is "do this against Procore") which validates the demand.

Tool checkout is a strong #2 because it's the same shape of work (scan against existing row, persist a new event) and reuses the same scan page infrastructure. The two flows together share ~70% of the new code (the new "found in your inventory" branch, the new "this row has history" subview, the new ScanEvent enrichment). They can ship in the same sprint, with tool checkout as the lower-trailing edge.

Time tracking is genuinely valuable but has more edge cases (multiple subs on one truck, geolocation prompting, offline mode for a remote site, integration with whatever payroll UDGOK uses). It's the right thing to design the data model around now, but the wrong thing to ship first.

### "Ship in one week" sketch for Flow #1

**Goal:** A foreman on site can scan a code that's already on their project and have the project's inventory quantity increment, with a PO number captured, in under 10 seconds.

**Files that change:**
- `prisma/schema.prisma` — add `MaterialDelivery` model; add `delta: Decimal?` and `poNumber: String?` to `ScanEvent`.
- `prisma/migrations/<date>_material_delivery/migration.sql` — generated.
- `app/(app)/w/[workspace]/scan/page.tsx` — add a 4th lookup step (try `Material` then `Equipment` for the current project) and a new render branch for the "Found in your inventory — receive items" card.
- `app/(app)/w/[workspace]/scan/ReceiveDeliveryCard.tsx` (new) — the card with project, code, name, current qty, a `delta` number input, optional `poNumber`, optional `divisionId` (dropdown of `ProjectDivision` for the project), optional `note`, optional photo. Calls the new server action. Reads `EquipmentCondition` if it's a tool that needs condition update.
- `app/(app)/w/[workspace]/scan/CreateInventoryFromScan.tsx` — change the duplicate-code error path to render a "you already have this; increment" inline form (this is the half-day quick win above).
- `lib/inventory/actions.ts` — add `recordMaterialDelivery(workspaceSlug, materialId, delta, poNumber?, divisionId?, note?, photoUrl?)`. Wraps a `prisma.$transaction([update material.quantity, create MaterialDelivery, create ScanEvent])`. Returns the new delivery id.
- `lib/inventory/queries.ts` — add `listRecentDeliveriesForProject(projectId, limit)`. Used by the project's INVENTORY tab.
- `app/(app)/w/[workspace]/projects/[id]/InventoryTab.tsx` — add a "Recent deliveries" panel below the materials table, showing the last 10 `MaterialDelivery` rows with timestamps, qty delta, PO, and the scanner user.
- `lib/scans/queries.ts` — add `listRecentScansForProject(workspaceId, projectId, limit)`. Used by the new InventoryTab panel.
- `components/scan/BarcodeScanner.tsx` — no changes (already does the right thing).
- `__tests__/inventory/receive-delivery.test.ts` (new) — happy path, duplicate-code → increment (not error), wrong-project guard, PO optional, division optional, photos optional, atomicity (if ScanEvent insert fails, Material.quantity is not bumped).

**Models that move:**
- `MaterialDelivery` is new.
- `ScanEvent.delta` and `ScanEvent.poNumber` are new columns.
- Nothing else changes. `Material`, `Equipment`, `Project`, `Subcontractor`, `ProjectDivision`, `ProjectPhoto` are all reused as-is.

**What the user sees (foreman flow):**
1. Tap "Open scanner" on the project's INVENTORY tab. The URL is `/w/<slug>/scan?projectId=<id>`.
2. Camera starts. Scan a 2x4 stud bundle.
3. The page does the local lookup. Finds the existing Material row for that code on this project. Renders the **"Receive items"** card with: name, current qty (e.g. 30 boards), and an input "Add ___" defaulted to the count on the delivery slip in the foreman's hand.
4. Foreman types 50, taps the PO field and picks PO 4521, taps "Record delivery."
5. Toast: "Added 50 2x4 stud to Project Acme. Total: 80."
6. The page revalidates. The INVENTORY tab's materials table now shows 80 boards. The "Recent deliveries" panel below shows the new row: `+50 · PO 4521 · 2:14pm · John F.`
7. Foreman scans the next bundle. The page now remembers the project + the PO (sticky for the session) and the only thing typed is the qty. A 20-line delivery takes 4–5 minutes instead of 20.

That's it. Ship it.
