# F-10 — the observation contract has an identity of its own (and the trace's actor is bound)

**Dated:** 2026-11-20 (real UTC, session date). **Branch:** `task/f10-contract-identity-20261120`.
**Base:** `origin/master` = `ef7e3af0088bf3af8fc765ce27951f9dbad92892`.
**Finding:** F-10 (P1, external review), following F-07/F-08/F-09 in the same observer closeout.
**Scope:** `tests/world-factory/lib/**` + `tests/world-factory/*.test.mjs` + the two CI enrolment
points. **Zero** `packages/**` changes (CORE PATCH BUDGET = 0); no routing, Authority, ControlService,
ToolPlane or old execution path is touched.

## 1. The counterexample

`declareObservationContract()` ended with `Object.freeze(contract)` and hung the World on a
non-enumerable, module-private Symbol (`WORLD_REF`). `contractWorldIdentity(contract)` then read
`contract[WORLD_REF]` and asked `isFactoryWorld(world)`. **Property reads walk the prototype chain**,
so:

```js
const validContract = declareObservationContract({ world, agentId, executionId, scope })
const derived = Object.create(validContract)
Object.defineProperty(derived, 'world_id', { value: 'another-world' })
contractWorldIdentity(derived)
// BEFORE: { ok: true, world: <the WORLD_REF inherited from validContract>, receipt: … }
// 'another-world' is never compared; the World receipt belongs to the parent object.
```

The contract object had **no identity of its own**. It inherited one, and the inherited receipt
silently vouched for a field the child had overridden. The same shape admitted:

- `Object.create(validContract)` with no override (indistinguishable from the real object by every
  field a caller reads);
- a **symbol reflection copy** — the “non-enumerable” symbol is enumerable to
  `Object.getOwnPropertySymbols()` / `Reflect.ownKeys()`, and copying those descriptors onto a fresh
  object carried the World with it;
- a **cross-wire**: a child of contract A (World A) whose own `world_id`/`world_home`/`agent_id`/
  `execution_id` say contract B's values — the old predicate answered “ok, World A”.

The second half of the finding is in `checkWindowBinding()`: it selected trace carriers by
`event.execution_id === contract.execution_id` and nothing else, so two sessions that share a call id
could swap evidence. The durable trace already carries `actor_id` (the session id); it was never
compared to the contract's `agent_id`.

## 2. Why it passed before

The previous fix (F-09) rightly made the **World** identity object-keyed (`WeakSet` + private brand in
`tests/world-factory/lib/world-identity.mjs`), but it stopped at the World. The **contract** was still
identified by shape + an inherited symbol. The negative controls at the previous head covered
`Object.create(world)`, `{...contract}` and `structuredClone(contract)`; they did **not** cover
`Object.create(contract)`, symbol reflection, or a field override on a derived object. A spread copy
loses non-enumerable symbols (so it failed), which made the symbol look private — it is not: only
*spread* does not copy it, reflection does.

## 3. What was minted, and why this mechanism

`world-identity.mjs` now owns a companion contract identity:

| piece | what it answers | why it cannot be inherited/copied |
| --- | --- | --- |
| `DECLARED_CONTRACTS` (`WeakSet`) | “is this **the object** the declaring function wrote?” | keyed by object identity; a child, spread, reflection copy, proxy, `structuredClone` and JSON round-trip are different objects |
| `CONTRACT_SNAPSHOTS` (`WeakMap`) + frozen snapshot of `world_id` / `world_home` / `agent_id` / `execution_id` / `contract_id` | “are the contract's **own data properties** still the values written at declaration?” | mint-once (a second mint returns the first snapshot, so a mutated object cannot be re-baselined); comparison reads own **data** descriptors only |
| `declareContractIdentity()` / `isDeclaredContract()` / `declaredContractFields()` | the API the declaring module (and only it) calls | `declareObservationContract()` is the only mint site (`git grep` census below) |

`contractWorldIdentity()` now refuses, in order, with three distinct names:

1. `CONTRACT_IDENTITY_UNPROVEN` — no contract identity receipt (not the minted object);
2. `CONTRACT_FIELDS_MISMATCH` — an own field moved from the snapshot, is no longer an own **data**
   property (accessor/inherited shadowing), the `world_identity` receipt field was replaced, or the
   contract's fields disagree with the Factory receipt of the World it carries (cross-wire);
3. `WORLD_IDENTITY_UNPROVEN` — unchanged F-09 rule: the carried World is not a minted World.

`checkWindowBinding()` calls `contractWorldIdentity()` **first** (before comparing any field), then the
existing lifecycle/window/trace rules, then the new actor rule: every `tool/call` / `tool/result`
event whose `execution_id` equals the contract's must have `actor_id === contract.agent_id`. A foreign
actor (or a missing one) is `ACTOR_ID_MISMATCH`. The detail names both the actor seen and the agent the
contract declares.

### Frozen? Snapshot? Both — and why

The contract was **already** `Object.freeze`d at `ef7e3af00`; the census found **no caller that
mutates a contract**, so immutability is retained with **no exception**. Freeze alone is not the
identity check: any caller can freeze a forged literal, and a Proxy/child can report other values over
a frozen target. The snapshot is what makes *field drift* observable even if a future edit removes or
misapplies the freeze (control (d) proves the snapshot refuses a minted-but-mutable object). Direct
mutation of the real contract throws in strict mode and leaves the field unchanged — asserted.

### Control (b): a no-override `Object.create(contract)` is refused, not “attributed”

Decision: **refuse**. A child that agrees with its prototype today is one `defineProperty` away from
control (a), and the only difference between the two is which fields a later reader chooses to touch.
Attribution by “it currently matches” would require re-deriving the whole field set at every call site
and would still accept the next write. Object identity is the receipt; a derived object is not the
declared contract even when every inherited field matches.

## 4. Caller census (`git grep`, at the final head, excluding docs/log prose)

| symbol | executable callers |
| --- | --- |
| `declareObservationContract` | declared in `lib/m7b1-observation-contract.mjs`; called by `m7b1-observation-window.test.mjs` (3 sites), `tinf-observer-closeout.test.mjs` (1), `f10-contract-identity.test.mjs` (2), and the historical evidence probe `dev/agent-workflow/evidence/tinf-observer-20261119/probe-verdicts.mjs` (1). **No production caller.** |
| `contractWorldIdentity` | `lib/m7b1-observation-contract.mjs` (2 internal), `tinf-observer-closeout.test.mjs`, `f10-contract-identity.test.mjs`, evidence probe above |
| `checkWindowBinding` | `lib/m7b1-observation-contract.mjs` (1 internal), `m7b1-observation-window.test.mjs`, `f10-contract-identity.test.mjs` |
| `openObservationWindow` / `closeObservationWindow` / `judgeObservationWindow` | `lib/m7b1-observation-contract.mjs` + `m7b1-observation-window.test.mjs` only (the testkit has an unrelated internal `closeObservationWindow`, not this module) |
| `declareContractIdentity` / `isDeclaredContract` | new; the declaring module + `f10-contract-identity.test.mjs` |
| contract field writes after declaration | **0** (only the deliberately-throwing mutation attempt in the new suite). `Object.freeze(contract)` is at `lib/m7b1-observation-contract.mjs:372`. |

**Freeze broke nothing:** no caller mutates; the only behavioural change for existing suites is the
refusal **name** for a copied/derived contract (`WORLD_IDENTITY_UNPROVEN`/`IDENTITY_MISMATCH` →
`CONTRACT_IDENTITY_UNPROVEN`) and the new `actor_id` requirement on synthetic trace events. Both were
updated in the two existing suites and re-run (transcripts in the evidence dir).

## 5. Negative controls and the mutation → RED transcript

Suite: `tests/world-factory/f10-contract-identity.test.mjs` (host-free; 9/9 green on the final head).

| control | pre-fix behaviour | post-fix |
| --- | --- | --- |
| (a) `Object.create(valid)` + overridden `world_id` | `ok:true`, inherited World | `CONTRACT_IDENTITY_UNPROVEN` |
| (b) `Object.create(valid)`, no override | `ok:true` | `CONTRACT_IDENTITY_UNPROVEN` |
| (c) `Reflect.ownKeys` + `getOwnPropertySymbols` copy | `ok:true` (symbol copied) | `CONTRACT_IDENTITY_UNPROVEN` |
| (d) minted, `world_id` mutated after mint; accessor shadow | accepted / no mint existed | `CONTRACT_FIELDS_MISMATCH` |
| (e) two Worlds' contracts cross-wired; minted cross-wire | `ok:true` with World A | `CONTRACT_IDENTITY_UNPROVEN` / `CONTRACT_FIELDS_MISMATCH` (receipt cross-check) |
| (f) `execution_id` matches, `actor_id` is another agent | `checkWindowBinding()` → `null` (a pass) | `ACTOR_ID_MISMATCH` |
| POSITIVE: real declared contract | accepted | accepted (`ok:true`, `checkWindowBinding → null` with its own actor) |

Mutation procedure: `git checkout ef7e3af00 -- tests/world-factory/lib/m7b1-observation-contract.mjs
tests/world-factory/lib/world-identity.mjs`, then
`node --test tests/world-factory/f10-contract-identity.test.mjs`; restore by copying back the saved
post-fix files (byte-identical, sha256 compared) and re-running. Verbatim transcripts:
`mutation-prefix-red.txt` (pre-fix, 7 of 8 subtests red, positive control still green) and
`f10-suite-green.txt` (restored, 9/9 green; sha256 of both lib files compared against the saved
post-fix copies). The same reverted run of `tests/world-factory/world-factory.test.mjs` is in
`baseline-world-factory-prefix-libs.txt` and shows the SAME single pre-existing environment failure
(the RUN-record `teamSha/hostSha` binding test) as the post-fix run (`existing-world-factory.txt`,
44/45), so it is not caused by F-10. An earlier post-fix run of that suite also caught a flaky
`C1 dry-run uses supervisor path without starts` timing failure (43/45); the rerun and the pre-fix
run both pass it, which is why it is recorded as flaky, not as an F-10 regression.

## 6. CI enrolment

Appended to the **same** argv of the census job's `Next host — the rc.5 lane` step
(`.github/workflows/census-runtime.yml`) and to the mirrored `check[]` of the `next host lane` leg in
`dev/ci/eb3-ci-manifest.json`. The suite needs no host (scratch directory only), but it rides the one
job that already provisions a host for the same reason the lane suites do: a new dispatch step would
be a permanent `--parity` `UNCONVERTED`, and the hand-written argv law (`scripts/eb3-ci-negative-controls.mjs`
C-NH1) requires the workflow line and the manifest leg to stay byte-identical. Dispatch legs,
`dispatch-tests --parity` evidence and `scripts/test-catalog.test.mjs` were not touched.

## 7. Gates observed on the final head

See `dev/agent-workflow/evidence/f10-contract-identity-20261120/README.md` for the verbatim files and
the exact commands. Summary of what was **observed green**:

- new suite 9/9; `tinf-observer-closeout.test.mjs` 27/27; `m7b1-observation-window.test.mjs`
  9 pass + 1 declared skip without a host, and **10/10 with a correctly provisioned pinned host**
  (`M7B1_HOST_TREE` = `.worktrees/tinf-merge-shape/...`, HEAD = `639ed01539…`, porcelain 0);
- `world-factory.test.mjs` 44/45 with **1 pre-existing environment failure** (RUN-record bindings)
  that also occurs with the pre-fix libs (see §5; one earlier run was 43/45 on a flaky C1 timing
  test); `m7a-real-slice-unit.test.mjs` 16/16;
- `test-catalog --max-uncollected 41 --max-excluded 7`: tests **878 → 879** (+1), uncollected **41**,
  excluded **14** (bound 7 = excluded-in-CI-eligible set), refused 0;
- `dispatch-tests --check` PASS (18 legs, bad 0); `eb3-ci-required` pass (10 workflows, 0 findings);
  `eb3-ci-negative-controls` **33/33**; `docs-sync --check` exit 0; `lint-identities --diff
  dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` 0 new / 0 resolved;
  `git diff --check` clean;
- `tsc --noEmit`: 5 of the 8 package tsconfigs green (`contracts`, `domain`, `storage`, `tools`,
  `remote`); `runtime`, `client`, `testkit` fail on missing dev dependencies of a fresh worktree
  (`@types/node`, React/client store packages), see UNKNOWN. (`packages/legacy` has no tsconfig, so
  the loop runs 8 configs, not 9.)

## 8. UNKNOWN / disclosed boundaries

- **In-process trust boundary (F-09, restated).** This closes **object forgery** by callers, copies,
  serialization and prototype/reflection tricks. It is **not** a boundary against malicious code that
  imports `world-identity.mjs` and calls `declareContractIdentity` itself: such code can mint an
  identity for an object it built, exactly as it could already call `mintFactoryWorldIdentity`. That
  code is producing a fixture, not proving one. Nothing here is a process/isolation boundary.
- **`actor_id` semantics.** The binding is `String` equality with the contract's `agent_id`; it does
  not prove the host itself is honest, only that the durable event the host wrote names the same actor
  the contract names. A trace with no `actor_id` is refused (equality is required).
- **`tsc --noEmit` environment.** A fresh worktree has no `node_modules`; the repo-root install is
  pnpm-linked to another worktree and is missing `@types/node` / client packages for 3 packages.
  This change touches **no** `packages/**` file (verified by `git diff --name-only`), so those failures
  cannot be attributed to it. Not claimed green.
- **Real-host provisioning.** The main checkout's pinned tree has a **locally built**
  `native/system/packages/*/bin/glibc/system.node` (sha `75450f92…`), which the module correctly
  refuses as `HOST_ASSETS_UNPROVEN` (transcript `existing-m7b1-real-host-local-assets-mismatch.txt`).
  The 10/10 real-host transcript was produced against an already-provisioned pinned tree in
  `.worktrees/tinf-merge-shape` (sha `54a9c25c…`, HEAD `639ed01539…`, porcelain 0). This session did
  not re-provision any tree.
- **`world-factory.test.mjs` 1 red (flaky +1).** Pre-existing environment failure: RUN-record
  bindings without `teamSha`/`hostSha`; identical with the pre-fix libs. One earlier post-fix run also
  failed a C1 dry-run timing test that passed on rerun and pre-fix. Not claimed green, not caused by
  this change.
