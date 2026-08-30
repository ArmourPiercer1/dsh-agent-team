# Gate G3 Report — P3-T6 Domain Integration / Property Review

- **Task**: P3-T6 (TaskDoc §11.4) — combine Blueprint / Member / Policy /
  Compatibility; execute the architecture property suite.
- **Branch**: `task/P3-T6-domain-integration` (worktree `.worktrees/P3-T6`,
  base `ba293ec91f7712153ad35c98b5da43d3247acc14`).
- **Verdict**: **G3 PASS** — all seven criteria of Development Plan §16.4 are
  encoded and property-tested at the domain-integration level, with
  cross-module (cross-package) evidence on every criterion.

## Result summary

| Suite | Count | Result |
| --- | --- | --- |
| t6 bundle (`node scripts/run-tests.mjs testkit`) | 79 t6 + 2 baseline = 81 | 81 passed, 0 failed, exit 0 |
| Full suite (`node scripts/run-tests.mjs`) | 492 | 492 passed, 0 failed, exit 0 (= 413 baseline + 79 t6) |
| `tsc -p packages/testkit/tsconfig.json` | — | exit 0 |
| `tsc -p packages/testkit/domain/tsconfig.json` | — | exit 0 |
| `tsc -p packages/domain/tsconfig.json` | — | exit 0 |
| `tsc -p packages/contracts/tsconfig.json` | — | exit 0 |

Canonical run evidence: `dev/agent-workflow/evidence/P3-T6/run-log.txt`
(canonical attempt 1 failed at leg 3 with 15 type errors, all fixed test-side;
canonical attempt 2 — the final state — passed all six legs). The test files
were not modified between attempt 2 and this report except one docstring
count correction (t6-9 header "29" → "31"); a post-fix testkit re-run
re-confirmed 81/81.

## Rerun (canonical chain, from the worktree root)

```sh
pnpm install --ignore-scripts
node scripts/run-tests.mjs                                        # 492/492, exit 0
node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json
node node_modules/typescript/bin/tsc -p packages/testkit/domain/tsconfig.json
node node_modules/typescript/bin/tsc -p packages/domain/tsconfig.json
node node_modules/typescript/bin/tsc -p packages/contracts/tsconfig.json
```

Filtered t6 only: `node scripts/run-tests.mjs testkit` (81 tests).

## Criterion-by-criterion evidence (DevPlan §16.4)

### G3-1 "domain has no live Agent dependency" — `t6-1-no-agent-dependency.test.ts` (6 tests)

The complete import closure of the t6 bundle — 9 direct imports + 54
transitive specifiers of the six composed modules (contracts, blueprint,
member, lifecycle, policy, compatibility) and their testdata data modules —
is enumerated as closed data in `packages/testkit/domain/src/import-graph.ts`
(63 distinct specifiers, asserted self-consistent). Properties asserted:

1. no closure specifier carries a banned path segment (`runtime`, `tools`,
   `remote`, `client`, `legacy`, `team`) or a banned bare workspace name;
2. the banned set itself covers the frozen Agent package roster;
3. the **only** bare (non-relative) specifier in the entire closure is
   `yaml` (the blueprint parser's frontmatter dependency) — no Node builtins,
   no framework, no upstream DSH import;
4. every direct bundle dependency live-imports at runtime and exposes its
   expected marker export (the list is real, not fiction);
5. no public runtime export of any composed module is named after a live
   Agent.

### G3-2 "one template → N instances covered by property tests" — `t6-2-template-n-instances.test.ts` (8 tests)

Property: instantiating the **same** template N times in one TeamSession
yields N distinct runtime identities `(rootSessionId, instanceId)`
(invariant 18); labels/template ids are NOT runtime identities (invariant
19). N sweeps `{1,2,3,4,5,6,7,8,12}` (deterministic seeded scenario,
`packages/testkit/domain/src/scenario.ts`):

- N distinct identities per N; all N share templateId + label yet are
  pairwise distinct;
- `instancesForTemplate` / `instanceCountForTemplate` agree with N;
- every record carries its own durable child session binding (invariants
  23/24);
- identity key → parse → same identity; an identity cannot be asserted into
  a foreign TeamSession (`IDENTITY_SCOPE_MISMATCH`);
- N=0 is a valid composition (empty roster, one team-root binding);
- runtime identity = `(TeamSessionId, instanceId)` with
  `TeamSessionId = RootSessionId` (invariants 9/18).

### G3-3 "lifecycle transition matrix fixed" — `t6-3-lifecycle-matrix.test.ts` (8 tests)

The §29 FSM is frozen data in the pure lifecycle module. The suite
re-derives the matrix from the frozen operation rules and asserts:

- the operation rules literal (5 operations, exact sources/targets) and the
  derived matrix equal the expected **9-edge literal (9 of 25 ordered state
  pairs legal)**;
- `canTransition` / `legalTargets` / `assertTransitionLegal` agree with the
  matrix over **all 25 pairs**;
- all 9 legal edges commit: new frozen record, `activityVersion + 1`, input
  record untouched;
- all 16 illegal pairs reject with typed `LifecycleTransitionError`
  (`LIFECYCLE_TERMINAL_STATE` from DISPOSED, `LIFECYCLE_ILLEGAL_TRANSITION`
  otherwise);
- the full **5×5 operation × state sweep** of `applyLifecycleOperation`
  matches the rules exactly (9 commits, 16 typed rejections);
- RESTORE lands in SETTLED only (frozen 3A — never to RUNNING); DISPOSED is
  terminal (invariant §29.5).

### G3-4 "policy precedence exhaustive tests" — `t6-4-policy-precedence.test.ts` (11 tests)

Exhaustive over the frozen six-stage ascending candidate chain
`[blueprint, policyState, template, templateOverlay, instanceOverlay,
humanOverride]` × 5 capabilities:

- solo winner per layer (6 layers × 5 caps); origin/scope variants;
- pairwise: higher allow beats lower allow, lower recorded with provenance
  (15 pairs × 5 caps); deny above: higher deny beats lower allow
  (15 × 5); relaxation: a higher allow lawfully relaxes a lower deny
  (15 × 5, invariant 34);
- full six-layer stack: humanOverride wins, all five lower layers recorded
  ascending (`overriddenLower` = all earlier candidates);
- the **external stage is un-bypassable**: even the strongest Team layer
  cannot win (5 caps × 5 external combinations);
- fail-closed: no candidates resolves deny with unspecified static
  provenance;
- determinism + explainability: double run byte-identical, explanation
  non-empty, output deeply frozen;
- `suppressed` is populated **only** when the policyState cell `locked ===
  true` (reason `policyStateLocked`, Architecture §19.4);
- identity scope: a foreign-root identity is rejected (policy family,
  single class); mirror-vs-contracts: the same `(root, instance)` yields
  equal identities when re-parsed through the contracts boundary.

### G3-5 "complete:true compatibility fatal test" — `t6-5-compat-complete-true.test.ts` (6 tests)

Cross-module exhaustive property at the domain-integration level (the P3-T5
unit suite covers single-codepoint cases only):

- the closed **requirement-type × complete-mode × availability cube** (36
  cells) is one property with a fixed outcome/reason/status per cell, and
  `complete` absent ≡ explicit `false` (byte-identical canonical results);
- complete:true persona unmet → FATAL with the exact frozen contracts-v1
  code `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` (structural FATAL, not
  downgradeable; Architecture §13.5);
- complete:true on an ordinary (tool) requirement → FATAL
  `COMPLETE_REQUIREMENT_NOT_MET` (complete dominates type);
- an acknowledgement bound to a complete:true FATAL **cannot downgrade it**
  (no Continue Anyway; Architecture §27.2);
- satisfied complete:true → PASS/SATISFIED and admits (OPEN);
- the conflict result is deterministic and canonical-JSON round-trips with
  stable environment fingerprint.

### G3-6 "Blueprint snapshot immutable tests" — `t6-6-snapshot-immutability.test.ts` (8 tests)

- `parseBlueprint` returns a deep-frozen blueprint; every mutation attempt
  throws `TypeError`;
- the snapshot ref is frozen, keyed `blueprintId@revision`, and round-trips
  through the contracts key parser;
- BOM + CRLF text normalizes to the identical parsed document and content
  hash; shuffled top-level key order yields the identical content hash;
- a revision series yields distinct content hashes; content changes change
  the hash;
- `contentHash` is derived, never a source field (smuggled-field fixture
  fails with its typed code);
- the composition binds a deep-frozen snapshot ref into the TeamSession
  record (one TeamSession ↔ one immutable snapshot, invariant 10).

### G3-7 "fresh_per_delegation semantics encoded as new-instance policy" — `t6-7-fresh-per-delegation.test.ts` (6 tests)

`fresh_per_delegation` is an **instance-creation policy** — a new
delegation to the template creates a NEW MemberInstance with a new child
Session (Architecture §11.3/§41.4) — not a context reset:

- property: a fresh_per_delegation template ALWAYS resolves
  `create/fresh_per_delegation`, for any roster size and state mix;
- contrast: `persistent` (the default) continues the unique work-accepting
  instance, creates when none, refuses when several;
- explicit addressing **always** continues the addressed instance, even
  under the fresh policy (an ARCHIVED instance resolves to itself);
- delegation loop: 3 sequential delegations to the fresh template yield 3
  distinct instances carrying the frozen policy;
- `contextPolicy` is frozen at creation and survives every lifecycle
  transition (Architecture §21.6); DISPOSED never accepts new work (§29.5).

## Cross-cutting must-tests (TaskDoc §11.4)

### `t6-8-serialization-roundtrip.test.ts` (9 tests)

Every contracts-v1 DTO surface round-trips `create → serialize →
deserialize → identical`: TeamSessionRecord, MemberInstanceRecord (stamped
CREATED / activityVersion 1), SessionBinding (all three kinds),
BlueprintSnapshotRef (canonical JSON + `blueprintId@revision` key),
CompatibilityResult, the full composed team configuration (through
`serializeComposition`/`parseComposition` with contracts parsers only), and
the MemberIdentity canonical key **strictly** — the canonical encoding is
instanceId-first; a reordered (rootSessionId-first) or field-missing
encoding is rejected with `MALFORMED_DTO`; a foreign-root key never equals
the team-root key.

### `t6-9-negative-matrix.test.ts` (12 tests; **88 runtime negative cases**)

One table-driven negative matrix across all five composed modules, plus the
error-family disjointness property. Case census (runtime):

| Family | Cases | Coverage |
| --- | --- | --- |
| contracts | 62 | id validation (8), schema versions (3), team-member binding missing instanceId (1), legacy `memberId` quarantine (3), legacy Team SessionEvent names — all 5 (detection-only, `LEGACY_TEAM_SESSION_EVENT_REJECTED`), uniqueness guards (3), remote-safe JSON boundary (3), roster lookup miss `MEMBER_NOT_FOUND` (1), **all 31 blueprint negative fixtures** (typed code per fixture), malformed compatibility inputs (4) |
| member | 6 | reserved `inst-leader` id, unknown context policy, delegation to DISPOSED / ambiguous explicit+template / missing address, workspace mutation after RUNNING |
| policy | 4 | malformed policy input, member self-escalation, leader out-of-envelope, foreign-scope identity |
| lifecycle | 16 | every illegal state pair (typed `LifecycleTransitionError`) |
| **Total** | **88** | |

Properties asserted: the closed contracts-v1 error vocabulary is exactly
**20 codes** (Set size over `TEAM_CONTRACT_ERROR_CODE_VALUES`); every code
raised by the 88 cases is a member of that closed set; every negative case
fails with **exactly one domain error class** — judged by class identity,
because `IDENTITY_SCOPE_MISMATCH` is deliberately shared between the
contracts and policy vocabularies (different classes); schema/malformed/
legacy codes surface only as the contracts family.

### `t6-10-composition-pipeline.test.ts` (5 tests)

End-to-end deterministic pipeline composing all five modules:
blueprint source → parseBlueprint → immutable snapshot ref →
buildTeamComposition (TeamSession + N MemberInstances) →
applyLifecycleOperation (scripted durable states) →
resolveEffectivePolicy (explainable per-member policy) →
evaluateCompatibility (environment-gated result). Properties:

- builds deterministically and binds the immutable snapshot (invariants
  9/10);
- identity stays consistent across stages — the policy stage's identity,
  re-parsed through the contracts boundary, equals the composition identity
  (`memberIdentitiesEqual`);
- instance-scoped human override wins and every value is explainable;
- compatibility stage: OPEN when fully available, BLOCKED_WARNING on the
  optional mcp gap (environment facts via the parsed-type
  `computeEnvironmentFingerprint(requirements, facts)` boundary);
- the pipeline is reproducible **byte-identically from its serialized
  durable projection** (contracts v1 parsers only, no live object
  references). The test-side glue `DOMAIN_TO_REQUIREMENT_TYPE` (blueprint
  lowercase-slug domains → the closed 6-value compatibility type
  vocabulary) is asserted closed.

## Zero-core statement (CORE PATCH BUDGET = 0)

No upstream DSH source was touched. Evidence: `git status` in the worktree
shows modifications only under the owned paths
(`packages/testkit/**`, `docs/contracts/**`,
`dev/agent-workflow/evidence/P3-T6/**`); the t6-1 negative test proves the
entire bundle import closure is free of live-Agent packages, Node builtins,
and any bare specifier other than `yaml`; no Node builtin appears in
`packages/testkit/domain/src` or any t6 test.

## Contract gaps

**None.** All expectation mismatches encountered during development were
test-side errors against *documented* frozen v1 behavior (e.g. the canonical
member identity key is instanceId-first per `packages/contracts` tests; a
team-member binding missing `instanceId` throws `INVALID_INSTANCE_ID` per
the `parseSessionBinding` JSDoc; `parseBlueprintContentHash("nope")` is
valid under the frozen non-hex rule; the blueprint negative fixture set has
31 entries). Per the task protocol these are fixed test-side, and **no
CONTRACT_CHANGE_REQUEST is raised**; `packages/contracts/**` is unmodified.
