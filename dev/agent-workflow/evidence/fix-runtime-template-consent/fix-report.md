# fix-runtime-template-consent — findings I + J fix report (2026-10-01, updated for the I-residual round)

Branch: `fix/runtime-template-consent` (worktree `.worktrees/fix-runtime-template-consent`)
Base (pristine, recorded): `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (= master)
Commits (separable):
- `8569ff96` — finding I (disabled-set derivation) + its real-chain regression test + p4t6 pin 896→897
- `60b6b16a` — finding J (consent scope/hash keying) + its real-chain regression test + p4t6 pin 897→898
- `4a066408` — bookkeeping (evidence + this report + SESSION_ROUTER_LOG entry)
- `26994b97` (full: `26994b97923ded367b5d74eb20ebdc91f4010dd0`) — **I residual** (the leader-scope fix
  + real-chain regression legs + reviewer r1/r2 addenda S1/S2/S3/r2-minor pins) + p4t6 pin 898→899
  + rebuilt dist
- (this report update) — bookkeeping round 2 (raw gate logs + this report update + log entry)

Push status (corrected per reviewer r2): push = the user-authorized one-time DRAFT
publication (05:53:01Z, PR #48, at `4a066408`) + the forthcoming new-HEAD push under
the same authorization; no force-push; master never pushed.

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
soundness). Log: `red-ij.log` (EXIT=1; committed below).

## Finding I residual (P2, external review 2026-10-01) — the LEADER scope at the initial-work boundary

**Root cause**: `leaderTemplateScopeRefs` (packages/runtime/action-router/
root-initial-work.ts L183–193) added the LEADER template scope to the Root
initial-work gate's scope refs ONLY WHEN `leader.requirements` was non-empty
(and the document was v2). A requirement-free leader produced NO scope ref at
all — and the finding-I availability fix derives the disabled set from
`impact.scopeRefs` ∩ the durable `available:false` INDEPENDENT of the verdicts
(a requirement-free template produces no verdict row) — so an accepted durable
LEADER disable was invisible to the gate: `team.admitInitialWork` returned
allowed and the initial model/work was admitted into a disabled leader. The
existing finding-I suite pinned only the WORKER delegate path.

**Fix (consistent scope-set construction, audited at every construction site)**:
- `leaderTemplateScopeRefs` now returns `[teamScope(), templateScope(leader.
  templateId)]` UNCONDITIONALLY (v1 + v2): a scope exists because the template
  exists in the blueprint, not because it has requirements (target-design §10
  matrix: "Leader normal model turn | Team + Leader template"; the production
  writer `setTemplateAvailabilityFact` validates the leader as a disable target
  for BOTH versions, so a disabled v1 leader must block too). When the leader
  is NOT disabled the added ref changes nothing observable (no verdict row →
  not blocked; the availability fold is empty).
- Audit of the other construction sites: the router's `actionImpactOf` /
  `newWorkTargetTemplateId` already key the follow-up impact on the addressed
  template id, unconditional of the requirement set (correct — unchanged);
  `scopeRequirementInputsOf` extracts the per-scope REQUIREMENT INPUTS (verdict
  rows) and intentionally skips empty template scopes (audit note now documented
  in code — it is NOT the availability scope-ref set; the availability decision
  reads no verdicts).
- No behavior change on the enabled path (the W3-C leader-boundary suites stay
  byte-green).

**New real-wiring regression legs** (`packages/runtime/test/leader-disable-no-
requirements-initial-work.test.ts`, 5 tests — the production closure
`createAdmitRootInitialWork` + the production router + the production durable
writer `setTemplateAvailabilityFact`; only the model-visible delivery port is a
fake that records the exact submission):
- **premise**: the leader declares NO requirements (its scope is absent from
  the verdict-input extraction — the exact empty case).
- **IL1 (RED pre-fix)**: a disabled requirement-free leader BLOCKS
  `admitInitialWork` — typed `COMPATIBILITY_BLOCKED`, `gateReason:
  'templateDisabled'`, `blockedScopes: ['template:leader']`, ZERO delivery
  calls, ZERO Root work facts (the gate runs before the Phase A admission).
- **IL2 (green pre-fix — the subsequent boundary was already correct)**: the
  follow-up to the leader instance through the production router is blocked the
  same way; zero work facts for that token.
- **IL3 (green pre-fix — the control/recovery lanes)**: with the leader
  disabled, `list-members` executes, `report-progress` executes, and the
  gate-level `controlImpact` stays `alwaysAllowed` / `recoveryWorkImpact`
  `allowed` on the leader scope — the gate blocks WORK (model/work), not
  control (target-design §10: control = "none / keep available").
- **IL4 (RED pre-fix)**: re-enable RESUMES the initial work through the same
  production chain (fresh admission + delivery + terminal fact).

**RED (at HEAD `4a066408`, pre-fix)**: IL1 + IL4 fail (the gate allowed the
initial work — the bug itself); premise + IL2 + IL3 pass; EXIT=1. Log:
`red-leader.log`. The first capture `red-leader-attempt1.log` is committed too
(transparent): its only extra failure was a TEST assertion bug in the first IL3
form (`.allowed` vs `.reason` on `RequirementGateOutcome`) — fixed in the test
before the final RED capture; the product behavior at HEAD on the IL3 lane was
correct throughout.

**GREEN (post-fix)**: all 5 legs + the W3-C boundary/exit suites + the finding-I
suite green (`green-leader-focused.log` EXIT=0); the wider focused-area set is
`green-focused.log`.

**Reviewer addenda (r1/r2) — ADDITIONS to existing test files only (no
weakening)**:
- **S1 (required)**: the fail-closed LEGACY-ROW branch is now pinned on the
  REAL production chain (new J3 arc in `consent-scope-hash-binding.test.ts`): a
  legacy 4-field consent row (no scopeKey/contentHash) seeded via the
  PRODUCTION payload builder + the PRE-TEAM durable writer (`putPreTeam`, the
  production root's own selection); the keyed PRODUCTION re-drive STILL stays
  `consentRequired` with zero durable effect (the unkeyed row is NEVER treated
  as consented); the production re-grant then mints a KEYED row (scope derived
  — unmet in exactly one scope: the team — + the bound contentHash) and the
  re-drive proceeds (the migration path end-to-end). The optional legacy-face
  pair is pinned at the pure `startupPreflight` level: the SAME row IS honored
  when the hash is unmodeled (the pre-J unit face, byte-identical
  requirementId-only match).
- **S2 (required)**: the `DUPLICATE_REQUIREMENT_SCOPE` typed refusal pinned
  (closed code literal `REQUIREMENT_DUPLICATE_SCOPE`, verified in
  requirements/errors.ts): a grant WITHOUT an explicit scopeKey while the
  requirement is unmet in two scopes (the J1 world) → the typed refusal with
  the ambiguous scope set in the details, zero durable rows.
- **S3 (optional → done)**: the finding-I suite gains the follow-up leg — the
  same durable disable blocks `actionImpactOf('follow-up', worker)` (the same
  normalWork class with the identical scopeRefs).
- **r2-minor (optional → done)**: an EXPLICIT scopeKey naming a scope that does
  NOT declare the requirement → the typed `CONSENT_TARGET_SATISFIED` refusal
  (`requirement-not-unmet-in-scope`, zero writes).

**Files changed (this round's product commit)**: action-router/
root-initial-work.ts (the fix + doc), requirements/scope-requirements.ts (audit
note only — no behavior change), test/leader-disable-no-requirements-initial-
work.test.ts (NEW), test/template-disable-no-requirements-gate.test.ts (+S3),
test/consent-scope-hash-binding.test.ts (+S1/S2/r2-minor), testkit p4t6 pin
898→899, + 8 rebuilt dist artifacts (exactly the two changed source faces × 4).

## Compatibility disclosure — finding J (PROMINENT; migration behavior)

**Legacy 4-field consent rows still PARSE** (backward-compatible:
omit-when-absent, byte-identical round-trip — the existing round-trip test is
untouched and green), **but under the keyed PRODUCTION path an unkeyed legacy
row is NEVER treated as consented.** The production creation preflight ALWAYS
models the bound blueprint's content hash, so the real path is always the keyed
one: an unkeyed legacy row matches ONLY in a legacy (hash-unmodeled) evaluation
— the pre-J unit face, retained for the unit tests. Affected teams with pre-fix
consent rows must **RE-CONSENT through the human flow**
(`requirementAuthority.grantDegradationConsent` — one call; the scope is
derived or explicit; the row is stamped `scopeKey` + `contentHash`). This is
the disclosed migration behavior: **fail-closed, no silent auto-consent** —
pre-fix consent rows stop covering at the next keyed evaluation (pinned by the
J3 arc above). No new Remote/UI APIs; the frozen remote contract is untouched
(the service-input `scopeKey` is a root-level surface only).

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

### New round (I residual + reviewer addenda) gates — all logs committed below

- **Baseline re-verification** (worktree detached @ pristine `31ad828d`
  reusing the fix worktree's node_modules — the throwaway-worktree `pnpm
  install` failed on the store DB, `baseline-install.log`; provenance in the
  `baseline-full.log` header): **10 failed files / 21 failed tests | 397 passed
  (407) files, 4698 passed (4719) tests, EXIT=1** — exactly the recorded debt
  set (`p6t1-parallel` flake family fired 2 in this run).
- **RED (new leader legs at HEAD `4a066408`, pre-fix)**: IL1 + IL4 fail,
  premise + IL2 + IL3 pass, EXIT=1 (`red-leader.log`; the attempt-1 capture
  kept for transparency).
- **Focused areas (18 files** — leader legs + finding-I suite + W3-C
  boundary/exit + every consent/preflight/facts/authority/startup suite +
  tcm-m3 + f3b lock-scope + p8s7r1 wire + p4t6): **18 files / 197 tests GREEN**
  (`green-focused.log`, EXIT=0).
- **Full `pnpm vitest run` (new head)**: **Test Files 9 failed | 401 passed
  (410); Tests 19 failed | 4730 passed (4749), EXIT=1** — failed-file set =
  the recorded debt set; **setdiff vs the pristine-base run: EMPTY** (the only
  delta is `p6t1-parallel`, the recorded flake family, 0 this run vs 2 at the
  base — inside the recorded 0–2 envelope). `full-setdiff.md` + the two raw
  logs + both failed-file sets.
- **`pnpm run lint`**: EXIT=1 (the pre-existing 143 problems = 118 errors |
  25 warnings — IDENTICAL counts); file-aware fingerprint diff vs the committed
  baseline: **ZERO new entries, ZERO deletions** (`lint-fp-newhead-{plain,
  fileaware}.txt`, `lint-newhead.log`).
- **`pnpm run typecheck`**: **EXIT=0** (`typecheck-newhead.log`) — after a
  one-pass fix of two TS2339 union-narrowing errors in the NEW S2/r2
  assertions (discriminant narrowing; no semantic change).
- **`pnpm build` (9/9) + `pnpm run build:composition` + `pnpm run
  check:artifacts`: EXIT=0 (OK 1372 files)** after staging the rebuilt dist in
  the product commit — the drift was exactly the two changed source faces × 4
  artifacts (8 files, `check-artifacts-newhead.log`); glue placement 1,
  byte-identical.
- **p4t6 pin 898 → 899** (+1 scannable `.ts`: the new leader test file — the
  in-pin justification is in the coverage test title; scanner `.mjs`
  byte-identical) — GREEN.

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
| template-disable-no-requirements-gate | 2 (RED I) | — | my fix I GREEN (+ the S3 follow-up leg this round — green) |
| p4t6-session-event-scan | 1 (pin drift) | — | pin updated 896→897→898→899 per commit, GREEN |
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
- Push (CORRECTED per reviewer r2 — the earlier "no push" line was inaccurate):
  push = the user-authorized one-time DRAFT publication (05:53:01Z, PR #48, at
  `4a066408`) + the forthcoming new-HEAD push under the same authorization;
  NO force-push; master NEVER pushed; no merge.
- No :3080 / :3180 / ~/.dsh / host instances (zero instances started; all tests are
  in-repo vitest worlds).
- No model/config changes; no new error codes (J reuses the reserved closed
  `DUPLICATE_REQUIREMENT_SCOPE`; the residual round added none); no new scannable
  files beyond the 3 new test files (pin updated per sanctioned precedent
  896→897→898→899 with recorded justification in the coverage test title, per
  commit).
- No weakening/deletion of existing tests: the only existing-test edits are (a) the
  disclosed closed-field pin (4→6 additive) in requirement-facts.test.ts (+ its new
  keyed round-trip test) — the contract change itself, not a relaxation — and (b)
  the reviewer addenda S1/S2/S3/r2-minor this round — ALL ADDITIONS to existing
  test files (no assertion deleted or relaxed).
- J scope NOT expanded: disclosure only — no new Remote/UI APIs; the frozen remote
  contract untouched; the `scopeKey` service input is a root-level surface only.
- `dev/agent-workflow/graph.yaml` untouched (this entry appends to the log only).

## Evidence index (all committed in this directory; raw logs scrubbed — token-free)

### RED captures
- `red-ij.log` — prior round: findings I + J RED at the pre-fix base (EXIT=1).
- `red-leader.log` — this round: NEW leader legs at HEAD `4a066408` pre-fix —
  IL1 + IL4 fail (EXIT=1); premise + IL2 + IL3 pass (final test form).
- `red-leader-attempt1.log` — this round: first leader RED capture (kept for
  transparency; its extra IL3 failure was a test assertion bug fixed before the
  final capture — product behavior at HEAD on that lane was correct).

### GREEN captures
- `green-i-focused.log`, `green-j-focused.log` — prior round focused (EXIT=0).
- `green-leader-focused.log` — this round: leader legs + W3-C boundary/exit +
  finding-I suite + disable-enable (5 files / 25 tests, EXIT=0, post-fix).
- `green-j-additions.log` — this round: consent J suite (S1/S2/r2) + p4t6 +
  finding-I + leader legs (4 files / 39 tests, EXIT=0).
- `green-focused.log` — this round: full focused-area set (18 files / 197
  tests, EXIT=0).
- `green-i-full.log`, `green-j-full.log` — prior round full runs.

### Full-suite (raw + failed-file sets + setdiff)
- `baseline-full.log` — pristine base `31ad828d` re-verified this round
  (10F files / 21F tests; provenance header inside), `baseline-failed-files.txt`.
- `baseline-full-prefix.log`, `baseline-focused.log` — prior round baseline runs.
- `full-newhead.log` — new head (9F files / 19F tests; 4730/4749 pass),
  `full-newhead-failed-files.txt`.
- `full-setdiff.md` — the setdiff table + method (EMPTY beyond the recorded
  debt set; the p6t1-parallel flake family inside its recorded 0–2 envelope).
- `baseline-install.log` — the failed throwaway-worktree `pnpm install` (store
  DB) that motivated the detached-baseline method.
- `p6t1-rerun-{1,2,3}.log` — prior round isolated flake re-runs (all EXIT=0).

### Lint (raw + fingerprints, both formats)
- `baseline-lint.log` (prior baseline, EXIT=1, 118E|25W),
  `green-i-lint.log`, `green-j-lint-final.log` (prior final state).
- `lint-newhead.log` — this round (EXIT=1, 143 problems = 118E|25W identical).
- Fingerprints (143 lines each): `lint-fp-baseline-{plain,fileaware}.txt`
  (committed prior round — the gate baseline), `lint-fp-final-{plain,
  fileaware}.txt` (prior round final), `lint-fp-newhead-{plain,fileaware}.txt`
  (this round). File-aware diff baseline→newhead: **ZERO new entries, ZERO
  deletions**.

### Build / artifacts / typecheck
- `build-i.log`, `build-j.log`, `check-artifacts-i.log`, `check-artifacts-j.log`
  (prior rounds; check:artifacts EXIT=0 each).
- `build-newhead.log` (9/9, EXIT=0), `build-composition-newhead.log`,
  `check-artifacts-newhead.log` — this round (EXIT=0, OK 1372 files, after
  staging the rebuilt dist in the product commit).
- `typecheck-newhead.log` — this round (EXIT=0).
