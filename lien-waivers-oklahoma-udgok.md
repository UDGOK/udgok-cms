# Lien Waivers for a Tulsa GC — Design Reference

**Audience:** UDGOK Construction product team
**Goal:** Spec the lien-waiver feature so it's legally sound, hard to misuse, and slots cleanly into the existing PayApp SENT → PAID lifecycle.
**Opinion up front:** Oklahoma is a *non-statutory waiver state*. That is both a freedom (you design the form) and a trap (no statutory backstop to save you from bad wording). Build conservatively, anchor every waiver to a specific dollar amount and a specific through-date, and treat the unconditional progress waiver as the legally dangerous one.

---

## 1. The 4 Waiver Types

The industry-standard 2×2 is universal; only the legal weight of "unconditional" changes by state.

| Type | Common name | Effective when | Protects | Signed against |
|---|---|---|---|---|
| **Conditional Progress** | Conditional partial / interim waiver | Payment actually clears the bank | The sub (won't waive if not paid) | A specific pay app, through a specific date, for a specific amount |
| **Unconditional Progress** | Unconditional partial / release | Immediately on signature | The GC / owner (cleared the sub's lien for that money) | Same anchors as conditional |
| **Conditional Final** | Conditional final release | Final payment clears | The sub (won't waive final lien rights until final $ is in) | The entire project, all subs/suppliers, all retainage, all work through completion |
| **Unconditional Final** | Unconditional final release | Immediately on signature | The GC / owner (full clean title) | The entire project — basically a receipt for everything |

**Legal difference, in one sentence:** A conditional waiver is a *promise* to waive; an unconditional waiver is the waiver *itself*. In Oklahoma, both are enforceable if the waiver intent is clear, but an unconditional waiver is irrevocable even if the check bounces (this is the entire reason Texas, California, Florida, Georgia, and Mississippi make unconditional waivers unenforceable until the check clears — Oklahoma does not give that protection).

**In the pay flow:**

- **Before payment is issued** → request **Conditional Progress** waiver
- **After payment clears** → request **Unconditional Progress** waiver
- **Before final retainage is released** → request **Conditional Final** waiver
- **After final retainage clears** → request **Unconditional Final** waiver

Most U.S. GCs (and both AIA G901–G904 and ConsensusDocs 200.2) use this staggered pattern. The unconditional is the receipt; the conditional is the IOU.

---

## 2. Oklahoma-Specific Law

### The actual statute citations

This is where you have to be careful — the brief said "Title 42 §143," but **§143 is not the lien-waiver statute**. The Oklahoma mechanic's-lien chapter (Title 42, §§ 141–154) sets up the lien rights, the notice and filing rules, and the enforcement window. There is **no dedicated "lien waiver" statute** in Oklahoma. The chapter is also why this is called a *non-statutory waiver state* in trade literature.

The relevant sections you actually need to know:

- **42 O.S. §141** — Original contractor's lien right.
- **42 O.S. §142** — Original contractor lien filing window (4 months from last furnishing) and contents of the lien statement.
- **42 O.S. §143** — Subcontractor's lien right (same extent as original contractor) and 90-day filing window. **This is the section your brief referenced.** It establishes the *right being waived* but contains no waiver form or language requirements.
- **42 O.S. §143.1** — Required contents of the lien statement (verified by affidavit, notarized), and — importantly — authorizes that **"any release of such lien when executed on behalf of a corporation may be signed by any officer or agent of said corporation without the necessity of attestation, seal, or acknowledgment."** Read this as: corporate signers on a *release/waiver* don't need a corporate seal or acknowledgment in front of a notary for the release itself. The release is just a signed writing.
- **42 O.S. §142.6** — 75-day pre-lien notice. Hard prerequisite to a valid lien on **owner-occupied residential** and on **non-residential claims ≥ $10,000**. Subs and suppliers below that threshold or on small unoccupied residential are exempt. Important context for your flow: if a sub's pre-lien wasn't sent, the *lien* is dead, which changes how much protection the waiver even needs to give you.
- **42 O.S. §150** — One-year statute of limitations to *enforce* a filed lien, with a 90-day cooling-off period after recording.

### What makes an Oklahoma waiver enforceable

The "substantially complies" standard the user mentioned comes from *K & H Well Service, Inc. v. Tcina, Inc.*, 2002 OK 58 — a Supreme Court case on lien *statements* (not waivers), but the principle carries: the document must convey clear intent, identify the property, identify the claimant, identify the amount, and identify what's being released. Substantial compliance, not strict compliance, is the test.

**Required elements for an enforceable Oklahoma lien waiver** (in writing, signed):

1. In writing
2. Signed by the waiving party (or an authorized corporate officer/agent under §143.1)
3. Identifies the claimant
4. Identifies the customer / GC receiving the waiver
5. Identifies the project and the property (legal description is best; address is acceptable for commercial projects in practice)
6. States the dollar amount being waived
7. States the through-date
8. States what is being waived (mechanic's lien rights, bond claim rights, both)
9. Names the pay app or invoice being released

**No required statutory language.** No required "warning to homeowner" disclosure (that was repealed in 2011). No required notarization. No required statutory form.

**Permitted but dangerous language to ban in your system:**

- "Waiver of all liens against the project" (without an amount or through-date)
- "Release of any and all claims, known or unknown"
- "Waiver of lien rights for all work to be performed in the future"
- "Final" or "in full" on anything that is not actually a final payment
- "Waiver of rights under §142 et seq." phrased to include future projects

The K&H "substantial compliance" rule means a court *can* save a sloppy waiver — but you don't want to test that. Build the form so it can never be sloppy.

---

## 3. Industry Standard Forms

**AIA G-series (current: 2022 editions).** The four documents map exactly to the 2×2:

- **G901 – Conditional Waiver and Release on Progress Payment**
- **G902 – Unconditional Waiver and Release on Progress Payment**
- **G903 – Conditional Waiver and Release on Final Payment**
- **G904 – Unconditional Waiver and Release on Final Payment**

AIA also publishes state-specific variants (e.g., `G901CA`, `G901AZ`) for states with statutory forms. There is **no `G901OK`** because Oklahoma has no statutory form. The generic G901–G904 is the right base for your default template.

**ConsensusDocs 200 §9.2.3** (the ConsensusDocs 200 standard owner/constructor agreement) is the closest thing to a contractual standard:

> "In no event shall the Constructor be required to sign an unconditional waiver of lien or claim, either partial or final, prior to receiving payment or in an amount in excess of what it has been paid."

This is the rule of thumb: **never ask for an unconditional waiver before payment clears, and never for an amount larger than what you've actually paid.** Bake that into your product as a hard rule. It's the right rule even where it's not legally required.

**Custom forms.** Common in OK because there's no statutory form. A lot of Tulsa GCs (especially in healthcare, education, tribal, and federal work) use modified AIA G901s with a project-specific header. The trap with custom forms is they drift over years — make your system the source of truth and lock the template.

**Recommendation for UDGOK:** Ship with the AIA G901–G904 generic forms as the defaults, expose them as editable templates, and add a "wording safety check" that flags any custom text containing the dangerous phrases in §2 above. That way the GC keeps flexibility, but a junior PM can't accidentally release the whole project in a partial payment.

---

## 4. Workflow / State Machine

This is the design you want. It maps cleanly onto the existing PayApp SENT/PAID state machine without breaking it.

```
                    PayApp created
                         │
                         ▼
                   ┌──────────┐
                   │  DRAFT   │
                   └────┬─────┘
                        │  PM submits to subs / owner
                        ▼
                   ┌──────────┐
        ┌─────────▶│   SENT   │──── prompt sub to sign ────┐
        │          └────┬─────┘    Conditional Progress     │
        │               │                                  │
        │               │  GC approves pay app             │
        │               │                                  │
        │               ▼                                  ▼
        │          ┌──────────┐                  ┌────────────────┐
        │          │APPROVED  │                  │  Waiver: CP    │
        │          └────┬─────┘                  │  status: PENDING│
        │               │                         └────────────────┘
        │               │  Owner funds / check issued
        │               ▼
        │          ┌──────────┐
        │          │  PAID    │──── prompt sub to sign ────┐
        │          └────┬─────┘    Unconditional Progress   │
        │               │                                  │
        │               │                                  ▼
        │               │                         ┌────────────────┐
        │               │                         │  Waiver: UP    │
        │               │                         │  status: PENDING│
        │               │                         └────────────────┘
        │               │
        │               │  ...
        │               │
        │               │  Substantial completion / closeout
        │               ▼
        │          ┌──────────────────┐
        │          │ SUBSTANTIAL_DONE │
        │          └────┬─────────────┘
        │               │  Final pay app
        │               ▼
        │          ┌──────────┐
        │          │  PAID    │──── prompt sub to sign ────┐
        │          └──────────┘    Conditional Final        │
        │                                                   ▼
        │                                          ┌────────────────┐
        │                                          │  Waiver: CF    │
        │                                          │  status: PENDING│
        │                                          └────────────────┘
        │               │  Final retainage released
        │               ▼
        │          ┌──────────┐
        └──────────│ CLOSED   │──── prompt sub to sign ────┐
                   └──────────┘    Unconditional Final      │
                                                       ▼
                                              ┌────────────────┐
                                              │  Waiver: UF    │
                                              │  status: PENDING│
                                              └────────────────┘
```

### The four prompts

| Event | Waiver to request | Type | Status field |
|---|---|---|---|
| PayApp → **SENT** | Conditional Progress | `CONDITIONAL_PROGRESS` | `PENDING` |
| PayApp → **PAID** | Unconditional Progress | `UNCONDITIONAL_PROGRESS` | `PENDING` |
| Project → **SUBSTANTIAL_COMPLETION** | Conditional Final | `CONDITIONAL_FINAL` | `PENDING` |
| Project → **CLOSED** (retainage released) | Unconditional Final | `UNCONDITIONAL_FINAL` | `PENDING` |

### Hard block vs. soft prompt — opinion

**Soft prompt for progress waivers. Hard block for final waivers.**

Reasoning:

- For a progress payment, a sub who refuses to sign a conditional waiver is a problem, but you can still pay them and chase the waiver. The conditional waiver has *no legal effect* until you actually pay anyway. Blocking payment over a conditional waiver creates more friction than it removes — especially in OK where the form is non-statutory and a sub may push back on the wording. Log the refusal, keep paying, fire reminders.
- For the **final** waiver, the picture flips. A final unconditional waiver is the *entire* reason you're releasing retainage. If the sub won't sign the conditional final, you do not pay final. Hard block. No retainage release without a signed conditional final, and the unconditional final must follow within 5 business days of the final payment clearing.

The system should also support a "manual override with reason" path — sometimes a sub genuinely disputes retainage and the GC needs to release partial final and document why. Log the override, who approved it, and the legal/contractual basis.

---

## 5. Data Model (Prisma-style)

```prisma
model LienWaiver {
  id              String          @id @default(cuid())
  projectId       String
  project         Project         @relation(fields: [projectId], references: [id])
  subcontractorId String
  subcontractor   Subcontractor   @relation(fields: [subcontractorId], references: [id])
  payAppId        String?         // null for project-level final waivers
  payApp          PayApp?         @relation(fields: [payAppId], references: [id])

  // The 2x2 type matrix, stored as an enum
  type            LienWaiverType  // CONDITIONAL_PROGRESS | UNCONDITIONAL_PROGRESS | CONDITIONAL_FINAL | UNCONDITIONAL_FINAL

  // The money. Use integer cents, never floats.
  amountCents     BigInt
  currency        String          @default("USD")

  // The "through date" — the last day of work this waiver releases.
  throughDate     DateTime

  // Optional carve-outs the sub is reserving. Free text + structured list.
  exceptionText   String?
  exceptionItems  Json?           // [{description: "Change Order #3", amountCents: 1250000}, ...]

  // Lifecycle of the waiver document itself
  status          LienWaiverStatus // DRAFT | SENT_TO_SUB | VIEWED | SIGNED | SUPERSEDED | VOIDED | REFUSED

  // Templating
  templateId      String?
  template        LienWaiverTemplate? @relation(fields: [templateId], references: [id])
  templateVersion Int             // bump on every template edit; subs can never sign v1 in arrears
  renderedHtml    String?         // snapshot of what they signed
  renderedPdfKey  String?         // S3/object-store key for the signed PDF

  // Signature
  signerName      String?
  signerTitle     String?
  signerEmail     String?
  signerIp        String?
  signedAt        DateTime?
  signatureMethod String?         // "DOCUSIGN" | "ADOBE_SIGN" | "NATIVE_TYPED" | "UPLOAD"
  signatureBlob   String?         // base64 image, or provider envelope ID

  // Notarization. Optional in OK, but the field exists.
  notarized       Boolean         @default(false)
  notaryName      String?
  notaryCommissionExpiry DateTime?
  notaryState     String?
  notaryPdfKey    String?         // separate scan if uploaded

  // Audit
  createdById     String
  createdBy       User            @relation("CreatedWaivers", fields: [createdById], references: [id])
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Don't ever hard-delete these. Use VOIDED status.
  voidedReason    String?
  voidedAt        DateTime?
  voidedById      String?
  voidedBy        User?           @relation("VoidedWaivers", fields: [voidedById], references: [id])

  events          LienWaiverEvent[]

  @@index([projectId, subcontractorId, type])
  @@index([payAppId])
  @@index([throughDate])
  @@index([status])
}

model LienWaiverTemplate {
  id              String          @id @default(cuid())
  name            String          // "OK Commercial — Conditional Progress (AIA G901 based)"
  state           String          // "OK" | "TX" | null for generic
  projectType     String?         // "COMMERCIAL" | "RESIDENTIAL" | null
  type            LienWaiverType
  version         Int
  bodyMarkdown    String          // body template with {{handlebars}} for project, sub, amount, throughDate
  warnings        Json?           // phrases the safety check is looking for
  isActive        Boolean         @default(true)
  createdById     String
  createdAt       DateTime        @default(now())

  waivers         LienWaiver[]

  @@unique([name, version])
}

model LienWaiverEvent {
  id          String          @id @default(cuid())
  waiverId    String
  waiver      LienWaiver      @relation(fields: [waiverId], references: [id])
  eventType   String          // "CREATED" | "EMAILED" | "VIEWED" | "SIGNED" | "REMINDER_SENT" | "REFUSED" | "VOIDED" | "SUPERSEDED"
  actorType   String          // "USER" | "SUBCONTRACTOR" | "SYSTEM"
  actorId     String?
  metadata    Json?           // IP, user agent, email send ID, etc.
  occurredAt  DateTime        @default(now())

  @@index([waiverId, occurredAt])
}

enum LienWaiverType {
  CONDITIONAL_PROGRESS
  UNCONDITIONAL_PROGRESS
  CONDITIONAL_FINAL
  UNCONDITIONAL_FINAL
}

enum LienWaiverStatus {
  DRAFT
  SENT_TO_SUB
  VIEWED
  SIGNED
  SUPERSEDED    // a newer waiver replaced it (e.g. corrected through-date)
  VOIDED        // cancelled with a reason
  REFUSED       // sub actively declined to sign
}
```

**Key design notes:**

- **`amountCents` as `BigInt`** — you do not want a float anywhere near a legal document.
- **`templateVersion` pinned on the waiver** — if a PM edits a template, every prior signed waiver still references the version that was actually signed. Critical for audit and for a later dispute.
- **`renderedHtml` snapshot** — store the HTML as it existed at the moment of signature, in case the template is later edited. Combined with the PDF, this is your evidence.
- **Soft delete only.** Never `DELETE` a waiver. Use `VOIDED` + `voidedReason`.
- **`LienWaiverEvent` is a full append-only audit log.** Every email, every view, every reminder, every signature — this is what your lawyer reads in a dispute.
- **`exceptionItems` as JSON** — exception/reservation language varies wildly. Free text is fine, but a structured list lets you flag things like "this waiver reserves $12,500 for Change Order #3" and surface it in reports.

---

## 6. The Through-Date Concept

A "conditional progress waiver through June 30" means: *for all labor, materials, and equipment furnished on the project on or before June 30, 2025, upon receipt of $[amount], the sub waives all mechanic's lien and bond claim rights.*

Three things to model:

1. **`throughDate` as a real `DateTime`** on the waiver (above). Not just text.
2. **A derived "covered work period"** that the system should enforce:
   - For pay-app N, the through-date should be `>= payApp[N-1].throughDate` and `<= payApp[N].periodEnd`.
   - Never let a user set a through-date *earlier* than the prior pay app's through-date for the same sub. That's the most common silent error.
3. **Validation that adjacent waivers are continuous.** If pay app 5 covers through 5/31 and pay app 6 covers 6/1–6/30, you cannot have pay app 6's waiver say "through 6/15" with no waiver for 6/16–6/30. The system should either auto-derive the through-date from the pay app period, or warn loudly.

**Practical product rule:** the through-date is *not* a free-text field the user types. It is computed from the pay app period. The sub can request an exception ("I reserve rights for work on 6/22 through 6/25") but the default through-date is the system-derived one.

---

## 7. Notarization

**Oklahoma does not require lien waivers to be notarized.** Period. Not for residential, not for commercial, not for owner-occupied, not for anything. (The lien *statement* — the document used to *file* a lien, not to *waive* one — must be notarized per §143.1, but that's a different document.)

The brief's claim that "Oklahoma requires lien waivers for residential to be notarized" is incorrect. That rule exists in **Texas Property Code §53.281**, **California Civil Code §8132–§8138**, **Florida §713.20**, **Georgia §44-14-366**, and **Mississippi §85-7-419** — but not Oklahoma. Tulsa GCs often pick up this misconception from Texas colleagues, since Tulsa is right on the border.

**Recommendation for UDGOK:**

- Default `notarized = false` for Oklahoma commercial and residential.
- Allow the project to *require* notarization as a contractual setting (e.g., owner-financed projects, certain tribal/federal jobs, certain lenders).
- If `notarized = true`, the system should require either:
  - A wet-notary scan uploaded to `notaryPdfKey`, **or**
  - A remote online notarization (RON) integration — Oklahoma authorized RON under 49 O.S. §114.1, valid since 2019. The fields `notaryName`, `notaryCommissionExpiry`, and `notaryState` capture the audit data.
- Never block signing on notarization unless the project's contract requires it.

---

## 8. Storage / Audit Trail

### Retention

**Minimum 7 years from project close.** Recommended 10 years. Reasoning:

- Oklahoma lien enforcement window: 1 year from filing (§150), but the lien itself can be filed up to 4 months (original) or 90 days (sub) after last furnishing. Add them: ~22 months of lien risk per sub, per project.
- IRS audit window: 6 years; 7 is the de facto standard.
- Statute of limitations on a written contract in Oklahoma: 5 years (15 O.S. §162).
- Oklahoma's statute of repose on improvements to real property: none for commercial, but 2 years from completion for *personal injury* claims arising from construction defects (which can drag lien and bond claims along with them).

7 years covers all of these with margin. 10 years is the conservative number and is what most enterprise GCs and sureties require.

**Storage format:**

- **Signed PDF** in object storage, immutable, with the SHA-256 hash recorded in the DB.
- **Original HTML / DocuSign envelope** retained alongside.
- **Audit log** (the `LienWaiverEvent` table) is append-only — never UPDATE or DELETE a row.
- **Backup the storage bucket with object lock** (S3 Object Lock in Compliance mode, or equivalent) so even a rogue admin can't tamper.

**Sub that won't sign:**

Documented workflow:

1. Sub refuses (or is unresponsive for 14 days).
2. Mark waiver `REFUSED`, log the reason, send a written notice to the sub that payment is being released without a signed waiver and that the GC reserves all rights.
3. For unconditional: do not release final payment / retainage. Hard stop. (See §4.)
4. For conditional: release the progress payment anyway (the conditional has no legal effect until you pay), keep the documentation.
5. Monthly reminder cadence. After 60 days, escalate to project executive.
6. If the sub files a lien anyway, you have the audit trail showing they were asked, refused, and were still paid.

---

## 9. Common Pitfalls (the "Gotchas" List)

Things the system must prevent:

1. **Over-waiving future work.** A waiver that says "for all work performed on the project through completion." This is the #1 trap. Enforce: through-date is required, and the through-date must be ≤ today + 90 days.
2. **Waiver for an amount that doesn't match the pay app.** If the pay app is for $48,212.50, the waiver must be for $48,212.50. Block mismatch. Allow a 0.00% tolerance only.
3. **Unconditional waiver collected before payment clears.** Block at the workflow level. Unconditional progress waiver creation requires PayApp.status = `PAID` (or a manual override with reason).
4. **Unconditional waiver for more than what was paid.** ConsensusDocs 200 §9.2.3 calls this out by name. Validate `amountCents ≤ sum(payments to this sub for this pay app)`.
5. **Blanket waivers** ("all liens, all claims, all projects"). The wording safety check should flag these. Reject unless type = `UNCONDITIONAL_FINAL` and project = sole project.
6. **Missing exception language.** When the system detects an `exceptionItem` with `amountCents > 0`, the rendered PDF must show the reservation block, and the GC dashboard must show "This waiver reserves $X."
7. **Template drift.** A sub signs a template on Tuesday; PM edits the template Wednesday; the sub is later asked to prove what they signed. The `templateVersion` pin + `renderedHtml` snapshot solve this — do not skip them.
8. **No through-date.** Some forms leave it blank. Oklahoma courts will treat that as ambiguous, which usually means the waiver covers everything (worst case for the GC). Require a through-date; do not let it be null.
9. **No project / property ID.** A waiver that says "for work at the job" is unenforceable. Require `projectId` and at minimum the project address.
10. **Unsigned waiver treated as signed.** A status of `VIEWED` is not `SIGNED`. Block the workflow transition from `PayApp → PAID` if the unconditional progress waiver is anything but `SIGNED` (or `REFUSED` with a logged override).
11. **Sub signs a waiver as a *different entity*.** A sub waives as "Acme Mechanical LLC" but you pay "Acme Mechanical of Oklahoma LLC." The signature doesn't bind the entity you paid. Validate that the signing entity matches a known `Subcontractor` record on the project.
12. **Stale pre-lien notice context.** If you're using pre-lien data to score lien risk, remember §142.6: an owner-occupied residential project with no 75-day notice is a *dead* lien. The waiver matters less than you think. Surface this in the risk view.
13. **Pay-if-paid confusion.** Oklahoma enforces pay-if-paid clauses. A sub who knows the owner hasn't paid *you* has no lien claim for that pay period. Their refusal to sign a conditional waiver is a negotiation tactic, not a lien risk. Don't get bullied.
14. **Tribal / federal / Tinker AFB jobs.** These projects often sit on fee or restricted land where state mechanics lien law may not apply at all. The waiver is still useful for the payment bond, but the legal framework is different. Make `project.jurisdiction` a real field and route to the right language.
15. **Final waiver that isn't actually final.** Triggering `CONDITIONAL_FINAL` based on a percentage threshold ("90% of contract value paid") is wrong — final is when the contract is *complete*, including punch list. Tie the trigger to the `SUBSTANTIAL_COMPLETION` event, not a money threshold.

---

## 10. Integration with the Existing Flow

The proposed state machine in §4 is the integration. A few additional rules:

**Triggering prompts — exact events:**

- **PayApp status: SENT** → for each sub with a line item on that pay app, generate a `CONDITIONAL_PROGRESS` waiver in `DRAFT`, then auto-move to `SENT_TO_SUB` with an email to the sub's primary contact. The email includes a deep link to sign in the sub portal.
- **PayApp status: PAID** → for each sub, generate the matching `UNCONDITIONAL_PROGRESS` waiver in `DRAFT`, move to `SENT_TO_SUB`, email the sub. *Note:* the sub has 5 business days to return the unconditional. If they don't, the GC's AR team gets a flag, but payment has already been made.
- **Project status: SUBSTANTIAL_COMPLETION** → for every sub with an open contract on the project, generate `CONDITIONAL_FINAL` in `DRAFT`. These block final retainage release.
- **Project status: CLOSED** (retainage released) → generate `UNCONDITIONAL_FINAL`. These must be collected for the project record to be "audit-clean."

**Soft vs. hard rules, summary:**

| Event | Prompt type | Hard or soft block on the parent transition? |
|---|---|---|
| SENT → request Conditional Progress | Soft | No (do not block the pay app going out) |
| PAID → request Unconditional Progress | Soft | No (do not block the payment going out) |
| Final retainage release → require Unconditional Final | **Hard** | **Yes — block retainage release** |
| Project CLOSED | Hard for record hygiene, not for payment | Audit dashboard shows open waivers; project marked `CLOSED_PENDING_WAIVERS` until clean |

**Reminders:**

- Day 0: waiver emailed.
- Day 3: gentle reminder.
- Day 7: second reminder + CC to the sub's AR contact.
- Day 14: status flips to `REFUSED` if not signed, project executive notified, payment consequences triggered per the table above.
- Day 30: legal escalation flag (configurable per project).

**Sub portal UX:**

- Sub sees a list of "waivers awaiting your signature" with the pay app number, amount, through-date, and exception language.
- Signing is a typed name + checkbox "I am authorized to bind [entity]" + click-to-sign. For the rare notarized case, separate flow with upload.
- Once signed, sub can download a PDF for their own records.
- Sub can also upload a pre-signed waiver from their own form (e.g., a GC's preferred template), but the system *validates* it against the safety checks and only marks it `SIGNED` if it passes.

---

## Sample Data — Three Real-World Waivers

These are realistic examples, not legal boilerplate. Format your rendered PDF around this structure.

### Example 1: Conditional Progress Waiver (PayApp #4, ACME Mechanical)

```
LIEN WAIVER AND RELEASE — CONDITIONAL ON PROGRESS PAYMENT
AIA Document G901–2022 (Oklahoma Customization)

Project:           Riverside Medical Office Building
Project Address:   1145 S. Riverside Dr., Tulsa, OK 74104
Owner:             Riverside Holdings LLC
GC:                UDGOK Construction LLC
Claimant:          Acme Mechanical Contractors LLC
Pay Application:   #4 (period 06/01/2025 – 06/30/2025)
Through Date:      June 30, 2025
Payment Amount:    $84,212.50 (eighty-four thousand two hundred twelve and 50/100)

Upon receipt by the undersigned of the payment amount stated above, the
undersigned conditionally waives and releases any mechanics lien, statutory
lien, and payment bond claim the undersigned has on the above Project for
labor, materials, and/or equipment furnished through the Through Date. This
release covers the Payment Amount only and does not cover any rights the
undersigned may have for retainage, disputed change orders, or work
furnished after the Through Date.

EXCEPTIONS / RESERVATIONS:
  - Retainage held by GC: $42,106.25
  - Unpaid Change Order Request #3 (HVAC rework per RFI-018): $11,450.00
  - Work performed 06/28/2025 – 06/30/2025: disputed, see COR-7

Signed:  J. Reyes, President, Acme Mechanical Contractors LLC
Date:    07/02/2025
[Notarization: NOT REQUIRED]
```

### Example 2: Unconditional Progress Waiver (PayApp #4, after ACH cleared)

```
LIEN WAIVER AND RELEASE — UNCONDITIONAL ON PROGRESS PAYMENT
AIA Document G902–2022 (Oklahoma Customization)

Project:           Riverside Medical Office Building
Pay Application:   #4 (period 06/01/2025 – 06/30/2025)
Through Date:      June 30, 2025
Payment Amount:    $84,212.50
Payment Method:    ACH, received 07/08/2025

The undersigned has been paid and has received the Payment Amount and does
hereby unconditionally waive and release any mechanics lien, statutory lien,
and payment bond claim the undersigned has on the above Project for labor,
materials, and/or equipment furnished through the Through Date, except for
rights the undersigned may have for retainage, disputed change orders
expressly listed below, and work furnished after the Through Date.

EXCEPTIONS: Retainage and COR-3 / COR-7 (as listed in prior conditional
waiver of even date).

Signed:  J. Reyes, President
Date:    07/09/2025
```

### Example 3: Unconditional Final Waiver (Project CLOSED, all subs)

```
LIEN WAIVER AND RELEASE — UNCONDITIONAL ON FINAL PAYMENT
AIA Document G904–2022 (Oklahoma Customization)

Project:           Riverside Medical Office Building
Substantial Completion:  10/15/2025
Final Payment:     $42,106.25 (retainage release), received 12/19/2025
Through Date:      December 19, 2025 (project closeout)

The undersigned has received full and final payment for all labor, materials,
and equipment furnished on the above Project and does hereby unconditionally
waive and release all mechanics lien, statutory lien, and payment bond claim
rights the undersigned ever had on the above Project.

NO EXCEPTIONS RESERVED.

Signed:  J. Reyes, President, Acme Mechanical Contractors LLC
Date:    12/22/2025
Signature notarized: Yes — Commission expires 03/14/2028
Notary: K. L. Walker, Notary Public, State of Oklahoma, Tulsa County
```

The jump from Example 2 to Example 3 is what most sub portals screw up — the final waiver deletes the exception block. The system should refuse to render an unconditional final waiver if any `exceptionItem` on the conditional final is still open. That's the killer feature.

---

## Oklahoma-Specific Legal Language — The Exact Words

There is no required statutory language in Oklahoma. But the following is the *minimum* language that, by case law (the *K&H Well Service v. Tcina* substantial-compliance standard), makes a waiver unambiguously enforceable and the minimum that the UDGOK default template should contain:

> "Upon receipt of the sum of $[amount], the undersigned waives and releases any mechanics lien, statutory lien, stop-notice claim, and payment bond claim the undersigned has on the above-described Project for labor, materials, services, and/or equipment furnished through [through date]. This waiver and release is for the above payment amount only and does not waive or release any rights the undersigned has for retainage, for any items expressly reserved below, or for labor, materials, services, or equipment furnished after the through date."

For unconditional final:

> "The undersigned has received full and final payment for all work, labor, materials, services, and equipment furnished on the above Project and hereby unconditionally waives and releases any and all mechanics lien, statutory lien, stop-notice claim, and payment bond claim rights the undersigned ever had on the above Project."

For the exception block, the *exact* words aren't required but should be in plain English with a dollar number attached, e.g.:

> "EXCEPTIONS / RESERVATIONS: The undersigned expressly reserves the right to file a lien or claim for the following: (1) retainage in the amount of $[X]; (2) disputed change order COR-# in the amount of $[Y]; (3) work performed between [date] and [date] in the amount of $[Z]."

**Do not** include any of the following in any UDGOK-generated waiver:

- References to "all claims of any kind, known or unknown"
- References to "all projects" or any non-this-project work
- References to "future work" or "work to be performed"
- "In full satisfaction of all obligations"
- Any waiver of the right to file a *bond claim* unless the project has a payment bond and the GC has been disclosed as obligee

---

## Summary — Build vs. Block Decisions

| Question | Answer |
|---|---|
| Default to AIA G901–G904 generic forms? | **Yes**, as editable templates |
| Notarize in OK by default? | **No** — opt-in per project |
| Soft block on missing Conditional Progress waiver? | **Yes** — 14-day soft, then flag |
| Hard block on missing Unconditional Final waiver? | **Yes** — project cannot be `CLOSED_CLEAN` without it |
| Store signed PDF + template version + HTML snapshot? | **Yes** — immutable, 7-year retention minimum |
| Auto-derive through-date from pay app period? | **Yes** — do not let users free-type it |
| Validate amountCents matches pay app exactly? | **Yes** — zero tolerance, manual override with reason only |
| Validate through-date is monotonic per sub? | **Yes** — cannot go backward |
| Reject over-broad wording in custom templates? | **Yes** — safety check on save |
| 4-state workflow (CP → UP → CF → UF)? | **Yes** — that is the industry standard |
| Allow "manual override" with reason? | **Yes** — log who, when, why |

---

**Bottom line for the product team:** This feature is mostly about *not* doing the wrong thing. The law in Oklahoma is permissive, the templates are standardized, and the workflow is well-understood. The moat is in the safety checks — the system that catches a $50,000 typo on a $84,212 waiver, blocks a sub from signing an unconditional for work that hasn't been paid, and refuses to close out a project with an unsigned unconditional final is the system that saves a Tulsa GC from a six-figure lien fight.
