# V016-PREVIEW-CLOSEOUT-PLAN — the ordered work from the current tree to a GO/NO-GO recommendation

**Written:** 2026-11-11 by the **DOCS lane** (`task/closeout-docs-20261111`). This file is a **plan**,
not evidence and not a release decision.
**Baseline:** written against `origin/master` @ `b5df94c3f`; **rebased and re-read on 2026-11-12 against
`origin/master` @ `0d74121ae`**, where #719, **#720** (PD-42 gate), **#729** (abort class), **#733**
(J05J06 identity carry), **#730/#734** (native bash), **#736** (cold-boot settlement), **#735** (joint
acceptance 11/11) and **#737** (closeout status) are all merged. The ordered **exit conditions below are
unchanged**; §1.2 records which of them are met on that tree, so a reader can tell a plan from a status.
**Authority pointer:** `as20261109r1` (`sha256:d85fdc1a…398b3`) — **unmoved by this plan**.
**Frozen candidates:** `cand-v0.1.6-1` @ `168266dbf`, `cand-v0.1.6-2` @ `bb3c158eb` — immutable.
**Candidate this plan aims at:** `cand-v0.1.6-3`, which **does not exist yet** and may only be
frozen after step A5.
**Evidence class of this file:** none. It records no boot and moves no grade.

> **Status of the Preview release gate — read before quoting anything here.**
> The gate named **`v0.1.6 Joint Preview Release Gate`** is a **proposal awaiting the Owner's
> written approval**. It is not in force. Until that written approval exists, owner decision
> **D12** (`OWNER-DECISIONS-2026-11-09.md` §D12 — strict candidate semantics) stands unchanged, and
> the existing G2–G5 gates stand unchanged with it. **The developer agent must not rewrite D12
> unilaterally**, must not treat this plan as the gate, and must not create an RC tag or a
> `CANDIDATE-C2` claim on the strength of it. If the Owner never approves the proposal, this plan
> still describes the honest order of work; it just does not shorten any gate.

---

## 0. The two rules that bind every step

### 0.1 No rewritten acceptance criteria

Acceptance criteria are **fixed inputs**. A step may:

- **meet** a criterion (with evidence),
- **fail** it (report FAIL), or
- be **explicitly waived in writing by the Owner** for a named criterion and a named candidate.

A step may **never** redefine, soften, split, merge, re-scope or replace a criterion in order to
turn a NO-GO into a GO. If a criterion turns out to be ambiguous, the ambiguity is a finding for
the Owner; it is not an invitation to write a friendlier criterion. Any such rewrite invalidates
the evidence packet and makes the verdict **NO-GO** by construction.

### 0.2 Append-only history

Past measurements, ADRs, frozen candidate manifests and dated disclosures are **not rewritten**.
Where this plan or its companion docs supersede an earlier sentence, they add a **dated CORRECTION
block** and say what is superseded. A line-number citation that moves is moved in the same commit
as the text that moved it, and the commit message says so.

---

## 1. Critical path (ordered; each step must exit before the next starts)

| # | Step | Owner | Exit condition (all must hold) |
|---|---|---|---|
| **A1** | **P0-1 — approved execution must not bypass the governed realm** | Product lane (implementation) + independent reviewer | A dual-family v5 Team's approved `bash` call either executes through the confined provider (≥1 attributed a5sf allow fact, lane-correct) **or** is refused before execution with a typed answer and **0** executions; same-Team measurement passes **×2** fresh HOMEs; no second permission authority and no upstream patch |
| **A2** | **F-3 / P0-2 — the assigned Officer receives the `parameter-permission` ask** | Product lane + independent reviewer | The parameter-permission leg carries `blueprintContentHash`/`blueprintRevision`; `resolveAssignedOfficer` returns the Officer; a real `bash` ask wakes the **Officer** (Leader wake 0) in **×2** runs |
| **A3** | **Abort-class — the execution fact is truthful for every abort reason** | Product lane + independent reviewer | No `succeeded` is recorded without an observed end across the abort matrix, including a forwarded host deadline / `inherited-signal` abort (`unknown`, never `succeeded`); host-free pins plus one real arm |
| **A4** | **PD-42 acceptance completion (P0-3)** | Acceptance lane (boots) + independent reviewer | In **one** v5 Team carrying both families: ceiling arm, Goal, Stop, relay and cold recovery all PASS or are Owner-waived; two fresh-HOME runs agree on every asserted field |
| **A5** | **Freeze `cand-v0.1.6-3` and its tarball** | Release engineer | Manifest freezes the post-A1…A4 SHA, the same host `639ed01539`, the same Authority `{as20261109r1, d85fdc1a…}`; `verify-candidate.mjs --manifest` PASS; tarball sha256 recorded; `cand-v0.1.6-1/-2` and `current-authority.json` byte-unchanged |
| **A6** | **Independent C2-A + C2-B on one SHA/tarball/host** | Independent reviewer(s) who wrote no product code | Both axes run on the **same** frozen SHA, the **same** tarball and the **same** host; per-case verdicts signed into the candidate manifest; C2-A PASS **and** C2-B PASS — or an explicit NO-GO |
| **A7** | **Document set update** | Docs lane | Preview Contract, Preview Readiness, `docs/STATUS.md`, release notes, matrix notes and the debt register are updated **append-only** against A5's candidate; no criterion text changed; `docs-probe` clean |
| **A8** | **GO/NO-GO recommendation** | Integration Owner (recommends) → Owner (decides) | A written packet (see §3) presented; the Owner's written decision recorded. **NO-GO with a minimal fix list is an acceptable outcome** |

### 1.1 Why this order

- **A1 before A2/A4.** P0-1 is the ownership defect: until the approved dispatch has one owner
  (realm or tool plane, not both in conflict), the ceiling arm in A4 would measure a moving target.
  A2 is independent enough to run in parallel with A1 only if it touches no realm/dispatch file;
  otherwise keep it serial to preserve one-writer-per-file.
- **A3 before A4.** A4 records execution facts. If the abort class is still mis-classified, the
  acceptance run can write a false `succeeded` into the very evidence the GO rests on.
- **A4 before A5.** A candidate frozen before the acceptance would freeze an unmeasured tree; D12
  forbids that.
- **A5 before A6.** C2 must cite the immutable SHA it measured. A C2 run on a branch tip is not a
  candidate claim.
- **A6 before A7/A8.** Documents describe the measured candidate; they do not lead it.
- **A7 before A8** only because the Owner's packet must be readable; it may be prepared in draft
  earlier, but it is not final until A6's verdicts exist.

*(2026-11-12: the plan's own history diverged from its order — A2 and A3 were delivered by separate
lanes before A1 exited, and A4's arms were measured on the merged tree while A1 was still open. That is
recorded here, not endorsed: the ordering's load-bearing purpose — never freeze a candidate on an
unmeasured tree — is intact because A5 has not started, and A1/A4 are both still open.)*

### 1.2 Status on `origin/master` @ `0d74121ae` (dated addendum, 2026-11-12; exit conditions unchanged)

| # | status | what closed it, and what did NOT |
|---|---|---|
| **A1** | **OPEN** | The two product defects the joint driver caught are fixed: **#734** (an adopted native name is not the tool plane's to own, so the dispatch door binds the native admission edge) and **#736** (a cold boot owns the `parameter-permission` lane's settlement). `J04` now passes with `pinnedDefinition && bashExecuted`. **`J04` does not satisfy A1**: its verdict does not measure ceiling enforcement on the approved `bash` call, and its detail discloses `realmTerminalFacts=0` in every run. A dedicated real-Host bash-governance negative-control acceptance is being built separately (write in/out of ceiling, PTY persistence, cross-member isolation, pre-PTY id refusal, `danger-full-access` narrowing, denied approval → zero executions). A1 stays OPEN until that suite passes. |
| **A2** | **DONE — #733** (`49a66fea3`) | The `parameter-permission` leg carries the frozen `BoundBlueprintIdentity`, the owner template and the verified tool coordinate; `resolveAssignedOfficer` returns the Officer and a real `bash` ask wakes it (`j05j06-approval-lane-20261111`, two runs; joint acceptance `J06` on the final tree: `routedToOfficer=true`, decider = the officer member instance, `identityCarried=true`, `legDecided=true`). **Not closed by this**: a different defect (register **PD-43**) can still refuse the woken Officer's decision when the owner member row is `CREATED`/`SETTLED`. |
| **A3** | **DONE — #729** (`d8bdb0ce2`) | Classification reads the backend's `settlement`: only `settlement.kind === 'completed'` is `succeeded`; every other settlement and every abort-shaped throw (`AbortError`/`ABORT_ERR`) is `unknown`. Live `hook`-cause falsifier in `dev/agent-workflow/evidence/pd41-abort-class/`; the pre-fix `succeeded` on that shape is kept as the control that makes the fix non-vacuous. |
| **A4** | **PARTIAL** | On `6ea7d8dd4` the joint acceptance measured **one** dual-family v5 Team twice, **11/11** (`J01` both families, `J02`/`J03` fs ceiling allow/deny, `J07` Goal + Stop, `J08` relay refusal, `J09` Sticky Stop, `J10` cold recovery, `J11` no replay). Its prerequisite (#720) is merged. **Missing**: the ceiling on the approved `bash` leg — that is A1's arm — so A4 cannot be called complete before A1. |
| **A5–A8** | **NOT STARTED** | No candidate has been frozen. `cand-v0.1.6-3` **does not exist**; `cand-v0.1.6-1`/`-2` remain immutable and do not contain this round's fixes; the Authority pointer is unmoved; no tag and no RC. |

**Why A1 is stated as OPEN even though the joint surface is green:** the joint acceptance is a `DEV-LIVE`
measurement of eleven propositions, and `J04`'s proposition is "the governed `bash` IS the pinned native
definition and its body ran". Ceiling enforcement of an approved call is a **different** proposition that no
arm in that kit asserts. Turning "native + executed" into "bounded by the Member's compiled ceiling" is the
exact overclaim this plan exists to prevent.

## 2. Per-step dossier

### A1 — P0-1, approved execution through the governed realm

- **Site.** `packages/runtime/team-services/src/product-assembly.ts` (realm mount),
  `packages/runtime/tool-dispatch/*` (plane binding + dispatch door),
  `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (realm terminal). Audit C's report is the
  design input; this plan does not choose the mechanism.
- **What must be true.** The approval plane's execute leg and the Alpha.5 confined provider have
  **one** owner for a governed tool. The approved call must not silently run on a plane that
  displaces the Member's compiled ceiling.
- **Evidence requirement.** A real-Host, dual-family v5 Team, two fresh HOMEs, same assertions:
  the approved `bash` either executes through the confined face with attributed guard facts, or is
  refused **before** execution with a typed code and zero executions. Include the pre-fix control
  (the measured `TOOL_BINDING_UNVERIFIED` / 0-fact shape) so the change is visible.
- **Exit / fail.** Exit when both runs agree on the same shape and the independent reviewer agrees
  the ceiling was enforced or the call was refused pre-execution. **Fail** if the call still
  executes on a plane outside the ceiling, or if "enforcement" is only an observation string.
- **Must not.** Add a second permission authority; patch upstream; reopen `cand-v0.1.6-1/-2`.
- **Status (2026-11-12): OPEN.** #734 and #736 fixed the two defects that made `J04` fail, and `J04` now
  passes (`pinnedDefinition && bashExecuted`), but that verdict is **not** this step's exit condition: it
  says nothing about the ceiling, and every run discloses `realmTerminalFacts=0`. The dedicated
  bash-governance negative-control acceptance is the instrument that can close A1; until it does, A1 is
  open and no document may cite `J04` as satisfying it.

### A2 — F-3/P0-2, Officer receives the parameter-permission ask

- **Site.** `packages/runtime/operation-permission/pre-execute-adapter.ts` (request creation) and
  the assigned-Officer resolver; `pre-execute-adapter.ts` builds the leg **without**
  `blueprintContentHash`/`blueprintRevision` today.
- **Evidence requirement.** A real Host, v5 Team, `ordinaryToolApprovals.default: officer`, one
  legal Officer: a governed `bash` ask produces a `parameter-permission` leg that routes to the
  **Officer**, not the Leader; two agreeing runs; the Leader's wake count is 0 for that leg.
- **Exit / fail.** Exit when both runs show Officer routing for the parameter-permission leg and
  the leg's Blueprint identity is durable. **Fail** if routing still resolves to the Leader or if
  the fix forges identity.
- **Status (2026-11-12): DONE by #733 (`49a66fea3`).** The leg carries the frozen bound identity, the owner
  template and the verified tool coordinate; the route returns the Officer and the Officer decides the leg
  (`j05j06-approval-lane-20261111` two runs; joint acceptance `J06`). The Blueprint identity is durable on
  the row. A **different** defect is still open (PD-43, the review-facts lifecycle gate); it is not this
  step, and A2's own exit condition is met.

### A3 — abort-class, truthful execution facts

- **Site.** `packages/tools/a5p5-tools/src/pipeline.ts` (`executionOutcomeOfAnsweredCall`),
  `packages/tools/process-family/src/shell-mechanics.mjs` (`shellCancelled`).
- **What must change.** The classification must not depend on `reason.kind` being `user`/`parent`.
  An abort with a forwarded host deadline, `inherited-signal` or a plain `AbortError` is an
  unobserved end and must be `unknown`.
- **Evidence requirement.** Host-free matrix pinning every abort reason (answered vs throw-shaped),
  plus one real arm where the abort reason is **not** `user`/`parent`, reading the durable execution
  fact. The pre-fix control must show `succeeded` to prove the pin is not vacuous.
- **Exit / fail.** Exit when no arm records `succeeded` without an observed end. **Fail** if any
  abort shape still writes `succeeded`, or if the fix changes consumption/ replay behaviour.
- **Status (2026-11-12): DONE by #729 (`d8bdb0ce2`).** The classifier consults the backend's settlement;
  `succeeded` exists only for `settlement.kind === 'completed'`; abort-shaped throws are `unknown`; the live
  `hook`-cause arm and the host-free matrix are in `dev/agent-workflow/evidence/pd41-abort-class/`. No
  consumption, replay or admission behaviour moved.

### A4 — PD-42 acceptance completion

- **Prerequisite.** #720 merged (**met**: `b29e10582`) and A1 landed (**NOT met**: A1 is open, see
  §1.2 and the A1 dossier).
- **Arms to run in one dual-family v5 Team.** (1) ceiling arm: the approved call is bounded by the
  Member's declared `memberIoCeilings`; (2) Goal: `create_goal` → rounds → Stop; (3) relay
  attribution; (4) cold recovery with no duplicate execution.
- **Evidence requirement.** Two fresh-HOME runs, same SHA, same host, agreeing on every asserted
  field; the ceiling arm's facts and the execution fact read from the durable store; the run
  manifests record the product SHA/tree.
- **Exit / fail.** Exit when every arm PASSes or the Owner waives a named arm in writing. **Fail**
  if the ceiling arm is skipped, if a run is re-used across SHAs, or if a "pass" is inferred from a
  different team shape.
- **Status (2026-11-12): PARTIAL.** The joint acceptance is one v5 Team with both families, twice,
  11/11 on `6ea7d8dd4` — Goal/Stop (`J07`), relay (`J08`), Sticky Stop (`J09`), cold recovery (`J10`) and
  the fs ceiling (`J02`/`J03`) are measured. The arm this step's first clause names — the ceiling on the
  **approved** call — is the approved `bash` leg, and that is **A1's** missing arm. A4 therefore stays
  open by its own exit condition ("fail if the ceiling arm is skipped"), and the fs ceiling is not a
  substitute for it.

### A5 — freeze `cand-v0.1.6-3`

- **Rules.** Freeze only after A1–A4 exit. Same host `639ed01539`, same Authority snapshot; do not
  move `current-authority.json`; do not touch `cand-v0.1.6-1/-2`; `v0.1.6` tag is **not** cut here.
- **Evidence requirement.** Candidate manifest + `verify-candidate.mjs --manifest` PASS + tarball
  sha256 + the C2 scopes A6 will use, all recorded in the manifest.
- **Exit / fail.** Exit when the ref is created once (no amend, no force-push) and verification
  passes. **Fail** if any input is missing or if a frozen artefact moves afterwards.

### A6 — independent C2-A + C2-B

- **Independence.** The reviewer wrote no product code on this round. Independence = "did not write
  the product", **not** an external signature; if an external human signature is required, say so.
- **Evidence requirement.** Both axes on the **same** SHA, tarball and host; ≥2 agreeing boots per
  axis where the axis requires agreement; per-case verdicts signed into the candidate manifest.
- **Exit / fail.** Exit on C2-A PASS **and** C2-B PASS. **Fail** on any axis failure — record it as
  a finding, do not re-run until green on a different tree without a new candidate.

### A7 — document set

- **Files.** `PREVIEW-CONTRACT-2026-11-16.md`, `PREVIEW-READINESS-2026-11-15.md`, `docs/STATUS.md`,
  `RELEASE-NOTES-0.1.6.md`, `TOOL-ACCEPTANCE-MATRIX.md` notes, `PRODUCT-DEBT-REGISTER.md`, the
  backlog's named blockers. Append dated blocks; do not rewrite historical sections or criteria.
- **Evidence requirement.** `node scripts/docs-probe.mjs --worktree-only` (the runnable gate —
  `scripts/doc-checks.mjs` is an import-only library and is **not** a gate) reports
  `blocking=0`; the debt-register test stays green; every line citation moved with its text.
- **Exit / fail.** Exit when the doc set describes A5's candidate and names every carried limit.
  **Fail** if a document claims a GO, a `V@B` move, or a criterion the evidence does not show.

### A8 — GO/NO-GO

- **Owner.** Integration Owner recommends; **Owner decides in writing**. The developer agent does
  not decide, tag, merge or publish.
- **Exit / fail.** Exit with a recorded written decision. **NO-GO is a success mode** when it comes
  with a minimal fix list; a GO produced by rewriting a criterion is invalid.

## 3. The evidence packet the Owner should receive

1. This plan plus the audit reports that fed it (A/B/C/D), read-only.
2. `cand-v0.1.6-3` manifest and verification transcript; tarball sha256; host and Authority pins.
3. A1–A4 evidence directories with the pre-fix control where one exists, and the two-run agreement
   table.
4. C2-A and C2-B signed verdicts on that SHA/tarball/host.
5. The release notes' appended disclosures (§1, §4.13–§4.15, §10) and the debt register's
   PD-40/41/42/43 rows — including every place the honest text contradicts a shipped claim.
6. The explicit list of what is **still not claimed**: the conjunction (A1 open — `J04` proves the pinned
   definition and a real execution, not ceiling enforcement), Leader/Root realm coverage, OS network
   isolation, Host-UI machine-readable codes, a fully-capable single Member, and a decision on the
   review-facts lifecycle gate (PD-43).

## 4. NO-GO fallback

If any of A1–A4 fails and the Owner does not waive it:

- Do **not** freeze `cand-v0.1.6-3`; do **not** start C2.
- Write a NO-GO packet: the failing criterion, the exact measured shape, the minimal fix, and the
  smallest honest release statement that would be true without the fix.
- Keep `cand-v0.1.6-2` as the last frozen candidate; keep the Authority pointer unmoved.
- If the Owner chooses to ship a narrower Preview, the narrowing is an **Owner-written** criterion
  change with a dated record — not a developer edit.

## 5. What this plan is not

- It is not the `v0.1.6 Joint Preview Release Gate` and does not bring that proposal into force.
- It does not approve, freeze, tag, merge or publish anything.
- It does not revise D12, the Preview Contract, the matrix or any acceptance criterion.
- It does not implement the two next-phase work packages; see `WP-AGENT-EXECUTION-REALM.md` and
  `WP-F2-GOAL-DOMAIN-AUTHORITY.md` (design only).
