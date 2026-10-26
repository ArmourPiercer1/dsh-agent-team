# U6 PR6 — G4-CORE evidence package

Branch `task/u6-pr6-arc-d-g4-20261026`; base `origin/master` (re-merged before
push); Host pin `0.2.0-rc.2 @ 639ed0153972…` (pristine `tests/deepseek-harness-test-use`,
porcelain-verified; single source `tests/paths.mjs`). CORE PATCH BUDGET this
round: **0** — no center file edited (ARC-A L1 digest scan re-run over this
tree: 0 violations, 33 tracked protected files; machine copy
`dev/agent-workflow/evidence/u6-pr6-20261026/legacy-path-removal-machine.json`).

Verdict law (unchanged since PR2): every claim below is carried by
code + a named test + a receipt (disk/ledger/host-log). A verdict is never
transcript-only; C1-green and tooling-LIVE are not release-green (CI-12).

## 1. CI-01…CI-12 × code × tests × receipts

| CI | Status | Code (production face) | Tests (this tree) | Receipts |
| --- | --- | --- | --- | --- |
| CI-01 core-patch-0, public seams only | 通过 | zero diff to the pinned HTU; the guard rides only `installScopedToolGuard`/ctx.tools/placement rows | a5p0-layer-audit ✓; this PR touches no center/host file | branch diff vs origin/master (PR files list); L1 scan (machine JSON) |
| CI-02 no new writable authority | 通过 | kernel table is the ONLY approval store; `familyFace()` = frozen {} | AD1, AD4 (second-ledger twin caught), matrix `c_*` | `u6-pr6-20261026/` (this dir) + PR4 `jobs:no-second-ledger` C2 |
| CI-03 Team/non-Team isolation + native parity | 通过 (seams) + LIVE leg | closed-world guard (identity absent/foreign before anything else); unmanaged names pass through | matrix `n_native_*` (3 legs on the armed lane), AD11 (foreign/agentless refused; blinded twins run), `arcd:ci03-native-parity` | C2 dir (this PR) + u6-proc `proc:ctl-native-untouched`, u6-jobs `jobs:ctl-native-untouched` |
| CI-04 identity = real Definition/Binding | 通过 | `definitionIdentityOf` + binding feed + drift demotion (install.ts) | AD3, AD6, `eq4`, `e_races`, `c_preguard_veto` | this dir; u6-pr5 kernel-flow |
| CI-05 refuse BEFORE body, never fall back native | 通过 | door/arm ordering in install.ts; CI-05 gateway row (PR4) | `b_regen_at_rest`, `c_preguard_veto`, AD6 (+blinded twins), p6 Gate-0b legs | this dir; PR2/PR4 receipts |
| CI-06 center is the sole grant authority | 通过 | consumeOnce sync reservation, GRANT_IN_FLIGHT/GRANT_REPLAY, outcome-independent burn | AD2 (exclusivity + replay + burn), matrix `arcd:replay-refused` (live) | this dir + C2 dir |
| CI-07 all effects in one decision; no self-reported effectSet | **carried** | assurance face (tool-admission) | golden/assurance legs unchanged | **R-U6P5-1 / GLUE-4**: governed member-lane search not end-to-end admissible at the assurance face (IO_POLICY_UNSUPPORTED measured PR5); family `effectSet` stays declarative; no unrestricted grant follows a self-report anywhere in the seams above |
| CI-08 single ordered lifecycle | 通过 | state machine PREPARING→ACTIVE→DRAINING→TOMBSTONED→RELEASED; disposeOrdered + mask law | AD9a (clean: lift exactly once at RELEASED, dispose-noop), AD9b (in-flight: EXECUTION_TERMINATION_UNCONFIRMED, mask NEVER lifts), AD10 (revoke→re-register revive), `arcd:teardown-honest` (live) | this dir + C2 dir |
| CI-09 settlement audit, no post-effect retry, honest uncertainty | 通过 | settle classification ABORTED→TERMINATED-after-body-start with `sideEffectPossible:true` + “NOT reported as un-executed”; late-settle-after-teardown row + lease stays open | AD7, AD8a/b, AD9b, `eq1/eq2/eq3`, `wire_secondary` | this dir |
| CI-10 Domain veto independence | unchanged, gated earlier | control/** untouched this round (zero diff) | — | prior gate records (GATE-LEDGER Alpha.4 lineage; PR3 ask-row receipts) |
| CI-11 dynamic discovery ≠ approval/run | 通过 | registry `dynamic-source` → state `not_verified`; kernel refuses NOT_VERIFIED_SOURCE even with an entry | AD10 (refuse-with-entry + reviewed re-register revives), matrix `protocol` | this dir; f15 lineage |
| CI-12 release pinning; C1/LIVE ≠ release | 通过 (as disclosure) | world-factory run-record digests; this doc | — | C2 run record(s) in `c2/`; PR CI |

## 2. sup-a §5 ten conditions (conditions.md)

| # | Condition | Where re-scored |
| --- | --- | --- |
| 1 | Center-owned approval table | AD1/AD3; matrix `c_preguard_veto`, `c_restore_control` (veto reverses ONLY under an owner act) |
| 2 | Composition-order control (guard first) | AD6 (door catches before any Body even when a later stage would swap); `e_races` three-stage |
| 3 | Governed-name visibility + PoC-5 generalization | bindingFeed/kernelGuard drift (AD3, `eq4`); reserved-name Gate 0b (`p6_*` 4 legs on the SHIPPED `verifyPlaneNames`) |
| 4 | Result-path schema parity (P8) | `eq5`, `eq6a`, `eq6b`, `eq7`, `wire_secondary` |
| 5 | In-Body grant is defense-only | AD2 (burn independent of outcome; replay refused) |
| 6 | No transactional registration-time veto (sync) | `b2_regen_inflight` (abort + sideEffectPossible, never rollback wording); `c1_foreign_midbody` two-arm oracle |
| 7 | Cancellation semantics are the Host's | `eq1/eq2/eq3` (never self-dispatched; classes kept native), `dispatcher-call-cancelled-by-others` attribution |
| 8 | Scheduler classification advisory at dispatch (eq9) | **carried named** R-G3-1 lineage — the live exec-mode flip race stays with the crash-reclaim lane; the fail-closed ORDERING (STATE FIRST) is re-scored (AD10 refuses NOT_VERIFIED_SOURCE ahead of an approval entry) |
| 9 | Nested dispatch shares the governed funnel | `eq10_nested_approved`, `eq11_nested_veto` (agentless never laundered) |
| 10 | Agent-control-plane names governable in the same seam | `p6_*` (Gate 0b per-name across bash/glob/read rows + purity/zero-claim), `p6_plant_native_when_guard_off` (guard-off twin), AD11 |

## 3. sup-a 42-cell oracle matrix (U6 gate ledger)

Ledger file: `packages/runtime/test/u6-pr6-arc-d-matrix.test.ts` (this tree).
It re-scores, per cell, HOW (oracle = bodies-ran / settle-class / event-rows —
never tool return text) and WHERE (disposition). Current verdicts, from the
green run of this file:

* **37 cells offline re-scored HERE and PASSING** on production seams (real
  kernel + real registry + real installScopedToolGuard + the pinned
  scoped-registry double), including every refusal cell's blinded-twin
  sensitivity pair (§10.5-6).
* **3 cells live** on the `u6-arc-d` world-factory suite (C2):
  `global_bp_exactly_bound → arcd:replay-refused`,
  `global_bdiv_never_ran → arcd:marker-ledger`,
  `global_guard_vetoes_seen → arcd:marker-ledger`. Verdicts come from the run
  record + probe ledger + marker dir (disk), never the transcript.
* **3 cells carried named**: `d_restrict_veto`/`d_lift_control` = **R-U6P6-1**
  (live builtinToolDeny pair; the offline double ships no restriction API —
  re-scoring offline would measure the double; the kernel veto algebra is
  re-scored by `c_preguard_veto`/`c_restore_control`/`e_races`); `eq9` =
  **R-G3-1 lineage** (named above, condition 8).
* sup-a's original g1fa receipt lives on sup-a's machine, not this tree — the
  U6 ledger is therefore SELF-CONTAINED: it re-runs the oracles rather than
  cite them. `fixture_heal` (sup-a's 43rd row) runs first here too.

<!-- LIVE-RECEIPTS -->
### 3.1 LIVE leg receipts (C2, booted 2026-10-26)

`node tests/world-factory/u5-canary-runner.mjs --suite u6-arc-d --line arc-d1` —
ONE Host boot (`--max-host-starts 2`, budget ledger shows exactly one
`u6arcd-boot1` entry; zero retries), hostSha `639ed01539` porcelain-empty,
teamSha `acb50dcc41`, leased port 3182, stable :3080 probed
unchanged (`stable-instance-unchanged` row present).
Run `u5-u6-arc-d-arc-d1-2026-10-26T08-30-55-354Z`: **all nine
`arcd:*` cases PASS** (`overall=PASS`). Verdict inputs are DISK+LEDGER only:
the mounted probe row's own ledger rows — `pos-1 walk ok:true`;
`spoof-1 NO_APPROVAL_ENTRY`; `swap-1 IDENTITY_MISMATCH`;
`unbound-1 NO_APPROVAL_ENTRY outcome:defer`; `replay-1 GRANT_REPLAY`;
`teardown ok:true` then `post-1 KERNEL_NOT_ACTIVE` — plus the marker dir
(EXACTLY one file `pos-1-marker.txt`, nonce matches) and the wire claim scan
(`nativeClaimFound:true` with the probe AND grep deny-listed at the governed
team — CI-03). Receipts:
`dev/agent-workflow/evidence/u6-pr6-20261026/c2/`
(run-record + evidence JSON + budget ledger + host log). The three matrix
live cells therefore land: `global_bp_exactly_bound` ← `arcd:replay-refused`
PASS; `global_bdiv_never_ran` + `global_guard_vetoes_seen` ←
`arcd:marker-ledger` PASS (one marker / nine ledger rows / three named
refusal codes).


## 4. Scope (B) — legacy center-path removal

Single home per kernel-owned name; no dual ledger. Full ledger + machine
proof: `dev/agent-workflow/evidence/u6-pr6-20261026/legacy-path-removal.md`
(+ `-machine.json`). Summary: `plane-effect-backends.mjs` + `.d.mts` + dist
mirror DELETED once every consuming family was registered (census) and its
C1/C2 suites green; the two law-flips (u6-pr4 A2, u6-pr5 M3) now PIN THE
ABSENCE (trackedPresent + non-vacuity); p4t6 books the first REMOVAL ROUND
(`SCANNED_PATHS_U6PR6` vs `RETIRED_PATHS_U6PR6`, net-neutral measured,
absence-pinned). ARC-A L1–L4 stay 0-violations over the changed tree.

## 5. Named items and disclosures (nothing carried silently)

* **R-U6P3-1** (PR3, carried): governed-bash positive effect not live-proven
  (ask-row birth/blocking measured; resolve→spawn leg → U7). Unchanged by this PR.
* **R-U6P4-1 / R-U6P4-2 / R-U6P4-3** (PR4, carried): creation-lane attribution
  producer absent at this pin; u6-jobs Team-lane stall since boot 5; jobs
  effect legs never measured positive live. ⇒ the PR4 §10.6 ruling stands:
  **BRIDGE-BLOCKED**.
* **R-U6P5-1 / GLUE-4** (PR5, carried): governed member-lane search is not
  end-to-end admissible at the assurance face (IO_POLICY_UNSUPPORTED); the
  way forward is the approval/assurance round, not fixture work.
* **R-U6P6-1** (NEW, this PR): live deny restrict/lift pair not re-run
  (matrix carried cells, definition above).
* **R-U6P2-1** (environment): the offline pnpm store mirror lacks the
  `@deepseek-ai/dsh@0.2.0-rc.2` tarball in this worktree; this round installed
  via a hardlinked workspace store mirror (`.artifacts/tmp/u6pr6-store/v11`,
  outside git) — same workaround the PR2 review recorded.
* **Worktree install gap**: the `a5p4-lane-hygiene` self-typecheck leg fails
  here ONLY for a missing `node_modules/@types` link (reproduced with a
  trivial file under identical compilerOptions); CI installs normally. Not a
  product red.
* **PLANE_RESERVED_NATIVE nuance (§10.5-4)**: the ~64-name pin list in
  team-tool-plane.mjs is NOT re-pinned by this PR; its drift law is held by
  the shipped referee `a5-pindir-reserved-native.test.ts` (bidirectional
  harvest-artifact compare + pin-source check) — a per-round manual re-pin is
  deliberately not duplicated here.
* **kernelGuard-null defensive face kept**: team-tool-plane's
  `identityFor: () => null` fallback when no kernelGuard is wired is a LIVE
  honest defensive face (the table answers null ⇒ refuse); deleting it would
  REMOVE a refusal path, so scope (B) left it — the census records why.
* **"B1/B4-B8/E1/E2" labels**: exist only in U6-SLICE-PLAN prose; E1/E2 have
  no code referent. No code was written against those labels.
* Boot budget: this PR runs ≤6 Host starts via the factory ONLY (lease v5,
  ports 3180–3186/3491–3500; :3080/~/.dsh untouched). Boots used: ≤
  recorded-in-c2. Extra-boot law (one new harness cause + one-line fix,
  disclosed) not invoked.

## 6. §10.6 verdict recommendation

Full G4 requires the Jobs-bridge ARC-C effect legs GREEN live (R-U6P4-1..3)
plus ARC-A/B/D green. ARC-A holds (PR5, 投机通过), ARC-B holds with the
positive-effect leg named-carried (PR3), ARC-D now closes its adversarial
matrix (this doc §3) with three named carried cells and a live C2 leg set.
The seams that remain unproven are the ones the gate ledger already rules
**BRIDGE-BLOCKED / assurance-gap** (jobs attribution producer R-U6P4-1,
bash-positive R-U6P3-1, search assurance R-U6P5-1/GLUE-4) — none of them is
weakened by this round, and none was worked around privately (CI-01).

**Recommendation: G4-CORE-PASS with BRIDGE-BLOCKED standing** (the PR4 §10.6
ruling, unchanged and now covering ARC-D), NOT full G4. Full G4 unblocks only
with the named bridge/assurance items closed in U7 — the recommendation states
exactly the facts that carry it and nothing speculative.
