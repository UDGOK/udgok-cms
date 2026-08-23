# Change Orders for UDGOK Construction — Research & Build Spec

**Purpose:** Opinionated design input for the UDGOK Change Order feature, based on AIA standard forms and Oklahoma practice. This is build spec, not a paper.

---

## 1. The forms, in one page

**AIA G701–2017 — Change Order.** The executed instrument that *amends* the contract. One page, three sections: (1) project header (parties, contract date, CO number, CO date), (2) "The Contract is changed as follows" with a free-form description plus attachments, (3) the running-totals block:

1. Original Contract Sum / GMP
2. Net change by previously authorized Change Orders
3. Contract Sum prior to this Change Order (= 1 + 2)
4. Increase / decrease by this Change Order
5. New Contract Sum including this Change Order (= 3 ± 4)
6. Contract Time change (calendar days)
7. New Substantial Completion date

Signed by **Owner, Contractor, and Architect** (or CM-at-Risk). Without all three signatures, the document is not an executed amendment under standard AIA A201 §7 — it's a PCO at best. ([Procore G701 guide](https://www.procore.com/library/guide-aia-g701-change-order), [AIA G701 instructions](https://help.aiacontracts.com/hc/en-us/articles/1500009322061-instructions-g701-2017-change-order))

**AIA G702 / G703 — Pay App.** G702 is the one-page cover (Original Contract Sum, Net Change by COs, Current Contract Sum, Total Completed and Stored, Retainage, Previous Payments, Current Payment Due, architect's certification block). G703 is the multi-page continuation sheet — one row per SOV line with scheduled value, work completed this period, materials stored, total completed, % complete, balance to finish, retainage. ([AIA G703 instructions](https://help.aiacontracts.com/hc/en-us/articles/1500009308302-instructions-g703-1992-continuation-sheet))

**How G701 ↔ G702/G703 connect:** the G703's "Change Orders" sub-section (or appended second G703) lists every approved CO. Their totals roll up to **G702 Line 2 (Net change by Change Orders)**. After execution, you append new SOV lines for the CO scope at the bottom of the G703 — you do **not** retroactively edit existing lines. "Only fully executed change orders should adjust the Schedule of Values. Pending or disputed amounts may be tracked internally, but they should not alter the official contract baseline used for billing." ([Buildern on G703](https://buildern.com/resources/blog/aia-g703/), [Finlock G702/G703 walkthrough](https://finlock.us/blog/aia-g702-g703-explained))

**AIA G714–2017 — Construction Change Directive (CCD).** Different instrument. Owner + architect sign unilaterally to direct work *before* price/time is agreed. Contractor proceeds under protest, gets paid on documented cost; the CCD converts to a G701 once parties reconcile. You should support CCDs as a *sibling* lifecycle to PCOs. ([AIA Contracts: CCD vs CO](https://learn.aiacontracts.com/articles/construction-change-directive-vs-change-order/))

**Numbering convention.** `CO-001`, `CO-002`, … sequential per project, never skip a number (auditors check gaps). For CCDs use `CCD-001`. For PCOs use `PCO-001`. These are separate counters; a PCO that becomes a CO gets a new CO number when executed. PCOs are project-management records, not contract instruments. ([Cogram: CO/CCD/PCO](https://cogram.com/glossary/change-order))

---

## 2. Recommended state machine

The simple DRAFT → SUBMITTED → APPROVED → INCLUDED_IN_PAY_APP is incomplete for real jobs. Here's what to build:

```
DRAFT
  └─> SUBMITTED        (sent to owner/architect; lock content, start clock)
        ├─> UNDER_REVIEW      (PM/architect has questions)
        │     └─> REVISED     (re-submitted; bumps revision #, new SUBMITTED)
        ├─> PARTIALLY_APPROVED  (owner approves part; the rest goes back to UNDER_REVIEW)
        ├─> APPROVED           (full sign-off; bumps contract sum & time)
        ├─> REJECTED           (terminal; can be re-opened as a new PCO)
        └─> WITHDRAWN          (GC pulls it; terminal)
APPROVED
  └─> INCLUDED_IN_PAY_APP  (links to one or more PayApp rows; terminal for the CO)
APPROVED
  └─> SUPERSEDED            (a revised CO replaces it; preserves history)

Side chain (parallel to CO):
PCO (potential change order) — always a log row, never a contract instrument
  └─> converts to CO when executed (new CO number)
  └─> converts to CCD if owner needs to proceed before price settled
  └─> VOIDED if rejected and not pursued
```

**Why these states:** Partial approvals are common on owner change orders (the owner accepts 60% of the cost and rejects the rest). Superseded matters because the same scope often gets re-priced two or three times before the parties land — you must keep history. Retroactive COs (work done, CO signed later) are *legal* if the contract allows it but should be flagged for the user. The `REVISED` state with a revision counter handles the 90% case where the GC sends a draft, owner asks for backup, GC revises, resubmits — without losing v1.

**Rules the system should enforce:**

- Cannot move to APPROVED without `originalContractSum`, `netPriorCOs`, `currentCOAmount`, and `timeImpactDays` populated.
- Cannot move to APPROVED without `ownerSignedBy` and `ownerSignedAt` (and architect, if the contract requires it).
- APPROVED triggers a recompute of `project.currentContractSum` and `project.substantialCompletionDate` — do this in a transaction, not in app code.
- A CO with `timeImpactDays > 0` cannot be APPROVED without `scheduleImpactNote` populated.
- Cannot link an APPROVED CO to a PayApp that is already `certified` (closed). If you need to bill it, open a new PayApp or a separate off-cycle draw.

---

## 3. Recommended schema (Prisma)

UDGOK already has `Project → Division (SOV) → PayApp`. COs slot in as a peer entity that *mutates* the project baseline and *appends* SOV lines.

```prisma
model ChangeOrder {
  id                    String   @id @default(cuid())
  projectId             String
  number                String               // "CO-001", per project
  revision              Int      @default(1) // bumped on each re-submit
  status                COStatus
  type                  COType              // ADDITIVE | DEDUCTIVE | NEUTRAL | TIME_ONLY
  pricingMethod         PricingMethod       // LUMP_SUM | UNIT_PRICE | T_M | COST_PLUS

  // Description / narrative
  title                 String              // short label
  description           String              // full G701 §2 text
  reasonCode            ReasonCode?         // OWNER_REQUEST | RFI | ASI | DIFFERING_SITE_CONDITION | CODE_REQUIREMENT | DESIGN_OMISSION | FIELD_CONDITION
  triggeringRfiId       String?             // link to RFI
  triggeringAsiId       String?             // link to ASI
  ccdId                 String?             // if this CO settles a CCD

  // AIA G701 §3 running totals — SNAPSHOTS at the moment of approval
  originalContractSum   Decimal             // snapshot
  netPriorCOs           Decimal             // sum of approved COs before this one
  priorContractSum      Decimal             // originalContractSum + netPriorCOs
  thisCOAmount          Decimal             // signed delta
  newContractSum        Decimal             // priorContractSum ± thisCOAmount

  // Time
  timeImpactDays        Int      @default(0)
  priorSubstantialCompletion Date?
  newSubstantialCompletion   Date?

  // Pricing details (method-specific JSON; keep auditable)
  lumpSumBreakdown      Json?               // [{code,description,labor,material,equipment,sub,markup}]
  unitPriceLines        Json?               // [{item,unit,qty,unitPrice,extended}]
  tmNotToExceed         Decimal?            // T&M ceiling
  tmMarkupPct           Decimal?            // 15-25 typical
  tmLaborRateCard       Json?               // [{role,hourlyRate}]

  // Approvals
  submittedAt           DateTime?
  submittedByUserId     String?
  ownerApprovedAt       DateTime?
  ownerApprovedByUserId String?
  ownerSignatoryName    String?
  architectApprovedAt   DateTime?
  architectApprovedByUserId String?
  architectSignatoryName String?
  rejectedAt            DateTime?
  rejectionReason       String?

  // Pay app integration
  payAppLines           ChangeOrderPayAppLine[]

  // SOV side — these are the resulting Division rows from THIS CO
  resultingSovLineIds   String[]            // array of Division.id that this CO created

  // History / soft supersession
  supersedesId          String?             // points to prior CO this replaces
  supersededById        String?             // inverse
  notes                 String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  createdByUserId       String

  project               Project             @relation(fields: [projectId], references: [id])
  supersedes            ChangeOrder?        @relation("COSupersession", fields: [supersedesId], references: [id])
  supersededBy          ChangeOrder?        @relation("COInvSupersession", fields: [supersededById], references: [id])

  @@unique([projectId, number])             // one CO number per project
  @@index([projectId, status])
  @@index([projectId, createdAt])
}

model ChangeOrderPayAppLine {
  id              String   @id @default(cuid())
  changeOrderId   String
  payAppId        String
  sovDivisionId   String                  // the G703 line that bills this CO
  billedAmount    Decimal                 // amount drawn this pay app
  billedPct       Decimal                 // 0-100
  retainageAmount Decimal

  changeOrder     ChangeOrder @relation(fields: [changeOrderId], references: [id])
  payApp          PayApp      @relation(fields: [payAppId], references: [id])
  sovDivision     Division    @relation(fields: [sovDivisionId], references: [id])

  @@unique([changeOrderId, payApp, sovDivisionId])
}

enum COStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  PARTIALLY_APPROVED
  REVISED
  APPROVED
  INCLUDED_IN_PAY_APP
  REJECTED
  WITHDRAWN
  SUPERSEDED
}

enum COType    { ADDITIVE DEDUCTIVE NEUTRAL TIME_ONLY }
enum PricingMethod { LUMP_SUM UNIT_PRICE T_M COST_PLUS }
enum ReasonCode {
  OWNER_REQUEST RFI ASI DIFFERING_SITE_CONDITION
  CODE_REQUIREMENT DESIGN_OMISSION FIELD_CONDITION OTHER
}
```

**Three SOV-relation patterns this schema supports:**

1. **Delta to existing SOV line** — `thisCOAmount` is non-zero, but no new `resultingSovLineIds` are added. The `lumpSumBreakdown` records which existing Division the cost is hitting. Bill via `ChangeOrderPayAppLine` pointing at that existing Division.
2. **Adds new SOV line(s)** — `thisCOAmount > 0`, `resultingSovLineIds` lists new Division rows created when the CO was approved. These new Divisions sit at the bottom of the SOV (G703 convention) and participate in all future pay apps identically to original-scope lines.
3. **Time extension only** — `type = TIME_ONLY`, `thisCOAmount = 0`, `timeImpactDays > 0`. The CO just rolls forward `project.substantialCompletionDate`. No SOV mutation. This is the cleanest way to handle a "no-cost schedule extension" CO, which owners love to issue as separate documents.

**Do NOT also add a `Contract` table.** The "contract" is just the original `Project.originalContractSum` + the sum of APPROVED COs. That's it. A separate Contract entity adds nothing and forces a join. If you ever need to model multiple prime contracts on one project (very rare), revisit then.

---

## 4. Sample data — three real COs

**CO-001 — Additive, lump sum, owner-requested upgrade**
- Project: Riverside Office Tower, Tulsa
- Number: `CO-001`, status: `APPROVED`
- Type: `ADDITIVE`, Pricing: `LUMP_SUM`
- Reason: `OWNER_REQUEST`
- Description: "Upgrade lobby finishes per Owner directive 2026-03-12: switch from LVT to porcelain tile (TCNA Method E) in main lobby + elevator cab floors. Includes substrate prep and revised transition strips at vestibule."
- Triggering RFI/ASI: ASI-007
- Original contract sum: $12,400,000
- Net prior COs: $0
- This CO amount: **+$87,420**
- New contract sum: $12,487,420
- Time impact: **+8 calendar days** (porcelain lead time + curing)
- New substantial completion: 2026-11-14 (was 2026-11-06)
- Backup: sub quote (Tulsa Tile Co. $71,200), material cut sheet, revised finish schedule SK-A-401
- Signatures: Owner (VP Construction, signed 2026-03-22), Architect (signed 2026-03-21), GC PM (signed 2026-03-19)
- Resulting SOV lines: appended 1 new Division `CO-001 Lobby Finish Upgrade` with scheduled value $87,420

**CO-002 — Deductive, scope delete**
- Project: Riverside Office Tower, Tulsa
- Number: `CO-002`, status: `APPROVED`
- Type: `DEDUCTIVE`, Pricing: `LUMP_SUM`
- Reason: `OWNER_REQUEST`
- Description: "Owner elected to omit rooftop amenity deck (6,200 SF). Delete Division 03-30 cast-in-place deck topping, 06-10 wood decking, 07-54 TPO at amenity area, 32-90 plantings. Retain structural slab; reduce dead load note in structural calcs."
- Original contract sum: $12,487,420 (post CO-001)
- Net prior COs: +$87,420
- This CO amount: **−$184,900**
- New contract sum: $12,302,520
- Time impact: **−6 calendar days** (less work on critical path)
- New substantial completion: 2026-11-08
- Signatures: all three parties, dated 2026-04-04
- Resulting SOV lines: no new lines; the existing amenity-deck Division rows have their scheduled values reduced by credit (document the credit in the CO backup, not in the original SOV rows)

**CO-003 — T&M, differing site condition, time extension only companion**
- Project: Riverside Office Tower, Tulsa
- Number: `CO-003`, status: `SUBMITTED` (in the state machine, not yet approved)
- Type: `ADDITIVE`, Pricing: `T_M`
- Reason: `DIFFERING_SITE_CONDITION`
- Description: "Encountered undocumented fill with organic content below footing F-12 at NE corner. Geotech recommendation: over-excavate 4' deeper than plan, replace with structural fill, re-compact. Work began 2026-05-18 under verbal direction + daily T&M tickets signed by owner's rep on-site."
- This CO amount: T&M, not-to-exceed **$42,000**, TM markup 18%
- T&M labor rate card: Foreman $78/hr, Operator $72/hr, Laborer $54/hr
- Backup: 12 daily T&M tickets (each signed), 4 geotech field reports, photo log, equipment rental invoices ($3,180 so far)
- Time impact: **+4 calendar days** (excavation + re-compaction)
- Status notes: Submitted 2026-05-22, owner requested additional backup on 2026-05-29, revised & resubmitted 2026-06-02 → status `REVISED` → `SUBMITTED` with revision=2
- Linked future companion: PCO-009 will become `CO-003a` (TIME_ONLY) once the dollar figure finalizes

This is what real CO work looks like. The first is the textbook case, the second shows deductive handling, the third shows T&M with revision cycles and a time-only companion split.

---

## 5. Pricing methods — what to capture

- **Lump sum (LS):** one number, breakdown in `lumpSumBreakdown` JSON (labor, material, equipment, sub, markup). Markup stacks: GC on own forces 15–19% (10–12% OH + 5–7% profit), GC on sub work 8–12% total, subs 20–25%. Many institutional contracts (Tulsa Public Schools, OSU, OU) cap total stacked markup at 20%. ([PILARS on T&M vs LS](https://pilars.ai/blog/change-orders-tm-vs-lump-sum-profit), [Tasktag on CO management](https://blog.tasktag.com/construction-change-order-management))
- **Unit price (UP):** per-unit rate (SY, LF, CY, EA) referenced to original bid unit prices or negotiated market rates. Capture in `unitPriceLines` JSON. Quantities verified at execution (owner + GC measure together).
- **T&M:** actual cost + markup. **Require** the `tmNotToExceed` ceiling and the `tmLaborRateCard` snapshot. In production, link to daily T&M ticket records (you'll want a `TMTicket` table — add later). Worker hours must be clocked to the CO cost code from the moment work starts, not reconstructed.
- **Cost-plus / GMP:** mostly a contract-type concept, not a CO pricing method. If you need it, treat as a T&M with explicit fee. Don't build a separate code path.

**Markup rules:** store the contract's negotiated markup structure on `Project` (e.g., `gcOHPercent = 10`, `gcProfitPercent = 5`, `subMarkupPercent = 5`). Compute `thisCOAmount` from `lumpSumBreakdown` on save so the field is always consistent. Let users override the computed value but warn loudly.

---

## 6. Owner approval

**Who signs:** Under AIA A201-2017 §7, the CO requires Owner, Contractor, and Architect signatures. In design-build or CM-at-Risk, the architect block may be replaced by the CM. Owner signature authority is often limited by dollar threshold — a $10K CO might be the owner's project manager, but a $500K CO requires the VP of Construction or the Board (especially on public/Tulsa Public Schools work). Capture `ownerSignatoryName` and the signer's title in the audit log. ([Procore G701 guide](https://www.procore.com/library/guide-aia-g701-change-order))

**How much detail:** the G701 itself is one page. The detail lives in the *attachment* — sub quotes, material invoices, revised drawings, the RFI/ASI that triggered the change, the daily T&M log, the geotech report, the markup breakdown. The CO body should reference attachments by exhibit number. Most disputes are won or lost on the quality of those attachments, not the G701 text.

**Contract interaction:** an executed G701 *amends* the original contract. It becomes part of the contract documents and the new `originalContractSum + netPriorCOs` baseline is what future COs run against. The system should treat `Project.currentContractSum` as a *derived* value, recomputed on every APPROVED CO, not a free-editable field. Owner reps who try to edit `currentContractSum` directly are doing it wrong.

**Verbal direction:** owners constantly direct changes verbally. The system should support a "Field Directive" or "Verbal Direction Log" — separate from the CO. Every verbal direction gets a date, a name, a description, and a deadline to convert to a PCO. If you don't capture verbal directions, you'll discover at closeout that the owner "doesn't remember approving" the change.

---

## 7. Time extensions

`timeImpactDays` is calendar days, not working days (AIA convention). Store both on the CO for safety:

- `timeImpactDays` (calendar) — drives `newSubstantialCompletionDate`
- `timeImpactWorkingDays` (optional) — for owner contracts that count working days

The system must:

1. Recompute `Project.substantialCompletionDate` on every APPROVED TIME_ONLY or time-bearing CO, as `priorSubstantialCompletionDate + timeImpactDays`.
2. If the CO is purely time, `thisCOAmount = 0` and `type = TIME_ONLY`. Don't let users bury time in cost COs — it kills billing reconciliation.
3. Flag concurrent delay: if two COs both claim +10 days but the path can only absorb +12, warn. You don't need a full CPM engine, just a `totalApprovedTimeImpact` counter on the project.
4. Linking to schedule: don't try to model the full schedule in UDGOK. Capture `scheduleImpactNote` (free text) and a `narrativeTimeline` field for time-impact analyses (TDOT-style). The construction team keeps the P6/Asta file; UDGOK just records the contractual time delta.

---

## 8. Gotchas — what real GCs get wrong

1. **Skipping CO numbers.** Auditors and owners both check for gaps. Number sequentially, no exceptions. Block DRAFT creation that doesn't reserve the next number.
2. **Editing the SOV in place instead of appending.** Per AIA G703 instructions, COs are *appended* to the SOV as new lines, never merged into existing lines. UDGOK must enforce this; it's the #1 reason pay apps get kicked back.
3. **Including unexecuted COs in G702 Line 2.** Only APPROVED COs roll up to the pay app. Pending/disputed COs are tracked on the PCO log and excluded from the billing math.
4. **Forgetting time impact.** A cost-only CO that delays the project without a time-impact entry costs the GC liquidated damages later. Make `timeImpactDays` a required field on every CO; allow 0 but require confirmation.
5. **Vague descriptions.** "Additional work" is unenforceable. Require a minimum length / specific keywords (drawing reference, RFI/ASI number, scope location) on `description`.
6. **Late submission.** Most contracts require written notice within 7–21 days of the triggering event. UDGOK should timestamp `submittedAt` and warn if a PCO sits in DRAFT past the project's `noticeWindowDays` (configurable per Project).
7. **No backup.** Require at least one attachment (sub quote, RFI response, sketch, T&M log) before SUBMITTED is allowed. The architect will ask anyway — bake it in.
8. **Deductive COs entered as additive negatives.** Use `type = DEDUCTIVE` and a positive `thisCOAmount` value, then apply sign at display time. Mixing signs in the field is a reconciliation nightmare.
9. **Superseded COs that still get billed.** If CO-001 v1 is superseded by CO-001 v2, the v1 `payAppLines` must be reassigned. The system should refuse to bill a SUPERSEDED CO.
10. **Markup stacking caps.** Some contracts (TPS, ODOT) cap total stacked markup at 20% on sub-tied work. Show the running total and warn.
11. **Missing pre-lien notice for subs.** Oklahoma requires subs to send a pre-lien notice within 75 days of last furnishing labor/material for commercial work over $10K. UDGOK should remind the GC to confirm sub compliance, since the GC is the only party who knows all the subs.
12. **Confusing CCD and CO.** A CCD is the owner's unilateral tool. Recording it as a CO before reconciliation will misstate the contract sum. Keep CCDs as a separate status chain that *converts* to a CO.

---

## 9. Oklahoma / Tulsa specifics

**No state-specific CO form.** Oklahoma does not mandate a state CO form for private commercial work. AIA G701/G702/G703 are industry standard. Public works (Tulsa Public Schools, City of Tulsa, ODOT) use their own modified forms — typically based on AIA but with additional certification blocks (notarized signatures, board approval dates, separate signature authority matrices). Don't try to be all things; ship AIA-compliant by default, allow custom signatures fields on the Project record. ([OK Lien Laws PDF — Title 42](https://oklahoma.gov/content/dam/ok/en/cib/documents/rules/Lien%20Laws%20PDF%20Title%2042%20from%20CIB%20website%20March%202024.pdf), [ALFA International OK construction](https://www.alfainternational.com/compendium/construction/oklahoma/))

**Pre-lien notice (critical for sub-tier risk).** 42 O.S. §142.6: any unpaid claimant (sub, supplier, sub-sub) supplying the GC or a sub whose **aggregate claim exceeds $10,000** must send a pre-lien notice to the owner and original contractor **no later than 75 days after last furnishing**. Required on commercial and on owner-occupied residential (1–4 units). Not required for new residential developments that are not owner-occupied, or for residential projects of 5+ units. Must include claimant contact info, dates of supply, description, name of requester, property description, dollar amount, signature. Send by certified mail, hand delivery with receipt, or email/fax to be effective. UDGOK should track this for the GC's subs — a missed pre-lien on a $50K sub claim can wipe out the GC's recovery on a disputed CO. ([OK Bar Journal June 2024](https://www.okbar.org/barjournal/june-2024/to-lien-or-not-to-lien/), [Billd OK lien deadlines](https://billd.com/liens/oklahoma/))

**Mechanic's lien filing window (GC vs sub).**
- **General contractor:** file within **4 months (120 days)** after last work. 42 O.S. §142.
- **Sub / supplier without direct contract:** file within **90 days** after last delivery to county clerk, and send notice to owner within 5 days. 42 O.S. §143.
- **Foreclosure suit:** within **1 year** from lien filing. 42 O.S. §§172, 177.
- **Public works:** no mechanic's lien available — use a Notice of Claim on the public bond under 61 O.S. §2, within 90 days of last work, suit within 1 year.

**Statute of limitations for CO claims / breach of contract:**
- Written contract: **5 years** from completion. 15 O.S. §162 (oral: 3 years).
- Tort (construction defect): **2 years** from cause of action vesting.
- Statute of repose (tort): **10 years** from substantial completion.

A CO claim is contractual, so the 5-year window applies. **Practical implication:** UDGOK should retain CO records and attachments for at least **7 years** (5 + 2 for tort), 10 to be safe. Don't let users purge. ([ALFA OK construction](https://www.alfainternational.com/compendium/construction/oklahoma/))

**Tulsa-specific practical notes:**
- Tulsa Public Schools (TPS) projects require board approval for any CO over the construction contingency. Track the CO pipeline against contingency budget on the project dashboard.
- City of Tulsa public works uses modified AIA documents with additional MBE/WBE compliance reporting.
- Oklahoma's construction defect residential statute (15 O.S. § §833-845) provides a pre-suit notice and repair-opportunity process for *residential* only — does not apply to commercial work, but watch for it on mixed-use.
- Tornado/weather events: Oklahoma is in a high-wind zone. Documenting weather-related T&M COs requires NOAA data — UDGOK should let users attach a weather log report to the CO.

---

## 10. What to build vs. what's overkill

**Build now (MVP):**
- CO CRUD with the full state machine above
- Three SOV relation patterns (delta / append / time-only)
- Approval workflow with required signatures
- Pay app integration via `ChangeOrderPayAppLine`
- Attachment requirements (≥1 attachment before SUBMITTED)
- Sequential CO number reservation
- Audit log on every status change
- PDF export in G701 / G702 / G703 layout (use a service like DocRaptor or pdfmake)

**Build later:**
- Full CCD lifecycle as parallel chain (do it if you have a public-works customer requesting it)
- T&M daily ticket module
- Schedule impact analysis (CPM-lite)
- Sub portal for sub-initiated PCOs
- AIA G701S (subcontractor change order) and G714 (CCD) PDF generation
- Markup stack calculator with per-contract caps
- Weather log integration

**Don't build:**
- A separate "Contract" entity (overkill, derive it)
- A full P6/Asta schedule import (just store timeImpactDays + narrative)
- A "what-if" CO simulator (rarely used, confuses users)
- e-signature integration in MVP (use DocuSign external link in v1, integrate in v2)

---

## Sources

- [AIA Document G701–2017 official instructions](https://help.aiacontracts.com/hc/en-us/articles/1500009322061-instructions-g701-2017-change-order)
- [AIA Document G703–1992 official instructions](https://help.aiacontracts.com/hc/en-us/articles/1500009308302-instructions-g703-1992-continuation-sheet)
- [AIA Contracts: G701 Change Order overview](https://aiacontracts.com/documents/g701-change-order)
- [AIA Contracts: CCD vs Change Order (G714 vs G701)](https://learn.aiacontracts.com/articles/construction-change-directive-vs-change-order/)
- [Procore — Contractor's Guide to AIA G701](https://www.procore.com/library/guide-aia-g701-change-order)
- [Procore — How to fill out the AIA G702](https://www.procore.com/library/aia-g702-application-for-payment)
- [Mastt — Project Manager's Guide to AIA G701](https://www.mastt.com/blogs/aia-g701)
- [Trimble — Beginner's Guide to AIA G701](https://www.trimble.com/en/blog/construction/article/guide-aia-g701-change-order)
- [Cyanbuild — G701 form guide & billing workflow](https://cyanbuild.com/guides/aia-g701-change-order)
- [Cogram — Change Orders, CCDs, PCOs](https://cogram.com/glossary/change-order)
- [Finlock — How Change Orders Update the G702/G703](https://finlock.us/blog/aia-g702-g703-explained)
- [Corpay — Schedule of Values in Construction](https://www.corpay.com/resources/blog/schedule-of-values)
- [Buildern — AIA G703 Continuation Sheet](https://buildern.com/resources/blog/aia-g703/)
- [Briq — Construction Change Directive (CCD)](https://briq.ai/acu/object/construction-change-directive)
- [TDOT Change Order Manual (PDF)](https://www.tn.gov/content/dam/tn/tdot/construction/change-orders/Change%20Order%20Manual.pdf)
- [AACE 100R-19 Contract Change Management (PDF)](https://web.aacei.org/docs/default-source/toc/toc_100r-19.pdf)
- [Tasktag — Construction Change Order Management](https://blog.tasktag.com/construction-change-order-management)
- [PILARS — T&M vs Lump Sum CO Profitability](https://pilars.ai/blog/change-orders-tm-vs-lump-sum-profit)
- [Rhumbix — T&M Contracts: What Contractors Need to Know](https://www.rhumbix.com/blog/time-and-materials-contract-contractors-guide)
- [WA State Auditor — Best Practices for Change Orders (PDF)](https://sao.wa.gov/sites/default/files/2023-05/Change-Order-Best-practices.pdf)
- [Docsie — Change Order best practices & state diagram](https://www.docsie.io/blog/glossary/change-order/)
- **Oklahoma:** [OK Statutes Title 42 Liens PDF (CIB)](https://oklahoma.gov/content/dam/ok/en/cib/documents/rules/Lien%20Laws%20PDF%20Title%2042%20from%20CIB%20website%20March%202024.pdf), [OK Bar Journal June 2024 — Lien Law Summary](https://www.okbar.org/barjournal/june-2024/to-lien-or-not-to-lien/), [ALFA International — OK Construction Compendium](https://www.alfainternational.com/compendium/construction/oklahoma/), [Billd — OK Lien Deadlines](https://billd.com/liens/oklahoma/), [NACM STS OK Statute (PDF)](https://nacmsts.com/wp-content/uploads/2024/08/oklahoma_statute.pdf), [Levy Law — OK Lien Summary](https://levy-law.com/oklahoma-state-lien-law-summary/)
