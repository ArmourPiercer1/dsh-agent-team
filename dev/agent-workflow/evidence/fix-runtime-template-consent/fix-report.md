# fix-runtime-template-consent — findings I + J fix report (2026-10-01)

Branch: `fix/runtime-template-consent` (worktree `.worktrees/fix-runtime-template-consent`)
Base (pristine, recorded): `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (= master)
Commits (2, separable; no push):
- `8569ff96` — finding I (disabled-set derivation) + its real-chain regression test + p4t6 pin 896→897
- `60b6b16a` — finding J (consent scope/hash keying) + its real-chain regression test + p4t6 pin 897→898

## Finding I (P2) — disabled template with empty requirements

**Defect**: `gateAction` (packages/runtime/requirements/evaluator.ts) derived the
disabled set from the VERDICT refs of the scopes the action depends on. A template
that declares NO requirements produces no verdict row at all (scope-requirements.ts
L103–112 skips empty template scopes), so a disabled requirement-free template was
invisible to the disabled set and its normal work (delegate / follow-up) was
admitted despite the durable `template-availability-set` fact `available:false`.

**Fix**: the disabled set is derived DIRECTLY from the action's scope dependencies
(`impact.scopeRefs`) + the durable `input.availability` (`available === false`),
independent of the verdicts. The block keys on the policy state alone (re-enable
resumes through the same checks); `blockedRefs` stays verdict-derived. No behavior
change when availability is unset or the disabled template has verdicts
(template-disable-enable.test.ts mask stays byte-green).

**Regression test (real chain)**: `packages/runtime/test/template-disable-no-requirements-gate.test.ts`
(4 tests): P6T2 world, v2 blueprint whose worker template has NO requirements
(team scope carries the only passing requirement); the production writer
`requirementAuthority.setTemplateAvailability(available:false)` (the durable fact)
then blocks the delegate to the worker through the LIVE gate
(`enforceRequirementGate` + `actionImpactOf`): `COMPATIBILITY_BLOCKED`,
`details.gateReason === 'templateDisabled'`, `details.blockedScopes === ['template:worker']`;
re-enable resumes the delegate; premise pins that the worker produces NO
requirement inputs (the empty case).

**RED (pre-fix)**: 2/4 fail (the block + re-enable legs — gate allowed the
delegate; `expected true to be false`), premise + enabled control pass (world
soundness). Log: `.worktrees/.scratch-logs/template-consent/red-ij.log` (EXIT=1).

## Finding J (P2) — startup consent loses scope / hash

**Defect**: the consent match keyed on requirementId ALONE — `startupPreflight`
flattened the per-scope verdicts and matched `consent.requirementId` against the
flat warning set; the production writer `grantDegradationConsent` flattened the
per-scope verdicts before validation; the durable fact carried no scope/hash.
The pre-alpha3 ADR (ADR-12, L224–231) is explicit: the consent key is the
IMMUTABLE Blueprint scope/hash — the consent binds to the EXACT scope +
blueprint content hash it was granted for.

**Consequences pinned (both via the REAL production chain — host entry →
server-side `runCreationPreflight`/`startupPreflight` → the production consent
writer `requirementAuthority.grantDegradationConsent` → re-driven create — no
handcrafted facts)**:

- **J1 CROSS-SCOPE**: the same optional requirementId declared in the TEAM scope
  (`mcpServer: opt-a`) and the WORKER template scope (`mcpServer: opt-b`) — legal
  (v2 validator: uniqueness within a list only). A consent granted for the team
  scope must NOT cover the worker's same-id warning: re-drive #1 stays
  `consentRequired` until the worker scope is consented separately.
- **J2 STALE BLUEPRINT (same root, pre-team window)**: rev1 create refused
  `consentRequired`; consent granted (stamped with rev1's contentHash); the
  blueprint source changes to rev2 on the SAME root before the team record is
  minted (same requirement ids, different content hash); the rev2 re-drive must
  NOT inherit the rev1 consent — stays `consentRequired`; re-consenting against
  rev2 admits.

**RED (pre-fix)**: 5/10 fail (cross-scope re-drive proceeded; scoped rows missing
`scopeKey`/`contentHash`; stale rev2 re-drive proceeded; row stamps absent).
Log: `red-ij.log` (EXIT=1).

## J — consent store schema decision (disclosed)

**Additive fields, fail-closed legacy rows.**

- `optional-requirement-accepted` payload gains two ADDITIVE closed fields
  `scopeKey` + `contentHash` (closed set 4→6; the pinned closed-field test in
  `requirement-facts.test.ts` updated accordingly — disclosed). Omit-when-absent:
  legacy 4-field rows remain LEGAL and round-trip byte-identical (existing
  round-trip test untouched, stays green).
- **Fail-closed semantics**: `startupPreflight` now takes the bound blueprint's
  `contentHash` (`EvaluationInput.blueprintContentHash`; the production creation
  preflight ALWAYS passes it — the bound snapshot is always resolved). A consent
  covers a warning only if `requirementId` AND `scopeKey` AND `contentHash` all
  match. A LEGACY (unkeyed) row is honored ONLY by a LEGACY (hash-unmodeled)
  evaluation — the pre-J unit face, where the match is byte-identical
  requirementId-only (keeps every existing unit test green, incl. authority
  negative #7). A KEYED evaluation FAILS CLOSED on a legacy row: it is never
  treated as consented — the human re-grants (migration behavior: pre-fix consent
  rows stop covering at the next keyed evaluation; re-grant is one call).
- Writer: `ConsentGrantOptions.scopeKey?` (explicit scope → validated against
  that scope's verdicts; absent → DERIVED: the requirement must be unmet in
  exactly ONE scope; unmet in several = the EXISTING closed
  `DUPLICATE_REQUIREMENT_SCOPE` typed refusal — no new error code). Every written
  fact is stamped `scopeKey` + `blueprint.contentHash`.
- `requirementAuthority.grantDegradationConsent` service input gains optional
  `scopeKey` (root-level surface only; the frozen remote contract v1–v6 gains NO
  method). `readRequirementFacts` carries the key fields into the consent read.
- `consent.ts` (validateConsent/isConsented/relevantConsents — ID-only,
  test-only consumers) left UNCHANGED (minimal diff).

**Files changed (commit J)**: requirements/{types,facts,evaluator,
startup-preflight,creation-preflight}.ts, admission/requirement-gate.ts,
src/plugin/{types,root}.ts, test/{requirement-facts,
consent-scope-hash-binding}.test.ts, testkit p4t6 pin, + 26 rebuilt dist artifacts.

**Files changed (commit I)**: requirements/evaluator.ts,
test/template-disable-no-requirements-gate.test.ts, testkit p4t6 pin, + 3
rebuilt dist artifacts.

## Gates (all from this worktree; exit-code discipline `EXIT=` in logs)

### Baseline (worktree pristine @ `31ad828d`, AFTER the test-use marker existed;
the run already included the uncommitted RED-I test + p4t6 pin drift 897-vs-896)

- `pnpm vitest run`: **Test Files 13 failed | 395 passed (408); Tests 37 failed | 4686 passed (4723)**
- failed-file set (13): t1-capability-schema (9, historical) / t2-blueprint-hash (1, historical) /
  a2c7-subtree-matcher (9, **environmental** — test-use restore incomplete) / d3-member-identity-context
  (1, historical) / p6t3-mediation (5, historical) / p6t3-restart (2, historical) /
  template-disable-no-requirements-gate (2, my RED I) / p4t6-session-event-scan (1, pin) /
  plugin-dsh-compat (6, **environmental**) / p6t6-actions (1, historical) / p8s3b-result-effects
  (collection, historical) / t12a-b2-child-identity (collection, historical) / t12a-glue-handoff-ports
  (collection, historical)
- `pnpm run lint`: EXIT=1, **118 errors | 25 warnings** (pre-existing debt — NOT fixed),
  plain fingerprint 143 lines, file-aware fingerprint 143 lines

### Commit I gate (`8569ff96`)

- focused (I test + template-disable-enable + authority-negatives + p4t6@897): **4 files / 32 tests GREEN**
- full: **Test Files 10 failed | 398 passed (408); Tests 20 failed | 4703 passed (4723)**
- failed set (10): the six historical debt files (counts identical to baseline) + 3 collection
  (historical) + p6t1-parallel (1F — P2 flake, see below)
- `pnpm run check:artifacts`: **EXIT=0** (OK 1372 files)
- `pnpm run lint`: 118E|25W; plain + file-aware fingerprint diff vs baseline = **ZERO**
- `npx eslint` on every touched file: clean (exit 0)

### Commit J gate (`60b6b16a`)

- focused (16 files: both new regression tests + every consent/preflight/facts/authority suite):
  **16 files / 168 tests GREEN**
- full: **Test Files 10 failed | 399 passed (409); Tests 21 failed | 4713 passed (4734)**
  (4734 = 4723 + 10 new J tests + 1 new requirement-facts keyed round-trip)
- failed set (10): IDENTICAL to commit-I set (historical 6 + collection 3 + p6t1-parallel
  2F — P1-pair flake, see below)
- `pnpm run check:artifacts`: **EXIT=0** (OK 1372 files)
- `pnpm run lint`: 118E|25W; **file-aware fingerprint diff vs baseline = ZERO entries**
  (plain: identical 143 lines). Per-file eslint on all 12 touched files: the only findings are
  5 pre-existing unused-import errors that exist in the BASELINE fingerprint at identical
  lines (requirement-gate.ts 62:3 + requirement-facts.test.ts 20/22/27/31:3) — NOT introduced.
- `pnpm build` (9/9) + `pnpm build:composition` run per commit; rebuilt
  `packages/runtime/dist` artifacts committed in each fix commit (install-surface drift = exactly
  the changed source faces; glue placement 1, byte-identical).

### SET DIFF (final failed set vs baseline failed set)

| file | baseline | final | classification |
|---|---|---|---|
| t1-capability-schema | 9 | 9 | historical debt (unchanged) |
| t2-blueprint-hash | 1 | 1 | historical debt (unchanged) |
| d3-member-identity-context | 1 | 1 | historical debt (unchanged) |
| p6t3-mediation | 5 | 5 | historical debt (unchanged) |
| p6t3-restart | 2 | 2 | historical debt (unchanged) |
| p6t6-actions | 1 | 1 | historical debt (unchanged) |
| p8s3b-result-effects | collection | collection | historical debt (unchanged, NOT touched per protocol) |
| t12a-b2-child-identity | collection | collection | historical debt (unchanged, NOT touched per protocol) |
| t12a-glue-handoff-ports | collection | collection | historical debt (unchanged, NOT touched per protocol) |
| a2c7-subtree-matcher | 9 | — | **environmental, CLEARED** (test-use restore completed mid-work — allowed debt-fix, listed) |
| plugin-dsh-compat | 6 | — | **environmental, CLEARED** (same — allowed debt-fix, listed) |
| template-disable-no-requirements-gate | 2 (RED I) | — | my fix I GREEN |
| p4t6-session-event-scan | 1 (pin drift) | — | pin updated 896→897→898 per commit, GREEN |
| p6t1-parallel | — | 1–2 (flake) | **known P1/P2/P3 flake family** — same family = record. GREEN-I run: P2 ("five activated
  results…", errors.length 3 of 5); GREEN-J run: P1 pair (2 tests). Isolated re-runs ×3: **9/9 GREEN
  all 3**. NOT a new signature (my I change only acts when availability says `available:false`;
  p6t1 worlds set no availability → `disabledRefs` empty before and after). |

**NEW failures beyond baseline debt: NONE (list is empty).**

### Lint fingerprints (committed alongside this report)

- `lint-fp-baseline-plain.txt` / `lint-fp-baseline-fileaware.txt` (143 lines each)
- `lint-fp-final-plain.txt` / `lint-fp-final-fileaware.txt` (143 lines each)
- file-aware diff baseline→final: **ZERO new entries, ZERO deletions**
- one mid-run incident (self-disclosed): the first J-state lint showed 5 new entries — all
  `no-explicit-any` in my NEW test file (mis-positioned `eslint-disable-next-line` directives,
  a copy artifact from the reference test which itself carries the same pattern in baseline
  debt). Fixed by re-positioning the 7 directives; final lint = zero diff.

## Red-line compliance

- CORE PATCH BUDGET = 0: zero upstream / test-use touches (test-use pristine @
  `46a7f68b09` — only READ by the suites that consume it).
- No push / merge / force-push (branch local, 2 commits + this booking commit).
- No :3080 / :3180 / ~/.dsh / host instances (zero instances started; all tests are
  in-repo vitest worlds).
- No model/config changes; no new error codes (J reuses the reserved closed
  `DUPLICATE_REQUIREMENT_SCOPE`); no new scannable files beyond the 2 new test files
  (pin updated per sanctioned precedent with recorded justification in the coverage
  test title, per commit).
- No weakening/deletion of existing tests: the only existing-test edits are the
  disclosed closed-field pin (4→6 additive) in requirement-facts.test.ts (+ its new
  keyed round-trip test) — both are the contract change itself, not a relaxation.
- `dev/agent-workflow/graph.yaml` untouched (this entry appends to the log only).

## Log paths (scratch, absolute)

`.worktrees/.scratch-logs/template-consent/`:
`baseline-focused.log` (19F/173T green EXIT=0), `baseline-full-prefix.log` (full baseline),
`baseline-lint.log` (EXIT=1) + `lint-fp-baseline{,-fileaware}.txt`, `red-ij.log` (RED I+J, EXIT=1),
`green-i-focused.log` (EXIT=0), `build-i.log`, `check-artifacts-i.log` (EXIT=0),
`green-i-full.log`, `green-i-lint.log` + `lint-fp-i-{plain,fileaware}.txt`,
`p6t1-rerun-{1,2,3}.log` (all EXIT=0), `green-j-focused.log` (EXIT=0), `build-j.log`,
`check-artifacts-j.log` (EXIT=0), `green-j-full.log`, `green-j-lint-final.log` +
`lint-fp-final-{plain,fileaware}.txt`.
