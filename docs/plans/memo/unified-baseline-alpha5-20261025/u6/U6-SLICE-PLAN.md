> **Status banner (2026-10-26, FIX-D adoption).** This is the **reviewed U6 construction slicing** for the
> center-assembly work of [PR #364's execution plan](../execution-plan.md) — it was reviewed during U6 prep
> (evidence `dev/agent-workflow/evidence/u6-prep-20261025/`, 2026-10-25) and is versioned here so the lane it
> describes is buildable from the repository alone. The text below it is verbatim; adoption adds exactly one
> amendments section at the end (**A-1: K1–K5 enforcement-flip gate**, external-audit remediation 2026-10-26).
> Normative design source for the target architecture: [center-assembly-architecture.md](./center-assembly-architecture.md);
> center conditions: [conditions.md](./conditions.md); gate history: [../gates/GATE-LEDGER.md](../gates/GATE-LEDGER.md).

# U6-SLICE-PLAN — minimal slicing for the center assembly rewrite (≤6 PRs)

Entry gates (execution-plan §1.2): **U6 requires G1-F PASS + G2 PASS + G3 PASS**; worktree from master @
f7fbc0f67 lineage after U5 merge (#368). Every PR: 1 task = 1 branch = 1 worktree = 1 writer; PR-level
review→fix→re-review loop (≤3 rounds); CORE PATCH BUDGET 0 (public seams only, host pin `tests/paths.mjs`).

Design stance (from CENTER-MAP + EXISTING-GOVERNANCE + U4 sup-a/sup-b PoCs):
- **Reuse, don't rewrite:** `tool-dispatch` (closed-world guard + scoped dispatcher + install seam order),
  `pa-mount-registry` (CI-08 mount law), `tool-admission` (PA kernel + grant ledger), `operation-permission`
  (Control bridge + static algebra), `control/service.ts` (durable authority, CI-02 untouched).
  The Kernel is a **composition** of these over injected ports — the 10-condition table in sup-a §5 and the
  one-ledger ledger/registry/bridge shapes in sup-b are the PoC-proven reference implementations.
- **next()-guard hooks where master already hooks** (`tools.guard` body + `tools/pre-execute` door +
  `tools/execute` gate + `tools/change` watcher + `tools/result` edge, `tool-dispatch/install.ts`): the change
  is that the verdict comes from ONE Kernel-owned approval table (condition 1) instead of three surfaces.
- **No dual ledger at ANY slice:** migration = replacement; a family's old center path is deleted in the same
  PR that turns its contribution on (shadow-mode is allowed only pre-enforcement, PR1, and never emits authority).

---

## PR1 — Kernel/Registry/HostSurfaceAdapter skeleton + closed-world contribution schema — INERT (shadow)

**Files:** new lane `packages/runtime/governance-center/` (`kernel.ts`, `registry.ts`, `host-adapter.ts`,
`contribution-schema.ts`, `index.ts` — TS, no center imports; consumes `domain/tool-governance`,
`contracts`, and injected ports over `tool-dispatch`/`tool-admission`/`operation-permission`);
`src/plugin/live/agent-bindings.mjs` — one shadow-mount block (~40 lines, config-gated
`teamToolPlane.centerAssembly: 'off'|'shadow'`, default `'off'`); new `live/center-shadow-row.mjs` if a .mjs
row is needed (→ add to `scripts/place-dist-glue.mjs` PLACEMENTS + dist mirror). No changes under
`control/`, `tool-admission/`, `tool-dispatch/`, `pa-mount-registry.mjs`.
**Content:** contribution descriptor = §4 six boundaries as a **closed schema** (source/visibility,
definition/args, effects+constraints, execution, settlement, result; lifecycle+cancel; obligations);
registration = sup-b `g1fb-registry.mjs` law (closed schema + collision + generation checks; non-authorizing);
Kernel = §5 state machine (PREPARING→ACTIVE→DRAINING→TOMBSTONED→RELEASED/FAILED) driven by the existing
dispatcher lifecycle ports; one-shot grant consume via `consumeForExecution` port; shadow `decide()` mirrors
the future kernel verdict into an audit ledger only — `next()` always taken, zero effect on today's flow.
**Tests (C1):** schema negative matrix (unknown field; family self-approving; effects without execution
declaration; provider-backed family lacking a named Bridge; lifecycle without owner; capability not backed by
a declared real execution path — each RED-first, each with a planted-counterexample sensitivity leg);
state-machine unit; collision/generation units. **C2 (world-factory):** shadow-parity run —
`u5-canary-runner.mjs --suite core` with shadow ON: every case green AND the native result ledger
byte-identical to shadow OFF (condition 10 proved); oracle sees the same external effects.
**p4t6:** book `SCANNED_PATHS_U6PR1` (new lane src + tests), re-anchor totals by measurement.
**Conditions:** 1 (center-owned table exists, inert), 3, 7, 10. **Risk:** schema too loose/too early —
mitigate by deriving every field from sup-a/sup-b law + §4 text and keeping it additive-only until PR5's real
family adds nothing (if it must change, that is a signal, not a failure). **Revert:** delete config key + lane.

## PR2 — FS/read family onto the Kernel (ARC-B part 1)

**Files:** NEW family lane `packages/tools/fs-family/` (read row: move `plane-effect-backends.mjs:96–179,
1074–1578` + `team-tool-plane.mjs:144–283` presentation + read-row def `:1723–1783, 1829, 1870–1884` into a
contribution over the PR1 schema; arms follow PR#360 `write.mjs/todo.mjs` law; `controlled-fs` post-consume
closures referenced, not copied); `agent-bindings.mjs` — FS family registered via Registry, old read-row
injection removed; `team-tool-plane.mjs` — read rows now come from the contribution (B2/B13/B14 sites deleted);
`plane-effect-backends.mjs` — read section deleted (+ dist mirror byte-refresh); `canonical-operation.ts`
`case 'read'` projection moved to the family's pure-normalizer slot with the kernel computing the fingerprint
from the returned projection (golden-vector identity law — see risks).
**Tests (C1):** moved read suites ride along (alpha5-read-slice, a5b3 cancel parity, a5m2-fs-bounded-read
when extracted); new: family-canonicalizer golden vectors = byte-identical fingerprints vs master's
`canonicalizeOperation('read', …)` over a pinned arg corpus (grant/permission identity must survive);
kernel-flow integration (admit→ask→consume→execute→settle with stub ports, one-shot replay refusal,
fail-before-body on stale generation). **C2 (world-factory):** new `u6-fs` suite — real read with effect
proven by Oracle (marker file mtime/read-side channel), ask-lane via mock provider decision, refusal = zero
effect, identity-swap plant on `read` (register a spoof before dispatch → refused, no body — condition 6/8),
TOCTOU window plant (swap in guard→resolve microtask → `ABORTED_BEFORE_DISPATCH`, zero effect).
**p4t6:** book fs-family lane + tests; plane/backends edits are already-counted files.
**Conditions:** 2, 4, 5, 6, 9 (static half), 8. **Risk:** fingerprint divergence invalidates stored durable
grants/rules (fingerprint IS authority identity) → golden-vector gate before cutover; if any mismatch, the
PR does not ship. **Revert:** `git revert` restores plane rows + config flip; durable rows untouched.

## PR3 — bash/process family (ARC-B part 2)

**Files:** extend `packages/tools/fs-family/` (or `packages/tools/shell-family/`) with the confined-shell
contribution (move `plane-effect-backends.mjs:678–1073` + shell `decide` class tables `team-tool-plane.mjs:582–601`
into contribution visibility/effects); `operation-permission/canonical-operation.ts`: shell projection →
family normalizer + kernel-side fingerprint (golden vectors for `bash`/`pwsh` incl. workdir/run_in_background/
timeout/sandbox edge cases); delete C3/B7–B10; takeover ledger for `bash` becomes contribution Source&Visibility
data (the ~60-name `PLANE_RESERVED_NATIVE` remains until PR6 — it is a census, not yet a kernel branch).
**Tests (C1):** shell projection golden vectors; exec-class dual-gate token law preserved (domain tokens
unchanged — CI-02); a5b2 exit-code-fidelity + cancel-leg parity suites re-run against the contribution path;
**C2:** `u6-shell` suite — real external effect (disk write via bash), refusal zero-process (ps/side-effect
oracle), timeout + cancel semantics (`raceShellSettle` parity), stream drain, swap guard on `bash`,
kill/drain in-flight law (DRAINING entered-bodies-not-rewound). **ARC-B proof:** read and bash share the SAME
Kernel state trace (same events, same grant ledger rows, different executors) — asserted structurally in the
ledger, not by booleans.
**Conditions:** 5, 6, 8 (+ARC-B same-decision/settlement proof). **Risk:** confined-provider pairing law
(trustRoot) mishandled as "family self-attestation" → the provider stays a named, reviewed provider behind
the Bridge-style declaration (CI-07), byte-gate remains second gate only.

## PR4 — Jobs bridge (ARC-C)

**Files:** NEW `live/jobs-family-bridge.mjs` (or `packages/runtime/center/bridges/jobs.ts`) —
`createGovernedJobsBridge` (`plane-effect-backends.mjs:1579–1850`) moved VERBATIM (sup-b: byte-identical
reuse is the proof), trio row defs (`team-tool-plane.mjs:1684–1722`) + name list C6 become the bridge's
contribution; `jobs-gateway-assembly.mjs` untouched (gateway row stays); PLACEMENTS update for any new .mjs;
delete old trio injection from the plane. `pa-mount-registry` imported unmodified (PoC-3 mount-law proof).
**Tests (C1):** bridge adapter units + owner-fence; **C2:** `u6-jobs` suite — real background job with
server-side marker (effect independent of tool return), kill → owner fence → measured host-non-reach,
in-flight cancel semantics, mount-generation plant (old disposer cannot drop new mount; counterfactual shows
the break), CI-08 honesty wording checks. **Conditions:** 8/9/10 in bridge context; **CA-03 first named-bridge
pass** (per §10.6, one real bridge success is required for full G4 — Jobs is READY-PUBLIC per sup-b PoC-3).
**Risk:** double-wrap drift (PR#360 `job-adapters/wiring` is an arm/bridge split of the same surface — do NOT
merge both shapes; take one). If a JobRegistry seam gap appears → G4-CORE-PASS/BRIDGE-BLOCKED semantics
(§10.6), never a private- seam workaround (CI-01).

## PR5 — ARC-A: a NEW test family + one real family, ZERO center diff + fitness gate

**Files:** test-only family `u6-probe` (mounts, declares, plans, refuses, executes a marker write, settles —
C2/worlds only, never production profiles) contributed **without touching any product center file**;
real family moved: **search (grep/glob)** — native-rg output contract = the "real native behavior contract"
required by §10.5-5 (move `plane-effect-backends.mjs:180–677` + `search-backend.mjs`/`glob-backend.mjs`/
`cancel-leg.mjs` into the FS/search family lane; delete C1/C2/D? sites from center). Fitness tests (C1,
new `packages/runtime/test/u6-arc-a-fitness.test.ts` + `testkit/fault-injection/` scan helper):
① protected-file set digest-locked (`tool-dispatch/**`, `operation-permission/**`, `tool-admission/**`,
`control/**`, `pa-mount-registry.mjs`, kernel/adapter/registry files) — product diff in these files FAILS the
family-addition leg unless the PR is the named center-interface PR (§9.1/§9.3);
② **no-tool-name-branch law**: name-literal scan (CENSUS vocabulary from §8 CENTER-MAP) over kernel/adapter/
registry files must be empty, with a planted-counterexample sensitivity leg (§10.5-6);
③ family-count census ledger (tracked file; restated in the open);
④ contribution closedness: no registration from unreviewed source (dynamic names land in the obligations set,
H0-e law preserved); ⑤ ARC-A live leg: register/run/unload probe family on the fixed Host (C2) + real family
live dispatch.
**Tests (C2):** probe family full §5.1 walk (positive real effect; all negative refusals with zero effect).
**Conditions:** 1 end-to-end (new family = zero center diff), plus re-proves 2–10 for the new family.
**Risk:** hidden center knowledge (e.g. render contract, `lexicalAnchor`) forces a center touch — that is the
ARC-A signal; budget for one shared-family-lib extraction (new lane, not a center edit).

## PR6 — ARC-D adversarial suite + removal of old center paths (no dual ledger) + G4-CORE package

**Files:** delete: `agent-bindings.mjs` plane-assembly block remnants + static per-tool install wiring for
migrated families (the pre-execute adapter remains for NOT-yet-migrated native permission tools until G5 —
documented residual, single-ledger unaffected), `team-tool-plane.mjs` name law tables B1/B4–B8 → derived
census (pin-verified: regenerate against `PLANE_RESERVED_NATIVE` evidence; no hand-maintained center tool
list as authority, §10.5-4), coverage tables E1/E2 → Registry visibility + census obligations.
**ARC-D suite (C1+C2, planted counterexamples for every law, §10.5-6):** fake mount (unregistered family),
identity spoof (family self-reported name/args trusted attempt), family attempting grant mint/consume,
re-approval of a refused call (condition 3), second-ledger detector, direct center-edit fitness (must fail),
TOCTOU swap plants (pre-body/armed/result) per H0 a–f + sup-a eq1–eq4, dynamic MCP add/remove/drift refusal
(H0-e), non-governed session native parity (condition 4 / CI-03), post-body swap = TERMINATED honesty (never
"cancelled"), replayed grant refusal, drain/teardown orders (NEG-1 mask law). Re-run sup-a's **42-cell oracle
matrix** as the U6 gate ledger (same oracle, independent of tool returns).
**Exit package:** G4-CORE-PASS evidence (ARC-A/B/D green, Jobs bridge ARC-C green → full G4 per §10.6 unless
a seam gap appears), protected set + family census frozen, ledger restatements.
**Conditions:** all 10 adversarially; **Risk:** over-deletion (a not-yet-migrated family's only path deleted) —
mitigate with the family census ledger: a name may lose its old path only when its contribution is registered
and its C1+C2 legs are green.

---

## Cross-cutting constraints (every PR)

- **dist mirror co-commit:** any change to a mirrored src `.mjs` must ship with its byte-identical
  `packages/runtime/dist/...` copy (`node scripts/place-dist-glue.mjs`); new center `.mjs` → add to PLACEMENTS
  (`scripts/place-dist-glue.mjs:48–151`, single home; enforced by `scripts/check-artifacts-committed.mjs`
  check D + `check-artifacts-at-head.mjs` via `scripts/ci-pr-gate.mjs` DSH-ARTIFACT-VERDICT). Precedent of
  forgetting: a5g6 `Cannot find module './glob-backend.mjs'` — the law is the TRANSITIVE import graph.
- **p4t6 file-count pin:** `packages/testkit/test/p4t6-session-event-scan.test.ts` counts scannable
  `packages/**` files (base 983 + per-round booking arrays summed in
  `expect(scanResult.filesScanned).toBe(...)` at :2819 and `scanResult.files.length` at :2885; also
  `packageDirs` nine-root equality at :312). **Current measured total on master = 1228** (measured via
  `packages/testkit/fault-injection/session-event-scan.mjs`). Update procedure per the file's own booking
  discipline: add a `SCANNED_PATHS_U6PRn` array with a header recording the measured unbooked RED
  ("expected 1228+N to be 1228"), append `.length` to BOTH totals, never copy totals from another branch.
  New lanes (governance-center, fs-family, tests) are exactly the events this ledger exists for (GLUE-2
  precedent in the file header).
- **lint identity baseline:** the rule is "no NEW diagnostic identity", not "lint clean":
  `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/<baseline>` —
  identity = (severity, ruleId, file), set diff, counts never (scripts/lint-identities.mjs header).
- **test-fail baseline:** `scripts/fail-set.mjs` capture/diff likewise for vitest identities.
- **census nine-root tolerated set:** the gate baseline is
  `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2b1099d7.md` (pointer:
  `scripts/ci-pr-gate.mjs` `BASELINES.census` :106): **9 titled reds**, machine copy
  `nine-root-2b1099d7.ids.txt`, family disclosures {p6t1-parallel, packages/tools/test/p6t6-actions.test.ts};
  LOAD discipline — compare IDENTITY SETS never totals (19–21 seen under load). Deleting/renaming a baselined
  red's file requires a restatement file (measured, same format, gate pointer moved) — the gate never writes
  its own baseline.
- **test tiers:** C1 = packages/*/test vitest (CI-safe, offline); C2 = `tests/world-factory`
  (`u5-canary-runner.mjs`, budget-leased host starts, ports 3180–3186/3491–3500, never :3080, HTU
  porcelain-checked; U6 suites register as new `--suite` entries). No PR boots hosts outside the factory.
- **authority/semantics freeze:** no graph.yaml/authority moves inside U6 PRs; §9.3 file ownership — Family
  owners never touch the protected set; a center-interface change needs its own reviewed PR.

## Condition × PR coverage matrix

| sup-a §5 condition | PR1 | PR2 | PR3 | PR4 | PR5 | PR6 |
|---|---|---|---|---|---|---|
| 1 center-owned approval table | ●(inert) | ○ | ○ | ○ | ●live | ●reproved |
| 2 verify binding at execution time | | ● | ● | ● | ● | ● |
| 3 approval delegates via `next()` | ● | ○ | ○ | ○ | ● | ● |
| 4 refusal without `next()` / no effect | | ● | ● | ○ | ● | ● (+CI-03 parity) |
| 5 no unverified body dispatched | | ● | ● | ● | ● | ● |
| 6 identity mismatch never executes | | ● | ● | ● | ● | ● |
| 7 identity never trusted from caller; family pure | ● | ● | ● | ○ | ● | ● |
| 8 TOCTOU swap → no effect / post-body = recorded | | ● | ● | ● | ○ | ● |
| 9 dynamic registration refused until bound | (schema) | ●static | ○ | ○ | ●live | ●(MCP drift) |
| 10 identity check preserves success shape | ●shadow | ● | ● | ● | ○ | ● |

● = implemented/proven in that PR; ○ = preserved/regressed-with.

---

## Amendments (2026-10-26, FIX-D — appended at versioning; the text above is verbatim from the reviewed slice plan)

**A-1 (enforcement-flip gate).** External-audit remediation added a hard precondition the reviewed plan
predates: the Kernel stays INERT / SHADOW (`teamToolPlane.centerAssembly: 'off' | 'shadow'`, never
`'enforce'`) until the five kernel safety fixes **K1–K5** land and pass independent review (FIX-K lane,
branch `task/u6-fixk-kernel-safety-20261026`):

- **K1 — revoke-bound approvals:** an approval-table entry must be bound to the revocation lifecycle of the
  family/grant it was registered for; revoking or re-registering a family invalidates outstanding
  approvals instead of leaving them consumable.
- **K2 — in-flight consume reservation:** consuming a one-shot grant reserves it atomically before the
  body runs, so two racing dispatches can never both pass the consume check on the same grant.
- **K3 — required lifecycle port in enforcing mode:** the lifecycle/dispatch port is optional only while
  shadowing; an enforcing kernel assembled without the port must fail closed at assembly time, never
  silently degrade.
- **K4 — (scope, name, source)-keyed approvals:** the approval table keys on the full triple; an approval
  minted for one (scope, name, source) may not satisfy a lookup for another (condition-3 bind/unbind law,
  exact-key only).
- **K5 — bounded shadow ledger:** the shadow audit ledger carries a hard bound (size/retention) so the
  pre-enforcement mirror can never grow unbounded or become a de-facto second ledger (no-dual-ledger law
  of this plan).

A-1 changes no slicing, ordering, budget, or exit package above; it only makes the flip to enforcement
conditional. Why: see [../gates/GATE-LEDGER.md](../gates/GATE-LEDGER.md) — timeline correction + remediation.
