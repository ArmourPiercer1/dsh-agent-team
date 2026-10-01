# Evidence — ALPHA.3 PR3: Governance Mutation Integration (GMS permission mutation path)

Branch `task/alpha3-pr3-permission-mutation`, base `8525b9519ea1d690066666c4ab7bcd2cc63432de` (= `origin/master` at start, verified by `git rev-parse origin/master`).
Worktree `.worktrees/pr3-gms-permission-mutation`; node_modules copied read-only from `.worktrees/pr2-effective-assembler` (root + packages/{client,domain,runtime}); NO pnpm install was run. Offline only (vitest/node; no host, no network, no chrome). Frozen lease paths (`.worktrees/int-alpha3-stage2`, `.worktrees/.scratch-logs/s2o-runner/`, stage2-live evidence) were NEVER touched.

## Raw logs (chronological)

| File | Command | Result |
| --- | --- | --- |
| `baseline-runtime-suite.log` | `npx vitest run` (packages/runtime) @ base | rc=1 — 8 failed / 3079 passed (6 files). PRE-EXISTING at the base commit (live-seam dependent: `sessionPersistence.exists`, p6t3 mediation/restart, t12a collect failures). Baseline for the no-regression bar. |
| `red-raw-module-absent.log` | `npx vitest run test/a3p3-permission-mutation-authority.test.ts test/a3p3-governance-lane-hygiene.test.ts` BEFORE any production code | rc=1 — 20 failed (2 files), raw `Cannot find module '../governance/permission-mutation.js'` = honest RED. |
| `green-first-run.log` | same two specs after implementation | rc=0 — 28 passed / 28. |
| `typecheck-runtime.log` | `npx tsc -p tsconfig.json` (packages/runtime) | rc=0. |
| `mutation-probe-1-envelope-skip.log` | mutant: `if (false && actor === 'leader' && plan.expansions.length > 0)` in `governance/service.ts` (envelope check bypassed) | rc=1 — 8 tests die (every envelope-refusal leg incl. exec exactness and Human-recovery). Mutant KILLED. |
| `mutation-probe-2-cas-bypass.log` | mutant: `if (false && mutation.expectedGeneration !== undefined && ...)` (CAS bypassed) | rc=1 — the CAS test dies. Mutant KILLED. Both mutants reverted; `grep "if (false"` afterwards returned zero hits; specs re-run green afterwards. |
| `full-runtime-suite-green.log` | `npx vitest run` (packages/runtime) final | rc=1 — 8 failed / 3107 passed. Failure set byte-IDENTICAL to baseline (`diff` of sorted FAIL lines = empty → "FAILURE-SET-IDENTICAL"). Delta vs baseline: +28 tests, all new, all pass. |
| `p4t6-scanner-pin-green.log` | `npx vitest run test/p4t6-session-event-scan.test.ts` (packages/testkit) | rc=0 — 10 passed. Scanner count on this tree = 932 (authoritative run, +3 scannable files: kernel + 2 specs); quarantine hit set unchanged at 15. |
| `build.log` | `pnpm build` (root) | rc=0. |
| `build-composition-gate.log` | `pnpm build:composition` (root) | first run rc=1 (uncommitted-dist drift listing = the gate doing its job); after staging the drifted dist paths: rc=0, OK-line `[check-artifacts-committed] OK: 1392 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))`. |
| `build-composition-gate-post-commit.log` | `pnpm build:composition` AFTER the commit | rc=0, same OK-line; work tree clean afterwards. |

Staged-diff secret scan (`git diff --cached | grep -icE 'api[_-]?key|secret|passwd|password|ghp_|AKIA|-----BEGIN'`): 0 matches.

## What the PR is (one paragraph)

`mutatePermission` is added ONTO the existing `GovernanceMutationService`
(coordinator D1 — no second authority class; legacy methods byte-unchanged,
surface pinned to exactly the 3 legacy methods + the additive 4th). The path:
authenticate authority (leader / operator via the same derived `MutationAuthority`
vocabulary) → validate the unified `PermissionMutation` (grant_instance /
update_permission / revoke_permission as ONE shape, design §3.4) and the §6
envelope (`{operationClass, matcher, maximumEffect}`, design §4 — the ONE
Alpha.3 canonical permission-change envelope; the legacy blueprint
`MutationEnvelope {allow,deny}` op-token CAPABILITY concept at
`packages/domain/blueprint/src/types.ts:37-45, 284-295` + the set-intersection
at `admission/envelope.ts:108-111` is NOT touched, not read, not renamed —
zero boundary transformations were needed) → serialize on the SAME shared
per-team chain with
the `expectedGeneration` CAS → commit ONE new FULL `PermissionOverlaySnapshot`
THROUGH the PR1 persistence-only port → provenance (actor/mutationId/
timestamp/reason; `actor` never interpreted: Human ≠ priority is structural,
authority is by generation). Exec matchers are EXACT canonical fingerprint
only (design §5). Leader expansions (deny→ask/deny→allow/ask→allow) need a
covering envelope rule with the maximum-effect ceiling; tightenings
(allow→ask/allow→deny/ask→deny) need none — both directions pinned. Zero
production wiring: the no-consumers walk leg asserts it, and the lane stays
dormant (`NOT_CONFIGURED`) until a later PR injects `permissionLane` deps.

> SUPERSEDED in part by the BOUNDED REPAIR BATCH below: the FIRST commit
> classified expansion by pair-key direction (the "absence counts as deny"
> line); the external review P1 batch proved that both mislabels (verb-based
> reveal = fail-open; pair-key baseline = fail-restrictive) and the batch
> replaced the classification with the EFFECTIVE region semantics.

# BOUNDED REPAIR BATCH (external review P1 — design v2, same branch)

Parent trigger: EXTERNAL-FOUND POTENTIAL P1 (`revoke` can reveal a lower
ALLOW behind an empty envelope) + second confirmed bug (exact pair over a
covering overlay ALLOW mislabeled as expansion). Parent GO after the
accepted design brief v2; rulings R1 ladder-strict / R2 width-conservative /
R3 unknown-context typed refusal / R4 hold-and-batch, then the parent's
CONVERGED bounded-repair requirements (no deny-masquerade, whole-matcher
containment only, closed laminar regions, complete-batch comparison).

## Raw logs (chronological)

| File | Command | Result |
| --- | --- | --- |
| `external-p1-probe-revoke-reveal.log` | witness probe (`a3p3-revoke-reveal-semantics` pre-directive form), 9 legs vs the REAL merged PR2 assembler + REAL PR1 store | rc=0 — BOTH bugs + all three reveal channels PROVEN: S1 `{"beforeAnswer":{"decision":"deny","winningLayer":"overlay"},"revokeAccepted":true,"afterAnswer":{"decision":"allow","winningLayer":"template"}}`; S3/S4 ask-reveals accepted; S6 subtree reveal; S7 remaining-overlay reveal `{"accepted":true,"afterAnswer":{"decision":"allow","winningLayer":"overlay"}}`; B1 legal tightening refused `PERMISSION_ENVELOPE_EXPANSION_DENIED`; B2 bounded sibling. THE batch RED anchor. |
| `fix-directed-red.log` | directed suite (20 legs) vs the PRE-FIX production code (fix files stashed) | rc=1 — 10 failed / 9 passed (behavioral RED, not module-absence: the witness-era acceptance of reveals is exactly what fails). |
| `fix-directed-green.log` | directed suite vs the fix | rc=0 — 20 passed (incl. S7c: unknown-facts subtree revoke = CONTEXT refusal; the (e)/(f)/all-or-nothing region legs). |
| `fix-parity.log` | `a3p3-effective-parity.test.ts` — kernel `permissionEffectiveAnswer` vs the MERGED assembler (P1-P11) | rc=0 — 11 passed (layer precedence, within-layer most-restrictive, lowest-declared fallback, declared-none deny, `any`, remaining-overlay reveal, containment parity, unknown-context as its OWN state, exec exact-identity). |
| `fix-mutation-probe-A-authz-bypass.log` | mutant: `if (false) authorizeLeaderPermissionMutation(…)` in `service.ts` | rc=1 — 13 of 20 directed legs die. Mutant KILLED. |
| `fix-mutation-probe-B-deny-masquerade.log` | mutant: unknown `staticFacts` answered as the deny fallback (the masquerade the parent banned) | rc=1 — 4 die (S4b, S7c, B2, P10). Mutant KILLED. Afterwards `grep "if (false|MUTANT"` over kernel+service+specs: 0 hits. |
| `fix-old-specs-run1.log` / `run2.log` | the existing 28 (authority+hygiene) vs the fix | run1 rc=1 (8 legs needed the DECLARED-NONE facts fixture — under design v2 their lanes must state the lower-facts state); run2 rc=0 — 28 passed. |
| `fix-all-pr3-suites-green.log` | all four PR3 suites together | rc=0 — 59 passed (20 directed + 11 parity + 20 authority + 8 hygiene). |
| `fix-typecheck-runtime-real.log` / `fix-typecheck-testkit-real.log` | `npx tsc -p tsconfig.json` (runtime / testkit) | rc=0 / rc=0, genuinely empty (the empty-log rider from the fold queue is thereby retired — both are real `cmd >log 2>&1; rc=$?` captures). |
| `fix-full-runtime-suite.log` | `npx vitest run` final | rc=1 — 8 failed / 3138 passed; failure set byte-IDENTICAL to the base baseline (`diff` → `FAILURE-SET-IDENTICAL`); +20 directed +11 parity over the pre-batch count. |
| `fix-p4t6-pin-934-green.log` | p4t6 scanner pin | rc=0 — 10 passed; count 932→934 FROM THE SCANNER (+2: the directed spec + the parity spec); quarantine hits unchanged at 15. |
| `fix-build.log` / `fix-build-composition.log` | `pnpm build` / `pnpm build:composition` (dist staged) | rc=0 / rc=0 — `[check-artifacts-committed] OK: 1392 files; … (incl. 1 glue placement(s))`; 13 drifted governance dist files staged in the same commit. |

## What the batch changed (design v2, one mechanism)

Expansion/tightening is now a property of the EFFECTIVE decision, computed by
ONE pure kernel function (`authorizeLeaderPermissionMutation`): the mutation's
closed regions are partitioned by the laminar boundary family of
`latest ∪ planned ∪ static` matchers (whole-matcher relations via the injected
`subtreeContains`/`matcherCovers` ONLY — never `containsOperation`, which is
the live resolver's POINT judgement, used only in the assembler-side specs;
`permission-coverage.ts` is NOT imported — pinned by a hygiene text leg);
per cell the merged-assembler layer semantics answer BEFORE (full latest set)
and AFTER (full planned set) — overlay > template > blueprint, within-layer
most-restrictive, lowest-declared fallback, declared-none deny; ANY rise
(deny→ask VERBATIM included) demands envelope coverage of the WHOLE mutation
matcher (width-conservative) with `maximumEffect ≥` the RISEN effective
effect, all-or-nothing over the batch, zero write on refusal. Lower facts
arrive as ONE optional injected DATA reader (`staticLayers`) bound ONCE
inside the serialized section; UNKNOWN (`undefined`) is distinct from
DECLARED-NONE (`{layers:[]}`, decidable deny fallback) and from declared
facts: outside the four provably lower-fact-independent cases (each quantified
over every fallback hypothesis: both-sides-overlay cells, deny-post cells,
allow-pre removals, neither-side cells), an unknown prior refuses typed
`PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` — never labeled expansion OR
tightening. One new typed code total; the legacy surface, CAS, provenance,
full-snapshot commit, grammar, and zero-production-wiring walk are unchanged
(root.ts byte-untouched; the reader is optional). Undecidable boundaries,
stated: residual-cell emptiness (treated NON-EMPTY — over-refuse only),
subtree relations without a predicate (typed refuse), fingerprint space
decided by exact identity only.

## Batch files

Production: `packages/runtime/governance/{permission-mutation,service,types,index}.ts`
(semantic evaluator + static-facts parser + typed code + lane reader); tests:
`a3p3-revoke-reveal-semantics.test.ts` (directed 20 — the witness file
inverted), `a3p3-effective-parity.test.ts` (11), authority-spec fixture
(DECLARED-NONE facts + one renamed leg), hygiene-spec additions
(permission-coverage ban + typed-code pin); `a3p3-governance-lane-hygiene`
walks unchanged and green; p4t6 pin 932→934; 13 rebuilt governance dist files;
fold riders applied (kernel header cites → verified `types.ts:37-45,284-295` +
`envelope.ts:108-111`; typecheck logs real-captured).

## Files

Production (all in `packages/runtime/governance/`): `permission-mutation.ts` (new kernel),
`service.ts` / `types.ts` / `index.ts` (additive). Tests: `packages/runtime/test/a3p3-permission-mutation-authority.test.ts` (20), `packages/runtime/test/a3p3-governance-lane-hygiene.test.ts` (8, incl. init-cycle canary, zero-consumer walk, persistence-only consumer pin, legacy-surface pin). Pin edit: `packages/testkit/test/p4t6-session-event-scan.test.ts` (929→932). Rebuilt dist shipped in the same commit (governance dist files + new `governance/permission-mutation.*` and newly-emitted `permission-governance/port.*` artifacts).
