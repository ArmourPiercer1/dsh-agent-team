# Owner decisions needed to finish the candidate

Six items are blocked on a ruling, not on work. Each is stated with what is MEASURED today, the options, and
what each option costs. Nothing here is a request to relax a safety invariant; every option either preserves it
or states plainly where the governance level changes.

Ordered by how much they block: items 1–2 block D acceptance claims; items 3–6 block capability rows.

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
| 4 realm-less admission | **OPEN** — the ruling is still wanted; the code refuses (`MEMBER_CENTRE_UNWIRED`, `ADM-44`). | `ESCALATION-realmless-admission.md` |
| 5 search-face governance depth | **OPEN** — shape B shipped; shape A (overlay can deny a search) is the open ruling. | `CONTRACT-CHANGE-REQUEST-search-face.md` |
| 6 Alpha.6 routing | **IMPLEMENTED (round 84)** — formal routing is a join on existing surfaces (no new axis, no `CORE_SEAM_BLOCKER`); a coherent row is admitted, incoherent pieces are refused and recorded. The "config gate refuses the opt-in on every row / routed path unreachable" text below is superseded; the remaining gap is a **live routed wake**, not a ruling. | `ALPHA6-FORMAL-ROUTING.md`; report §6.5 |

**So the owner is asked for two rulings (items 4 and 5)** — the PTC upstream-seam ask was ANSWERED by the
round-92 owner ruling (NOT SUPPORTED this generation; `ADR-ptc-unsupported.md`) — not six.

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
- No row moves to PRODUCT-PROVEN on the strength of these documents; that needs the D report's limits read as
  limits.
