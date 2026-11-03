# a5sf-r2 — engineering-baseline inheritance (BL-10 / R2)

Dated **2026-11-02T20:27Z** (real UTC, `date -u` at authoring time).
Package: **BL-10** of `docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md`
(P2 BL-14…BL-20 are the consumers). Branch `task/a5sf-r2-baseline-20261102`, worktree
`.worktrees/a5sf-r2-baseline`, base `origin/master` = `0a5b58418` (PR #537, the authority-carrier
PR; this branch's merge-base is `17ce70430`, PR #531 — the branch was **not** rebased, per the
coordinator).

**Verdict of this package: the harness is wired and C1-proven; no real Host boot was performed
here, and none is claimed.** P2 suites own the C2 boots (see §7 for the exact command the
coordinator may run under a boot budget).

---

## 1. What was inherited vs adapted

The reclamation rule (`dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md`
§0/§1, R2-b) is **inherit the mechanism, adapt the interface**. Every row below either calls the
owner directly or wraps it in one normalising call; nothing is re-implemented.

| concern | inherited machinery (file:line at this base) | class | adaptation in `tests/world-factory/lib/a5sf-harness.mjs` |
|---|---|---|---|
| World creation | `tests/world-factory/lib/world-factory.mjs:224` `TestWorldFactory`, `:331` `createWorld` | **A — as-is** | `harness.createWorld()` is a pass-through. No second launcher, no second home/ownership/lease path. |
| Host boot | `tests/world-factory/lib/world-factory.mjs:570` `TestWorld.startHost` (the one `DshInstance` chain) | **A — as-is** | `harness.boot()` calls it LAST, after the budget step below. The harness never spawns anything itself. |
| Host-start budget ledger | `tests/world-factory/lib/run-record.mjs:95` `createRunRecord`, `:109` `logHostStart`, `:124` `ledgerStartCount`; ONE gate `run-record.mjs:39` `DEFAULT_MAX_HOST_STARTS` + `:40` `hostStartBudgetPosition` | **A — as-is** | `createA5sfHarness()` refuses without that record **and** a non-empty `record.hostStarts.ledgerPath` (`BUDGET_LEASE_REQUIRED`); `boot()` re-checks the path, asks the **imported** gate for the position (`BUDGET_EXHAUSTED`), appends its own start to the SAME ledger, then boots. `harness.budget()` is the gate's position. **No second ledger file and no second formula.** |
| Fixed candidate (host pin) | `tests/paths.mjs:71` `TEST_USE_BASELINE_SHA`; read-only guard `world-factory.mjs:297` `assertHostBase` | **A — as-is** | `harness.candidate()` returns the imported pin (`source: tests/paths.mjs#…`); `harness.assertCandidate()` delegates to `assertHostBase`. The C1 test asserts the 40-hex literal is **absent** from the harness source. |
| Member ceiling compiler | `packages/runtime/member-io-policy/src/compile.ts:100` `compileMemberPolicy` (P1-02) | **A — as-is** | `harness.compileCeiling()` parses the v4 doc via the shipped `parseBlueprintV4` and calls the compiler. It requires the **Alpha.4 effective authority** as input (`AUTHORITY_REQUIRED`) — it never synthesises admission state. |
| Tool restriction + per-call intersection | `member-io-policy/src/compile.ts` `projectToolIoRestriction` / `compileEffectiveIo` | **A — as-is** | `harness.compileInvocation()` delegates both; no local algebra. |
| Realtime admission guard | `packages/runtime/team-services/src/fs.ts:82` `createMemberFsGuard` (P1-05) | **A — as-is** | `harness.installGuard(policy)` returns the SAME `MemberPolicy` object plus the shipped guard. C1 executes the allow/deny arms **through that guard** and asserts the P1 `TeamIoDenial` codes. |
| Realm install | `packages/runtime/team-services/src/install.ts:260` `installToolBindingRealm` (P1-05) | **A — as-is** (deep import, see §4) | `harness.installBindingRealm()` forwards `{root, spec, providerClass}` unchanged. |
| Effect oracle | `tests/world-factory/lib/oracle.mjs:47` `createOracle`, `:139` `oraclePaths` | **A — as-is** | `harness.oracleFor()` builds it; `harness.judgeEffect()` is `observe()` + `effect()` in one call. No second verdict algebra; the deliberately-broken `ignore-marker` variant stays the sensitivity control. |
| TS-under-plain-node seam loading | `scripts/run-tests-hooks.mjs` (the hook `scripts/run-tests.mjs` already uses) | **A — as-is** | `loadPolicySeams()` registers that hook and imports the P1 `.ts` modules. No new loader, no build step, no TS file added. |
| Failure classification | `scripts/diag-call-chain.mjs` (PR #394, EB4-B): `:269` `attribute`, `:389` `diagnose`, `:227` `FACE_TABLE` | **A — as-is** | `harness.classifyFailure()` delegates; see §5. |
| CI four layers | `.github/workflows/ci-{fast,integration,security,full}.yml` + `dev/ci/eb3-ci-manifest.json` | **A — as-is** | ONE step + ONE manifest leg added to `ci-integration`; no new workflow. See §6. |

Everything else — the sandbox-first P1 policy lane itself, the two-axis subset law, the refusal
vocabulary — is **consumed, never restated**. The harness contains no `if (mode === 'restricted')`
decision of its own: the unsupported lane comes back as the compiler's own
`IO_POLICY_UNSUPPORTED` (`compile.ts:142`).

## 2. What was deliberately NOT built (and why that is the reclamation rule)

| not built | why |
|---|---|
| a second Host launcher / `startHost` path | R2-b: `TestWorldFactory`/`DshInstance` is the only creation+boot point. A parallel boot chain would fork the ownership ledger (`/proc/<pid>/environ` verification), port leases and cleanup markers in one stroke. |
| a second budget ledger (or a per-harness counter file), or a second budget-gate formula **in this lane** | The host-start budget is a **shared** artifact; `run-record.mjs#logHostStart` is its only writer, and in the a5sf/u5 lane `run-record.mjs#hostStartBudgetPosition` is the one `used >= max` formula (both `u5-canary-runner.mjs` and the harness import it; the default cap is `DEFAULT_MAX_HOST_STARTS`, also imported — after PR #537's review round the runner no longer carries its own copy). A second counter could not be summed with the first, so "max starts" would stop being enforceable. The harness therefore *requires* the existing record **and** its ledger path instead of offering an alternative. **Scoped honesty (fresh-review condition C1):** repo-wide there remain PRE-EXISTING inline gates in other runners that predate this branch and are untouched by it — `tests/world-factory/u7-0-census-runner.mjs:156` and `:196`, `tests/world-factory/u7-4a-jobs-suite.mjs:220`, and `u5-parallel-supervisor.mjs:256` carries its own `15` default. They are out of this package's scope and are recorded here rather than silently implied away; folding them into the shared helper is a follow-up, not a claim of this package. |
| a second policy compiler / a harness-local ceiling type | R2/R1: `member-io-policy` is the only place `EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction` is computed. The C1 test asserts object identity + `instanceGeneration`, i.e. that no copy is in play. |
| a second oracle algebra | `lib/oracle.mjs` is the only effect conjunction (marker ∧ `body-ran` ∧ attributable pid). The harness only adapts the call shape. |
| a second failure-classification vocabulary/table | §5: the PR #394 table is reused as-is. Adding a5sf rows would create exactly the two-vocabulary hazard the reclamation registry §4 forbids. |
| a parallel CI pipeline (new workflow file) | §6: the C1 suite joins `ci-integration` (the layer that already lists its `node:test` files explicitly). |
| changing `installToolBindingRealm`'s export surface | One writer, one lane: the missing barrel re-export (§4) is disclosed to the P1 owner, not patched from here. |

## 3. Files added / changed

| path | why |
|---|---|
| `tests/world-factory/lib/a5sf-harness.mjs` | NEW. The one adapter P2 suites call: World creation + budgeted boot, P1 ceiling/invocation/guard/realm, oracle adapter, PR #394 classification entry point. |
| `tests/world-factory/a5sf-harness.test.mjs` | NEW. C1 proof (10 tests, zero boots): budget lease (incl. **no ledger path ⇒ refusal**), pin-not-copied, `MemberPolicy` identity + shipped guard allow/deny, `network: restricted` ⇒ UNSUPPORTED, oracle sensitivity both arms, classification delegation. |
| `tests/world-factory/lib/run-record.mjs` | MODIFIED (review response, 2026-11-02): exports the ONE `DEFAULT_MAX_HOST_STARTS` + `hostStartBudgetPosition` gate next to the ledger it reads. It lives here (not in `u5-canary-runner.mjs`) because importing the runner from a collected suite would close a top-level-await cycle (`runner → loadSuites → suite → harness → runner`) and deadlock; `run-record.mjs` has no such cycle. |
| `tests/world-factory/u5-canary-runner.mjs` | MODIFIED (review response, 2026-11-02): the inline host-start gate now calls the imported `hostStartBudgetPosition` and `parseArgs` uses the imported `DEFAULT_MAX_HOST_STARTS`, so the harness **imports** the one formula/default instead of copying either. Behaviour is unchanged. |
| `.github/workflows/ci-integration.yml` | ONE step (`a5sf harness C1`, host-free `node --test`) — the minimal wiring so the C1 file is not invisible to every layer. |
| `dev/ci/eb3-ci-manifest.json` | ONE `ci-integration` leg entry declaring that step's required token file, so dropping it is `CI_LAYER_LEG_WEAKENED` rather than a silent gap. |
| `dev/agent-workflow/evidence/a5sf-r2/README.md` | this record. |

No TypeScript file added or modified; no file under `tests/deepseek-harness-test-use/` touched;
`CORE PATCH BUDGET = 0`.

## 4. Seam note (in-repo, NOT a `CORE_SEAM_BLOCKER`)

`packages/runtime/team-services/src/install.ts:260` ships `installToolBindingRealm`, but
`packages/runtime/team-services/src/index.ts:14` re-exports only `installMemberIoProviders`.
Consequences and how this package handled it:

* the harness imports `install.ts` **directly** — the same module path the P1-05 test itself imports
  (`packages/runtime/test/a5sf-service-install.test.ts:47`). No TS change, no second implementation.
* the barrel's policy side (`compileMemberPolicy`, `createMemberFsGuard`, `TeamIoDenial`) *is*
  complete and is imported through the barrel.
* **recommendation for the P1 owner (not this package):** add
  `export { installToolBindingRealm } from './install.js'` + its types to
  `team-services/src/index.ts` and barrel-import it from the P1-05 test. Until then a P2 suite must
  use the deep import, which is a real (if small) surface inconsistency, not an upstream blocker.

This is not a `CORE_SEAM_BLOCKER`: the seam exists and is public in the repo; only the re-export is
missing, and the upstream tree is untouched.

## 5. Diagnostics inheritance (R4 / BL-12 hook)

**The tool exists.** PR #394 (`68287d1e4`, `task/u7-3-diagnostics-manuals-20261026`) shipped:

* `scripts/diag-call-chain.mjs` — static face/stage attribution for a governed refusal line
  (`a5p5-refused kind=… code=… detail=…`), a `shadow-verdict` JSONL row, or a bare code; closed
  vocabulary (`FACE_TABLE` `:227`), fail-closed (`UNKNOWN_CODE` / `AMBIGUOUS` / `REFUSED`).
* `tests/diag-call-chain/diag-call-chain.test.mjs` — its own laws (already a CI leg).
* `docs/DIAGNOSIS-CALL-CHAIN.md` — the documented limits (no boot, no live correlation, not an
  authority).

**Entry point added:** `harness.classifyFailure(input)`.

* a refusal **line/row** ⇒ `scripts/diag-call-chain.mjs#diagnose(text, {json:true})`, returned as that
  tool's own JSON report (`delegatedTo` names it). No re-implementation.
* a **P1 compiler refusal** (`{ ok:false, code, … }`) ⇒ the P1 code verbatim +
  `classified:false` + `overlappingAlpha5String`. **Why not delegate this arm:** the PR #394 table is
  the Alpha.5 tool-io vocabulary; it has **no a5sf emitter rows**. Where a *string* overlaps
  (`IO_POLICY_UNSUPPORTED`), its row (`scripts/diag-call-chain.mjs` `FACE_TABLE`) names the
  Alpha.5 admission faces — not `member-io-policy/compile.ts:142`. Quoting that row for an a5sf
  refusal would be a cross-vocabulary misattribution, and adding an a5sf row would be a second
  table. The `overlappingAlpha5String: true` flag discloses the overlap instead of hiding it.
* **No new classification vocabulary was created; no row was added to the PR #394 table.**
* **Boundary disclosure:** `A5SF_HARNESS_CODES` (`a5sf-harness.mjs:71-92`) is the adapter's **transport**
  refusal vocabulary (budget lease/exhaustion, world, seam, authority) — it is **not** a
  failure-classification table. A compiler refusal keeps `compilerCode` verbatim and a tool refusal is
  classified by `scripts/diag-call-chain.mjs`; nothing here classifies a tool effect.

## 6. Four-layer CI inheritance — what carries a5sf work

The layers are declared once in `dev/ci/eb3-ci-manifest.json` (schema `eb3-ci-manifest/1`) and
implemented by the four reusable workflows aggregated through `ci-required`; `census-runtime.yml` is
a separate, host-provisioned workflow (not part of the Required aggregate).

| layer | what it does today | a5sf work it carries | wiring changed by BL-10 |
|---|---|---|---|
| `ci-fast` | docs/impact tier: `eb3-impact`, mandatory `docs:probe`, `docs:sync --check` | the a5sf plan/evidence docs of later PRs (docs probe only; no suite runs) | **none** |
| `ci-integration` | EB3 governance checks + host-free `node:test` legs + `pnpm typecheck` | **`tests/world-factory/a5sf-harness.test.mjs` (this package's C1)**, and typecheck of any a5sf TS the PR touches | **ONE step + ONE manifest leg** (`a5sf harness C1`), because this layer lists its `node:test` files explicitly |
| `ci-security` | host-free security suites from `tests/checks/eb3-security-suites.txt` (vitest via `eb3-security-run.mjs`) | nothing yet — the P1 a5sf suites are **not in any suite list** (see risk below) | **none** (adding them is a reviewer/owner decision, not "minimal wiring") |
| `ci-full` | provisions the pinned pristine host, builds it, runs host-provisioned security suites + the census gate on every PR | the future **C2 a5sf suite runs' evidence re-grading** (RUN records; `eb3-run-manifest`) — no a5sf C2 suite exists yet | **none** |
| `census-runtime` | nine-root census, two captures, no refusal permitted (host-provisioned) | a5sf tool-source changes once the native integrator lands (P3) — a5sf does not add tools yet | **none** |

Checks run for this wiring, at this base:

```
$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=9 findings=0
$ node scripts/eb3-ci-negative-controls.mjs
24/24 control(s) behaved as required
```

**Disclosed CI gap (not fixed here, flagged to the coordinator/reviewer):** the P1 a5sf vitest suites
(`packages/runtime/test/a5sf-*.test.ts`) appear in **no** layer's suite list, and no layer runs a
generic `vitest`. Their "128/128" evidence was produced by a local/seat run (P1 PR body), not by CI.
For BL-10 the minimal, correct wiring was the C1 `node:test` file above; enrolling the P1 suites in
`tests/checks/eb3-security-suites.txt` belongs to the P1 owner / gate reviewer.

## 7. How to run the C1 test (no Host, no network, no ports)

```
node --test tests/world-factory/a5sf-harness.test.mjs
```

Observed on this executor (2026-11-02, real UTC), exit 0:

```
✔ budget lease: no run record ⇒ typed BUDGET_LEASE_REQUIRED, nothing constructed
✔ budget lease: a record with NO shared ledger path is refused — no ledger, no boot
✔ budget lease: an exhausted SHARED ledger refuses the boot and leaves ledger + World untouched
✔ budget lease: a permitted boot appends to the SAME shared ledger BEFORE startHost, then boots
✔ fixed candidate: the pin is READ from tests/paths.mjs, never copied into the harness
✔ policy identity: the installed ceiling IS the P1 MemberPolicy, and its guard is the shipped P1 guard
✔ policy identity: the Alpha.4 authority is required, never synthesised by the harness
✔ unsupported lane: network:restricted surfaces the P1 UNSUPPORTED code, never an allow
✔ oracle adapter: a planted effect is detected and an unplanted tag is absent (sensitivity, both arms)
✔ diagnostics: classifyFailure delegates to the PR #394 tool, and keeps a5sf codes in their own vocabulary
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

Also re-run green at this base (unchanged by this package): `node --test tests/world-factory/registries.test.mjs`
(12/12) and `node --test tests/world-factory/world-factory.test.mjs` (45/45, 115 s — it includes the
cross-process lease-race harness).

**Dependency note:** the C1 test imports the P1 TS seams, so it needs the workspace installed
(`pnpm install --frozen-lockfile`; `ci-integration` already does this) and Node ≥ 24 for native type
stripping. It does **not** need the pristine host tree (`hostTree` points at a non-existent temp path
and `candidate()` never asserts it).

### P2 usage sketch (what BL-14…BL-20 will call)

```js
import { createA5sfHarness } from '../lib/a5sf-harness.mjs'

export default { suite: 'a5sf-read', cases: [...], totalRequests: 80, async run(opts, ctx) {
  const h = createA5sfHarness({
    repoRoot: ctx.REPO_ROOT, evidenceRoot: opts.evidence, suite: 'a5sf-read', line: opts.line,
    runRecord: opts.record,                       // the runner's shared ledger — REQUIRED
  })
  const ceiling = await h.requireCeiling({ blueprint, templateId, memberInstanceId, instanceGeneration, authority })
  // ...in-World: h.installBindingRealm({ root, identity, toolBindingIdentity, effective })
  const world = await h.createWorld({ line: opts.line, u6Fs: { rows: [...] } })
  await world.startMock({ decide })
  await h.boot({ world })                          // budget-checked, ledgered, then startHost()
  const verdict = h.judgeEffect({ oracle: h.oracleFor(world), tag, returnedRan })   // independent effect
}})
```

## 8. Honest limits

* **No real Host boot was performed by BL-10.** The C1 proof stops at the ledger/launcher boundary:
  `world.startHost()` is exercised with a stub World that records the call and spawns nothing. The
  `MemberPolicy`/guard/realm identities are proven against the real P1 modules, but no live Cordis
  root exists in this package.
* **No real-effect verification is claimed.** The oracle arms use a fixture home with this process's
  pid as the "live host" (the same idiom as `world-factory.test.mjs`); a real marker written by a
  real tool body under a booted World is a C2 claim for P2.
* **`installBindingRealm()` is not exercised here** (it needs a live Cordis root + provider). Only its
  pass-through shape is defined; P2 owns the live mount.
* **`assertCandidate()` is not exercised here** (it requires the pristine host checkout); it delegates
  to the already-C1-proven `assertHostBase`.
* If a P2 suite ever needs a Host boot, the exact command (to be run by the coordinator under a boot
  budget, not by this package) is the existing runner, not a new one:

  ```
  node tests/world-factory/u5-canary-runner.mjs --suite a5sf-read --line a5sf-p2-01 \
      --evidence dev/agent-workflow/evidence/a5sf-p2/read --budget-ledger <shared>.artifacts/budget.jsonl \
      --max-host-starts 15
  ```

  (the suite file `tests/world-factory/suites/0NN-a5sf-read.mjs` is BL-14's deliverable; the runner,
  its budget gate and its RUN record are inherited unchanged).

## 9. Review response (2026-11-02T21:05Z, real UTC)

The independent review at HEAD `2e3a57a22b865afce7f500b144bf8a832d4f58c6` returned **BLOCK** for
one fail-open, plus three conditions. This section is the response at the review-response HEAD.

**B1 (blocking) — a record with no ledger path booted unbudgeted.** `createRunRecord()` makes
`ledgerPath` optional; `ledgerStartCount()` then answers `0` forever, so the old gate (`used >= max`)
never fired: a default record with `maxHostStarts: 1` executed 3 boots. Fixed as *no ledger, no boot*:

* `assertBudgetLease()` refuses construction when `record.hostStarts.ledgerPath` is null/empty
  (`a5sf-harness.mjs:195-204`), `BUDGET_LEASE_REQUIRED` with `field: 'ledgerPath'`;
* `boot()` re-checks the path so a record mutated after construction cannot slip through
  (`a5sf-harness.mjs:281-288`), before the position check and before any spawn;
* new C1 arm `budget lease: a record with NO shared ledger path is refused — no ledger, no boot`
  (`a5sf-harness.test.mjs:152-181`): the default record is refused at construction, and a
  ledger-bearing record whose path is stripped is refused on **both** boot attempts with
  `startHost` never reached and no ledger row written.

**C1 — the ordering claim was unasserted.** `stubWorld({ onStart })` now reads the shared ledger
*inside* `startHost()` (`a5sf-harness.test.mjs:92-100`, `:214-225`). Moving `logHostStart` after the
spawn makes that read throw and the suite RED (mutation below).

**C2 — one gate, not two.** The gate now lives with the ledger it reads:
`run-record.mjs:39` `DEFAULT_MAX_HOST_STARTS` + `:40` `hostStartBudgetPosition`. The runner's
pre-spawn gate calls it (`u5-canary-runner.mjs:57`, `:992`) and the harness imports **exactly**
`{ DEFAULT_MAX_HOST_STARTS, hostStartBudgetPosition }` from `./run-record.mjs`
(`a5sf-harness.mjs:67`). No formula or default is copied locally; `harness.budget()` returns the
helper's position unchanged. Nothing was imported from `u5-canary-runner.mjs`.

*Why not export it from the runner:* doing so made the harness import the runner, and a collected
suite importing the harness closes a top-level-await cycle
(`u5-canary-runner.mjs → loadSuites() → suite → a5sf-harness.mjs → u5-canary-runner.mjs`) that
deadlocks with `Warning: Detected unsettled top-level await`. Reproduced on a throwaway tree with a
synthetic `suites/999-a5sf-cycle.mjs` importing the harness; after moving the gate to
`run-record.mjs` the same probe reports `cycle-safe: true`. This is why the one gate is imported
from the ledger module, not the runner module.

**C3 — evidence.** Base corrected to `0a5b58418` (#537) with the `17ce70430` merge-base disclosed;
`A5SF_HARNESS_CODES` disclosed as transport vocabulary, not a classification table (§5).

Re-runs on the review-response tree (real command output):

```
$ node --test tests/world-factory/a5sf-harness.test.mjs
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

Mutation checks on a throwaway copy of the worktree (each mutation restores the tree afterwards;
scratch deleted, no branch file touched):

| mutation | result |
|---|---|
| disable the gate (`if (false && position.exhausted)`) | `ℹ pass 9 / ℹ fail 1` — `budget lease: an exhausted SHARED ledger refuses the boot and leaves ledger + World untouched` |
| coerce `IO_POLICY_UNSUPPORTED` to `{ok:true, policy}` | `ℹ pass 9 / ℹ fail 1` — `unsupported lane: network:restricted surfaces the P1 UNSUPPORTED code, never an allow` |
| let a null ledger path through (`ledgerPathOf` fallback) | `ℹ pass 9 / ℹ fail 1` — `budget lease: a record with NO shared ledger path is refused — no ledger, no boot` |
| log after the spawn (`startHost` then `logHostStart`) | `ℹ pass 9 / ℹ fail 1` — `budget lease: a permitted boot appends to the SAME shared ledger BEFORE startHost, then boots` |

```
$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=9 findings=0
$ node --test tests/world-factory/world-factory.test.mjs
ℹ tests 45
ℹ pass 45
ℹ fail 0
```

No Host boot was performed for this package; the only `startHost` reached in the C1 suite is the
stub. No shared budget ledger file was created or modified by the branch (`git status --short` is
clean apart from the intended files).
