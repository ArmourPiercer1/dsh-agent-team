# Owner decisions needed to finish the candidate

Six items are blocked on a ruling, not on work. Each is stated with what is MEASURED today, the options, and
what each option costs. Nothing here is a request to relax a safety invariant; every option either preserves it
or states plainly where the governance level changes.

Ordered by how much they block: items 1–2 block D acceptance claims; items 3–6 block capability rows.

---

## ROUND 117 (2026-11-25) — DECIDED: the Candidate Acceptance Gate is a VERSION gate

**Status: DECIDED by the owner, 2026-11-25.** This is a ruling, not an open question; it is recorded here in
the register of owner decisions because it changes the contract's definition of `PRODUCT-PROVEN`.

**The decision.** The Candidate Acceptance Gate (`scripts/candidate-acceptance-gate.mjs`,
`.github/workflows/candidate-acceptance.yml`) is a **VERSION gate, not a per-PR gate**.

- It is **NOT required on ordinary PRs.**
- It **IS the formal gate for a candidate/release version**: it must run, be green, and be **Required** at
  the **frozen candidate SHA** before a version is declared deliverable.

**The rationale (the measured basis, not an estimate).** One dual-host candidate-gate run is **~84 minutes
of wall clock** on a warm machine (round 109 measured `17:17:46 → 18:41:34` = `83 m 48 s`; an earlier pair
measured `74 m 41 s`). It provisions and builds **both** pinned pristine hosts and boots the product four
times per host — **16 real host boots** — which is deliberately heavier than the whole daily Required set
(the ten-leg `ci-pr-gate --full` is a few minutes). Requiring it on **every PR** would therefore be a **10x
slowdown of the daily loop** for no added value on docs/script PRs, and would teach reviewers to bypass or
defer it. At a version freeze the same cost buys exactly what it is for: one immutable SHA, both host
generations, one machine verdict, one receipt.

**The rejected alternative: "required on every PR".** Rejected explicitly, for that cost/relevance
trade-off. It is recorded as a *rejected option*, not as an oversight or a pending decision. Anyone
re-litigating it must argue against the measured 84-minute cost, not against an unstated assumption.

**What changes in the contract.** `PRODUCT-PROVEN` is redefined — it now means:

> *gate-backed at the **frozen candidate SHA** of a version, with the version gate **Required** and green at
> that SHA and its `version-gate-receipt.json` verified there* — **NOT** "covered by every PR's Required CI".

**No row is PRODUCT-PROVEN today**, and none becomes so until a version gate is frozen, Required and green at
that SHA. The gate's 31 judges per host can only speak to **C2, C3, C5, C6, C8, C9, C12 and C13's
fs/subprocess base faces**; they **never** cover C1, C4, C7's cold half, C10, C11, C13's PTC/web/terminals/
userQuestions faces, C14, C14b, C15, C16, C17 or C18 — so no blanket coverage may be inferred.

**The mechanism (implemented).** Version-path triggers (`push` tags `v*`, branches `release/**`,
`candidate/**`; `workflow_dispatch` with an optional 40-hex `head`); the PR path stays a **non-required
opt-in** (label-gated); strict head binding (`graded == checked-out == requested`); a published
`version-gate-receipt.json` bound to the gate's own verdict by path + sha256 digest; a stable
`version-gate (Required at frozen candidate SHA)` context verified fail-closed by
`scripts/version-gate-verify.mjs`; and a manifest classification that `scripts/eb3-ci-required.mjs` **asserts**
(promotion to a required layer, removal of the classification, deletion of the stable job, or un-gating the PR
path is a red). Owner procedure and the exact ruleset: **`VERSION-GATE.md`** §5–§6.

**What is NOT done by this decision.** No branch/tag protection rule has been applied (owner action), no
version has been frozen, and the version gate has not been dispatched end-to-end. See
`VERSION-GATE.md` §7–§8 for exactly what is and is not exercised.

---

## ROUND 86 CORRECTION — the current state of each item (the sections below are the round-63 record)

Four of the six are **answered or implemented**; keeping them listed as open decisions was the largest
staleness in this candidate's evidence set. Read this block as the status; read the sections below as the
history and the option analysis.

| item | state at round 86 | evidence |
| --- | --- | --- |
| 1 process lane (`bash`/PTY/PTC) | **bash/PTY resolved and live-proven** — the shipped preset DOES mount `@deepseek-ai/dsh-tool-bash-persistent` (`cordis.patch.yml:363-368`), `io.process` is no longer needed (process authority is a compiled tool-level `execution` declaration, `admission.ts:424-466`), and `d3:persistent-subprocess` is PROVEN in two agreeing boots (round 76). **PTC: CLOSED BY OWNER RULING (round 92)** — `docs/reviews/20261124-0151.txt` §PTC formally rules PTC / `run_code` NOT SUPPORTED this generation (amendment `ADR-ptc-unsupported.md`). It is no longer a `CORE_SEAM_BLOCKER` and no longer an open owner ask: the refusal is the supported behaviour, typed, with status `unsupported-by-product-ruling` and zero worker. The "shipped preset never mounts the persistent shell", "`d3` stays REFUTED" and "PTC's upstream seam is an open decision" sentences below are FALSE at this HEAD. | `OWNER-DECISIONS.md` §1 (historical); `ADR-ptc-unsupported.md`; `PTC-FOUR-PART-FINDING.md` (the measured basis); report §6.3 |
| 2 runtime team creation (405) | **RESOLVED (round 74)** — the S6 management plane is built/installed and `team.create` mints a Team at runtime; the "cannot create a team at runtime / 405" section below is history. | `ESCALATION-centre-row-creation-entrance.md`; report §6.2 |
| 3 settlement recheck | **RESOLVED (round 73, owner Option A)** — the "cannot be produced without widening the settlement state machine" text below is superseded; `ADM-119` is the positive. | `CONTRACT-CHANGE-REQUEST-settlement-recheck.md:51` |
| 4 realm-less admission | **DECIDED (round 98, owner ruling `docs/reviews/20261124-0151.txt` §Realmless) = OPTION B** — a governed member with no enforceable confined provider is REFUSED (`MEMBER_CENTRE_UNWIRED`, `ADM-44`/`ADM-44b`); an ungoverned row is allowed under DSH's own model but reported `ungoverned`/`uteProtected:false`. | `ESCALATION-realmless-admission.md`; §4 below |
| 5 search-face governance depth | **DECIDED (round 98, owner ruling §Search) = SHAPE B is the declared support level, NOT full dynamic permission governance** — an Overlay deny on ordinary file reads does not deny `grep`/`glob` (`no-opinion`); the parent-allow/child-deny recursive negative control is GREEN (`SLICE-39`); Shape A remains future work. | `CONTRACT-CHANGE-REQUEST-search-face.md`; §5 below |
| 6 Alpha.6 routing | **IMPLEMENTED (round 84)** — formal routing is a join on existing surfaces (no new axis, no `CORE_SEAM_BLOCKER`); a coherent row is admitted, incoherent pieces are refused and recorded. The "config gate refuses the opt-in on every row / routed path unreachable" text below is superseded; the remaining gap is a **live routed wake**, not a ruling. | `ALPHA6-FORMAL-ROUTING.md`; report §6.5 |

**So the owner is asked for two rulings (items 4 and 5)** — the PTC upstream-seam ask was ANSWERED by the
round-92 owner ruling (NOT SUPPORTED this generation; `ADR-ptc-unsupported.md`) — not six.

---

## ROUND 98 (2026-11-24) — the two older rulings are DECIDED and IMPLEMENTED

**Owner ruling: `docs/reviews/20261124-0151.txt` §4 ("另外两项较早的裁决").** Both are recorded here as
decided, with the exact scope the ruling gave them.

### Ruling 1 — Realmless admission: **OPTION B (refuse)**

A governed Team Member with **no enforceable confined provider** is **REFUSED**. Rationale (the owner's):
even if Admission has already taken an ALLOW against the compiled ceiling, the access upper bound cannot
be claimed if the Provider that actually executes is not bound by that ceiling.

- **Typed refusal: `MEMBER_CENTRE_UNWIRED`** (kept). The ruling allowed `ADMISSION_PROVIDER_UNCONFINED`
  as the more accurate name; the decision is to KEEP the existing code because it is the identifier
  ADM-44, the D report and the escalation already use, it is not a member of the closed
  `AdmissionRefusalCode`/`HOST_SURFACE_REFUSALS` vocabulary, and renaming an established refusal buys
  wording, not enforcement. The message states the accurate semantics.
- **The ungoverned path is NOT refused, but must be labelled.** A host run mode with Team governance not
  enabled (no `centreStatePath`) may keep DSH's own permission model; it is reported as
  `mode: 'ungoverned'`, `uteProtected: false` (`admissionModeOf`, plus one observation) and is **never**
  reported as UTE-protected.
- **Implementation (round 98):** the round-35 check ran before the mount attempt and only asked whether
  the row DECLARED a realm source; a row declaring one whose provider compiled no realm
  (`compiledFor → undefined`) slipped past it. `memberAdmissionGate` now runs on the MOUNT RESULT, after
  `mountMemberA5sfRealm` and before `installMemberExecution`/the preset mount/any tool body. Arms
  `ADM-44`, `ADM-44b` (governed+unconfined ⇒ typed refusal + zero files; ungoverned ⇒ allowed + reported
  ungoverned; placement pinned).

### Ruling 2 — Search face: **Shape B is the DECLARED support level for this generation**

Shape B is the support level, and it is **NOT full dynamic permission governance**: a durable Overlay
deny aimed at ordinary file reads does **NOT** automatically deny `grep`/`glob`; the Overlay returns
`no-opinion` for tools outside its vocabulary, and the compiled FS Read Lane alone judges the search.

- **Required negative control (owner):** allow a parent directory but DENY a child, and prove a recursive
  search does not read or return the protected child's contents. If the Provider/OS limits cannot
  guarantee that, forbid the dangerous search scope or escalate to Shape A — **do not merely check the
  root path passed to `grep`.**
- **Round-98 result: the dangerous scope is FORBIDDEN, and the control is GREEN (`SLICE-39`).** The real
  `grep` module runs through the real confined `subprocess` face; the face compiles the effective lane
  once (`compileExecutionProfile`), Landlock has no negative rule, so a nested deny is
  `PATH_NESTED_DENY_UNEXPRESSIBLE` and every spawn from that realm is refused before a process exists.
  Positive control (no child deny) returns the child's token; negative (child deny) returns no match and
  no child byte, not even the child path; the centre still records `decision=allow` for the ROOT, so the
  control cannot pass by root-checking alone.
- **Limit disclosed:** this is a wholesale refusal of the confined process face for that realm (a shell
  on the same realm is refused too), not per-file carving. Shape A (a search face with a subtree resource
  in the closed vocabulary) is the only shape that can express a nested deny precisely; it is future
  work, not delivered here.

---

## ROUND 106 (2026-11-24) — the owner approved the three pending decisions; rulings 1 and 2 implemented

**Owner rulings: review `20261124-2120`, rulings 1 and 2** (ruling 3 is approved but not implemented this
round). Round 106 changes **no product behaviour beyond ruling 2**, which is a tested-law implementation,
not a new feature: no second authority, no upstream patch, no weakened assertion, no widened timeout, no
retry loop, no rewrite of historical evidence.

### Ruling 1 — the Subprocess/PTY scope is APPROVED (product scope only)

`SCOPE-subprocess-ask.md` is **APPROVED BY OWNER (2026-11-24)**. The approved promise, exactly:

> **This generation promises `allow`/`deny` for Subprocess/PTY. Per-call `ask` for process execution is
> NOT supported and remains fail-closed.**

- **Process Ask is `UNSUPPORTED BY PRODUCT RULING`** — the same machine-visible class as PTC
  (`ADR-ptc-unsupported.md`), not a defect and not a pending feature. The typed fail-closed refusal is the
  supported behaviour.
- **The historical `d4:ask-execute-process` REFUTED evidence is preserved verbatim** (round 102): 16/17
  PROVEN, 1 REFUTED, **zero process, zero bytes, settlement `FAILED`**. The real ask→approval→grant
  consumption **did occur**; the PTY spawn then failed with the host's `NO_BACKEND` **before any process
  existed**. It is not a positive test and it is not `REFUSED`/`not-started`.
- **A future generation that wants per-call process `ask` support requires a NEW PRODUCT CONTRACT plus a
  PROCESS BOUNDARY DESIGN.** Concretely (and nothing less): a governed PTY backend on the binding realm,
  and a process-scoped receipt that cannot widen the kernel profile, verified at the governed spawn point
  before any process exists (`SCOPE-subprocess-ask.md` §5). Neither is scheduled by this ruling; landing
  only one of them still leaves no process `ask` promise.

### Ruling 2 — P0-2 CLOSED: the lawful no-settlement boundary (no upstream seam needed)

The owner's formal law, recorded **verbatim**:

```
No Admission + No Body Start  =>  No UTE Settlement   (lawful)
Admission Exists              =>  Terminal Settlement Required
Body started + unconfirmable  =>  UNKNOWN (existing rule)
```

Route (b) of the former P0-2 ask is therefore ruled, and **no public batch-completion seam is required**.
The five implementation requirements and where each is measured:

1. **The host's `ABORTED_BEFORE_DISPATCH` return stays untouched; never fabricate a `tools/result`.**
   `pre-dispatch-abort.mjs` is a reader of the host's returned value; it emits no tool event.
   `SLICE-40` asserts the host's own pre-dispatch result survives and that the observer recognised its
   code (`completions()[0].observed === 1`).
2. **`LEDGER_EXECUTION_UNBOUND` keeps failing closed.** `fact-ledger.mjs#recordExecution` refuses an
   execution fact with no admission record before it appends; `SLICE-40`'s durable half asserts zero rows
   plus the reported refusal; `SLICE-42` pins the guard-before-append order in source.
3. **`SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` remains a diagnostic report only, never a settlement.**
   `settlement-port.mjs` reports the gap and writes nothing; `SLICE-40` asserts the report names each
   ExecutionId and that the store holds zero records.
4. **Pre-admission cancel negative controls (`SLICE-40`).** On the ASK leg and on an effect-bearing
   `write`: no body, no provider call, no approval request, no minted/spent one-shot grant, no written
   byte, no admission/settlement/execution-settlement state row; the durable ledger holds zero rows.
5. **The exception cannot be used once an admission exists (`SLICE-41`).** A Stop fired from the
   admission record's own sink (a real `AbortSignal`) is admitted-then-stopped: the admission fact exists
   (`decision: 'allow'`), the Stop is recorded with `phase: 'pre-dispatch'`, the record reaches the
   terminal `CANCELLED` settlement (`dispatch`/`bodyOutcome` `not-started`), the no-record report is
   absent, and re-stating the Stop is idempotent rather than a second/no settlement.
6. **Source-level pin (`SLICE-42`).** Exactly one execution-row writer in the durable ledger, guarded by
   the admission check before its append; exactly one production `recordExecution(` call site
   (`member-execution.mjs`, on the member's own ledger); exactly one `record(fact)` in the fact builder,
   after `admissionOf`; one `tools/result` subscription that calls the one writer.

**P0-2 is CLOSED** in the single status table (`D-ACCEPTANCE-REPORT.md` row 31) with this ruling cited.
`SETTLEMENT_NO_RECORD_BEFORE_ADMISSION` stays described as a **report**. No existing refusal code was
removed or renamed. The observer is still not wired into a real host's own agent loop: recorded as a
**coverage limit, not an acceptance blocker**, because the law now defines what is owed when the host owes
no event.

---

## ROUND 89 ADDENDUM — four rulings the two new in-repo seams need

Rounds 87/88 measured two seams that are **Team-side, not upstream** (`D-ACCEPTANCE-REPORT.md` §10
G1/G2). They are not wiring bugs and not `CORE_SEAM_BLOCKER`s; each is a product/owner decision.

| ruling | question | options (with cost) | evidence |
| --- | --- | --- | --- |
| **R1** | **Alpha.6 case-bearing ask producer** — should the ordinary `ask` lane open a durable Alpha.6 review case? | **Yes:** make the admission ask call `requestApprovalLeg` with `authorityScope`/`operationFingerprint`/`requestedEffect` (new ask shape; routed wake becomes reachable). **No:** accept `d4:routed-wake` REFUTED for this generation (level unchanged, limitation disclosed) | `d-boot-feasibility/d4/README.md` §4.2; `alpha6/root-router.ts:209`; `review-router/policy.ts:68-75`; `admission-port.mjs:158-165` |
| **R2** | **BL-30 route (a)** — flip the production ask coupling to `guarded`? | Gains a guard-consumable approval; **cost:** two one-shot paths over one decision, and the Stop cascade stops abandoning a pending ask (`ADM-57`, round-62 live Stop) | `bl-30-ask-consumer/README.md` §3; `control/service.ts:4155-4165`, `:4289`; `admission-port.mjs:76-79` |
| **R3** | **BL-30 route (d)** — let the OS/Provider plane read the ONE decision the centre enforced? | Preserves inline coupling and Stop; **cost:** a new cross-plane read port — the OS plane becomes a reader of the centre's per-call decision (admission-duty shape change) | same; `provider-capabilities.ts:196-210`, `:315` |
| **R4** | **BL-30 status quo** — keep the refusal for this generation? | No safety cost; an `ask`-disposition call does not execute, `IO_ASK_REQUIRES_APPROVAL` is the intended level, BL-33's consumption half stays blocked | same; measured live in `d4/runs/boot01/wake-measurement.json` |

Routes (b) substitute a different `AskApprovalAuthority` and (c) mint a second guarded row are **not**
options: the contract refuses both (`approval-takeover.ts:63-68`; one call site / single consumer).
**Until one of R1–R4 is ruled, no row moves and no product source is changed.** The two older rulings
(items 4 and 5 above) remain open and are unaffected by this addendum.

---

## 1. Process lane — `bash`, PTY, `run_code` (C-subprocess / C-pty / C-ptc)

**Measured (round 63, live host):** `bash` on a governed Member is refused `ADMISSION_AXIS_UNSUPPORTED`
(`process.exec` deny, settlement `ADMITTED → REFUSED`). Declaring `io.process` is REJECTED by the frozen v4
shape as `MALFORMED_DTO` (`blueprint-v4.ts:187-197`). The shipped preset never mounts
`dsh-tool-bash-persistent`.

**Why it is not a bug:** admitting a shell with nothing to judge it against would claim an enforcement that does
not exist (`ADM-18`, `ADM-24`). The three rejected shortcuts (judge on the write lane, a second realm
declaration, deriving from `executionBoundary`) are recorded in `CONTRACT-CHANGE-REQUEST-process-lane.md`.

| option | what it means | cost |
| --- | --- | --- |
| **A** (engine's preference) | add `process` to the v4 ceiling with the same lane grammar | contract change to a frozen closed field set; then compile + mount + rungs 5–6 positives |
| **B** | a v5 schema carrying the lane; v4 worlds refuse a row that declares one | new schema version; two schema paths to maintain |
| **C** | declare subprocess/PTY/PTC NOT SUPPORTED in this generation | C rows become `UNAVAILABLE BY RULING`; B rung 6 stays in-process-only; the typed refusal is shipped behaviour |

**If nothing is decided:** the safe refusal stays. No row can claim subprocess support, and `d3:persistent-
subprocess` stays REFUTED. That is honest but incomplete against D's wording.

---

## 2. Runtime team creation on a centre row (the 405)

**Measured (rounds 58–59):** a centre-configured row boots and cannot create a team at runtime —
`POST /team-remote/team.create` returns **405**, because C-remote refuses to build the S6 plane (its dispatcher
is authorized by a server-derived principal the centre cannot speak for) and that plane is the product's ONLY
creation entrance. The acceptance Team is therefore BOOT-CREATED (`root.ts:4888`).

| option | what it means | cost |
| --- | --- | --- |
| **A** | a centre-governed creation command with a declared axis | contract change (no such axis exists) |
| **B** | a non-remote product creation route that goes through the centre | product feature; no contract change |
| **C** | accept boot-created teams on centre rows; record the limitation | no product change; D must state "no runtime creation on a centre row" |

**Current state:** C is what the D evidence already does, and `ESCALATION-centre-row-creation-entrance.md`
records it. B is the product-shaped fix and is the engine's recommendation after C unblocked measurement.

---

## 3. Settlement recheck contract change

`CONTRACT-CHANGE-REQUEST-settlement-recheck.md` (option A): the REFUSED-after-`allow` cell cannot be produced
without widening the settlement state machine. Two cells remain explicitly unreachable and are documented as
such rather than faked.

## 4. Realmless admission

`ESCALATION-realmless-admission.md`: (A) admit against the compiled ceiling and record `provider: 'unconfined'`,
or (B) refuse. The code today REFUSES (`MEMBER_CENTRE_UNWIRED`, ADM-44) — the docs that said otherwise were
corrected in round 67. A ruling would settle whether the refusal is the final answer.

## 5. Search face governance depth

`CONTRACT-CHANGE-REQUEST-search-face.md`: shape B is implemented (in-lane `grep` runs, overlay abstains,
`overlayOutcome: no-opinion`), so the capability is back. Open question is whether the durable overlay should be
able to DENY a search (shape A: a subtree search face in the permission vocabulary). Today the LANE ceiling is a
search's entire governance, and the centre judges the search ROOT, not each file a scan opens.

## 6. Alpha.6 review routing

The refusal is now recorded at the host entry (round 68). The ROUTED path is still unreachable: there is no
review-routing axis in the centre (`admission.ts:32/57/114`), and the config gate refuses the opt-in on every
row. Two shapes: (A) a compiled review-routing axis (contract change), or (B) a ruling that a record-only
approval fact on `host.service` IS adjudication, then wire the PA approval-fact join.

---

## What the engine recommends

1. **C for items 1 and 2** if the goal is a reviewable candidate now: both limitations are already measured,
   typed and recorded, and neither pretends to be enforcement.
2. **B for item 2** as the next product increment — it is the only one of the six that restores a user-visible
   product capability without touching a frozen contract.
3. **A for item 1** as the contract decision it is; it also unblocks rungs 5–6 of the B ladder.
4. Items 3–5 need a sentence each, not a build.
5. Item 6 should stay refused until the routed path can be governed; the recorded refusal is already correct.

## What must not happen

- No item may be closed by re-enabling an ungoverned plane, inventing an axis, or widening an invariant for the
  sake of a green row.
- No row moves to PRODUCT-PROVEN on the strength of these documents; that needs the **version freeze**
  (`VERSION-GATE.md` §6) — a frozen candidate SHA, the version gate Required and green there, and a verified
  receipt — plus a judge that actually asserts the row.
