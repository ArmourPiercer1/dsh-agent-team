# A4-PR1 — Invariant → owner → test matrix

Written by A4-PR1 as the **first owning pass** over ADR §29 (`ADR-alpha4-hard-governance.md:743-762`,
invariants 1-15) plus invariant **#16** (added by Amendment A1-1, `:770`), as demanded by
`alpha4-implementation-plan.md:126` ("`INVARIANT-MATRIX.md` before first GREEN, where invariants #6
and #16 must name tests") and `:764` / `:822` ("invariants **#6** … and **#16** … must have named
tests, not prose"; "PR1 writes the matrix … and carries invariant #6 — which already has real tests
(`packages/runtime/test/a5a-pre-execute.test.ts:962,1208`) but had no owning PR").

## How to read a row

| column | meaning |
| --- | --- |
| **owner** | the PR that makes the invariant true **end-to-end**. PR1 is not the owner of most rows. |
| **PR1 row** | what THIS PR actually pins, in words narrow enough to be falsifiable. Empty-handed rows say so. |
| **test** | a real file + the **exact** `describe`/`it` title (or `file:line`). Every citation here is greppable; a row whose test does not exist yet is marked `→ PRn`. |

PR1's scope discipline (plan Task 1): PR1 builds the **shared algebra and the v3 carrier** and
connects **no** production authorization decision to either. Rows about runtime *enforcement*
therefore name the owning PR and, where a pre-existing test already pins today's behaviour, that
test — never a claim PR1 cannot support.

---

## ADR §29 + #16

| # | invariant (ADR wording, abbreviated) | owner | PR1 row | test |
| --- | --- | --- | --- | --- |
| 1 | no matching envelope rule grants no expansion authority | **PR1** (algebra) / PR2-PR4 (enforcement) | `effectiveAuthorityCeiling` has exactly one no-match outcome: `no-authority`. `rules: []` and "rules exist, none match the class/resource" both reach it. | `packages/runtime/test/a4p1-authority-envelope.test.ts` → `X5-E3a the EXPANSION lookup reads an empty document as NO-AUTHORITY, never as identity` |
| 2 | adding an overlapping rule cannot increase authority | **PR1** | the §5.3 monotonic-restriction property is tested directly on both lookups, not inferred from examples. | `packages/runtime/test/a4p1-authority-envelope.test.ts` → `§5.3 monotonic restriction — adding a rule never raises a ceiling on either plane` |
| 3 | Leader effective authority is never greater than either envelope | **PR1** | `grantCeiling` is a `meet` over the approval-plane narrowing of each binding document, so it is ≤ each operand by construction; pinned against a document that narrows and one that does not. | `packages/runtime/test/a4p1-authority-envelope.test.ts` → `grantCeiling never exceeds either binding document (meet over the approval plane only)` |
| 4 | authority is computed from live canonical/containment context, never startup path enumeration | PR2/PR3 (reader) · PR4 (guard) | PR1 keeps the reader's liveness contract intact and adds the v3 reader: `teamHardEnvelope` is read **fresh per decision** and reports `{ status: 'absent' }` — **a status, never `undefined`, and never `{rules: []}`** — for a v1/v2 blueprint, so "absent document" can be laundered into neither "a document that denies everything" (that would be `{rules: []}`) nor "a document we could not read" (that is `{ status: 'unavailable' }`, which the ceiling adapter REFUSES instead of meeting over). Round-1 review SF1: the first draft returned `undefined` for BOTH of the last two, and because an empty bound set meets to the IDENTITY on the approval plane, the natural `unavailable ? undefined : doc` would have granted unlimited approval reach on a storage fault. `AuthorityDocumentRead` is a three-way union and `undefined` is not a member of it. | `packages/runtime/test/a3p4-r4-authority-binding.test.ts` → `A4 — an absent carrier is a LEGAL typed absence (zero authority, zero fs calls)` + the PR1 `C1`–`C4` legs (v3 declared / v1v2 absent / drifted binding unavailable); `packages/runtime/test/a4p1-authority-envelope.test.ts` → `SF1 — an UNAVAILABLE document never becomes a ceiling, and \`undefined\` is not a slot` |
| 5 | matcher-root identity drift invalidates frozen proposals | PR4 (proposal binding) | none — PR1 writes no proposal row and no frozen-proposal path. Stated as empty-handed, not inherited. | `→ PR4`. Existing generation/identity binding today: `packages/runtime/test/a4pr0-proposal-generation.test.ts` |
| 6 | `deny` never automatically becomes an approval request | **PR1 carries it** (plan `:822`) | PR1 does not change the guard, so today's pins stay the evidence. What PR1 adds is the half that makes the invariant **provable rather than incidental**: on the approval plane a `deny` can only ever come from a **declared** rule — absence yields the **identity** (`decided(allow)`), never a manufactured `deny` and never an escalation — and on the expansion plane no-match yields `no-authority`, which §24.2 keeps **distinct from `deny`** and A1-7 forbids turning into an admin-required case. A missing rule therefore cannot mint an approval request on either plane (exactly the dead-lock A1-4 rejected at `:777`). | **pre-existing, real:** `packages/runtime/test/a5a-pre-execute.test.ts:962-973` — `A5a S2: static deny — zero execution, no control rows` / `it('next is NEVER called (zero-effect invariant) and no control row exists')`; `packages/runtime/test/a5a-pre-execute.test.ts:1208-1214` — `it('bash with NO rule + default deny → static deny, zero execution, no request row')`. **PR1 addition:** `packages/runtime/test/a4p1-authority-envelope.test.ts` → `X5-E3 (BLOCKING) an EMPTY hard envelope plus a matching allow mutation ceiling yields grantCeiling = allow, not no-authority` |
| 7 | no principal may approve its own expansion | PR4 (A1-3 write-time gate) | none in PR1: no approval write exists here. PR1's `bindingDocs` is a pure positional table (ADR A5-1) and consults no caller data. | `→ PR4` |
| 8 | escalation grants zero execution/mutation authority | PR4 | none in PR1. | `→ PR4` |
| 9 | an escalated leg can never later approve the same case | PR4 (A1-10 leg identity) | none in PR1. | `→ PR4` |
| 10 | Member cannot initiate durable permission mutation | PR4/PR5 (write path) | the **ceiling** half: `bindingDocs('member', …)` has no document set to return, so no `grantCeiling` exists for a Member reviewer — the table refuses instead of silently inheriting the Leader row. Enforcement at the write path stays PR4/PR5's. | `packages/runtime/test/a4p1-authority-envelope.test.ts` → `bindingDocs — Member is not a reviewer of its own expansion` |
| 11 | mutation batches are all-or-nothing | PR4 (A1-8 commit validity) | none in PR1. | `→ PR4` |
| 12 | ControlDecision `allow` is not execution or mutation authority by itself | PR2/PR4 | none in PR1 (PR1 writes no decision). PR1 keeps the two planes non-interchangeable in TYPES: the expansion lookup and the approval narrowing are two functions with opposite no-match semantics and are never `min()`-ed together (ADR A3-2). | `packages/runtime/test/a4p1-authority-envelope.test.ts` → `X5-E3b the two lookups are never composed: grantCeiling meets ONLY narrowingForApproval` |
| 13 | Intervention state is never authorization evidence | PR5 (A1-17 boundary) | PR1 adds no import edge to `intervention/**`; the lane-hygiene walk that pins this gains the new `domain` root so the new module is covered by the same scan. | `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` (roots extended to `domain` by PR1) |
| 14 | caller-supplied Remote role data can never create Human Admin authority | PR6 (`s6-principal.ts`) | none in PR1: no Remote surface is touched. | `→ PR6` |
| 15 | v1/v2 Blueprint/Team runtime paths fail closed after the Alpha.4 breaking upgrade | PR7 (cutover) | PR1's contribution is the **opposite-direction** guarantee that PR7 depends on: until the cutover, v1/v2 parse and behave **byte-identically** (ADR A2-4/A2-11), pinned by literal golden hashes — so when PR7 flips the fence, "v1/v2 now fail closed" is a deliberate change rather than an unnoticed drift. | `packages/domain/test/a4p1-blueprint-v3-governance.test.ts` → `V16 GOLDEN: the v1 and v2 content hashes are BYTE-IDENTICAL to the pre-v3 literals (ADR A2-11)` + `V17 the v1/v2 hashable projections carry NO teamHardEnvelope key (key-omitted, not null)` |
| 16 | no authority-bearing surface derives its principal from payload data or a default branch (A1-1) | **PR6** (catalog-enumeration test) | **named, not prose.** PR1's one principal-consuming table is `bindingDocs(reviewer, documents)`: its domain is the closed `ProposalAuthorityPosition` union (`packages/runtime/governance/proposal-store.ts:150-151`), imported **type-only**, so a payload string cannot name a position at all. The table has an **explicit arm per union member and no `default:`**, and the `member` arm **refuses** rather than falling through — spec §7.4:307 says a Member "cannot review at all", so there is no ceiling to hand out. | `packages/runtime/test/a4p1-authority-envelope.test.ts` → `bindingDocs has an explicit arm for every position and NO default branch`, `bindingDocs — Member is not a reviewer of its own expansion`, and (round-1 review B1) `B1 (BLOCKING) — a position outside the closed union REFUSES, it does not bind nothing`, which calls the table with a bogus position and requires a throw: the type-only union stops typed callers, and the post-`switch` line is what stops a cast payload, so that line is pinned by EXECUTION. Its alternative was `return []`, which is type-invisible, keeps every other test green, and lands on `CEILING_IDENTITY`. |

---

## The two rows the plan singles out

**#6 — `deny` never automatically becomes an approval request.** Plan `:822` records that #6 already
had real tests but **no owning PR**; PR1 carries it. The pre-existing pins are named above with
line ranges (static `deny` → zero execution **and zero control rows**; `default deny` → no request
row). PR1 cannot strengthen the guard itself — PR1 connects nothing to production — so what PR1
adds is the *provenance* half of the same invariant: on the operation-approval plane the effect
vocabulary is `ask | allow` (ADR A5-22), `deny` is only ever an **answer**. A `deny` appearing in a
`maximumEffect` approval slot is therefore a typed defect caught where the document is parsed, not
a value that can flow into "mint an approval case".

**#16 — no principal from payload, no default branch.** PR6 owns the Remote catalog-enumeration
proof. PR1's share is one function, and it is written so the invariant is structural rather than
police: `bindingDocs` takes a `ProposalAuthorityPosition` **type-only** import
(`import type { ProposalAuthorityPosition } from './proposal-store.js'`), switches exhaustively over
the four members of that union with a `never` fallthrough, and contains no `default:` arm. The
Human Admin row is `[]` (meet over the empty set = identity = no narrowing), Human User is
hard-only, Leader is both documents, and **Member is refused** (spec §7.4:307 "a Member cannot
review at all"). The test asserts the table's shape by asserting the exact document set each
position binds, plus the refusal — so widening the union without writing an arm is a compile
failure, and an arm that forgot to refuse Member is a test failure.

## A1/A2/A3 rows PR1 owns outright (not in §29, listed because a later PR reads them from here)

| id | claim | test |
| --- | --- | --- |
| A1-4 / X5-E3 | the two lookups have **opposite** no-match semantics and are never fused | `a4p1-authority-envelope.test.ts` → `X5-E3a` / `X5-E3b` above. This is the PR1 **blocking RED**: a hard envelope of `{rules: []}` plus a matching mutation ceiling of `allow` MUST yield Leader `grantCeiling = allow`, not `no-authority`. |
| A1-5 | `EffectiveCeiling` is a total lattice, `undetermined` absorbing, all pairings pinned | `a4p1-authority-envelope.test.ts` → `§24.2 meet table — every pairing, including undetermined absorbing` |
| A1-6 | one undecidable same-class subtree rule ⇒ whole-scope `undetermined`; no relevance filtering | `a4p1-authority-envelope.test.ts` → `A1-6 an undecidable same-class subtree rule forces whole-scope undetermined (no relevance filtering)` |
| A2-3 / X5-E2 | the document carries the DECLARED AST (`{kind, path|fingerprint}`); the canonical `{kind, resource}` shape exists only after the one canonicalization | `a4p1-blueprint-v3-governance.test.ts` → `V3 …`; `a4p1-authority-envelope.test.ts` → `one canonicalization — the resolver is called for file rules only, fingerprints travel verbatim` |
| A2-11 | v1/v2 hash byte-identity, temporary `[1,2,3]` bridge | `a4p1-blueprint-v3-governance.test.ts` → `V16` / `V17`; plus `packages/domain/blueprint/testdata/fixtures.ts` negative witness moved 3 → 4 with intent preserved (the file's own §E.2 precedent) |
| A3-9 | one grammar, one module, no runtime/storage import from domain | `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` (roots `['runtime','tools','remote','client']` + `'domain'`, and the `PERMISSION_EFFECT_PRECEDENCE` object-identity pin) → `the domain lane declares no edge but its own interior`: a RECURSIVE walk of `packages/domain/authority-envelope/**` over four specifier forms (`from '…'`, `import(…)`, `require(…)`, side-effect `import '…'`, both quote styles) with a non-vacuity assertion, so a subdirectory or a dynamic edge cannot escape the law (round-1 review SF3) |
| plan Task 1 lane C ("keep the reader unused by production authorization in PR1") | the ceiling adapter and the v3 hard-ceiling reader ship **UNWIRED**; a PR2 wiring must arrive as a reviewed amendment to a stated set | `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` → `PR1 ships the ceiling adapter UNWIRED: every new name has an audited consumer set` (per-name allow-list over ~17 new production names **and** the reader: zero non-test call sites of `.teamHardEnvelope(`, and `permission-plane.ts`'s import of the adapter asserted TYPE-ONLY) + `the module itself has exactly the importers PR1 gave it`. Round-1 review SF2: the first draft of this leg covered 2 of the new names and none of the reader. |
| A5-12 | v1/v2 keep existential coverage until PR7; v3 uses ceiling semantics. **The switch itself is not in PR1 → PR2**: the version branch lives in the single adapter PR2 owns (`packages/runtime/src/plugin/permission-plane.ts`, selected by `schemaVersion`), and PR2 pins BOTH branches in one test file so the existential leg is not deleted early. What PR1 owes is only that its additions be ADDITIVE: the v3 reader is a new member, `matcherCovers` keeps its existing order, and no production decision path consults the new ceiling. **→ PR2** | `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` → `PR1 ships the ceiling adapter UNWIRED: every new name has an audited consumer set` (nothing in production names the new algebra, so nothing can switch on it) + `packages/runtime/test/a3p3-permission-mutation-authority.test.ts` (the pre-existing existential legs, unmodified and still green) + `packages/runtime/test/a4p1-authority-envelope.test.ts` → `matcherCovers keeps its fail-closed order: identity BEFORE the containment seam` (the alias delegates; it does not re-implement) |
| A5-21 | the `p4t6` scannable-file pin is recomputed by arithmetic, never copied forward | `packages/testkit/test/p4t6-session-event-scan.test.ts` (receipt in `baseline-closure/SUMMARY.md`) |

## Order-of-operations disclosure

The plan requires this file **before first GREEN**. Lane A (the Blueprint v3 carrier) reached GREEN
before this matrix was written; the algebra lanes (B, C) had not. Recording that plainly rather
than back-dating the file: the matrix exists before the *algebra* — the part whose invariants #1,
#2, #3 and #16 actually describe — went green.

## Citation integrity

Every `file:line` and `it('…')` title above is greppable. The pre-existing citations
(`a5a-pre-execute.test.ts:962-973` and `:1208-1214`, `proposal-store.ts:150-151`,
`a3p4-r4-authority-binding.test.ts` `A4`, `ADR … :743-762` / `:770`, plan `:126` / `:764` / `:822`)
were verified by reading those lines in this worktree at HEAD `3c310342` before writing them. The
rows marked `→ PRn` are deliberate non-claims: PR1 has no test for them and this matrix does not
pretend otherwise.

## Working notes this matrix refuted (recorded because a later PR read this file as guidance)

1. **There is no `EFFECT_VOCABULARY_MISMATCH`.** A working note carried "`deny` is an answer, never
   an input, so a `deny` in a `maximumEffect` approval position is a typed defect (ADR A5-22)".
   Checked at HEAD `3c310342`: `grep -rn EFFECT_VOCABULARY packages dev` → **zero hits**; and ADR
   **A5-22 is about something else entirely** ("the writer of a fact type owns both category maps",
   `:932`). The governing texts are plan `:26` ("`deny` is terminal for a concrete invocation; only
   `ask` enters approval") and ADR A1-4 (`:777`). Rejecting a `deny` rule in the approval lookup
   would also contradict spec §24.2, whose meet table has `decided(deny)` as both a row and a
   column, and the shared document grammar, which admits `deny` in `maximumEffect` for BOTH v3
   carriers. So `narrowingForApproval` **returns** a declared `deny`; what it must never do is
   **manufacture** one from absence.
2. **A Member is not a document-binding position.** spec §7.4:300-302 lists exactly three arms and
   `:307` states "a Member cannot review at all". A restriction-preserving reading (hand Member both
   documents because "narrowing can't hurt") would have invented a fourth table row the spec does
   not have, and given PR4 a ceiling to consult for a reviewer that must not exist.
