# Finding A (P1) — persona KIND subject vs presetId mismatch: fix report

**Branch**: `fix/persona-kind-preflight` (worktree `.worktrees/fix-persona-kind`)
**Base**: `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (= master; recorded in `baseline-head.txt`)
**Commits** (no push, per mission):

| SHA | Subject |
| --- | --- |
| `3418b358` | test(finding A): persona KIND subject regression suite over the REAL production provider → preflight chain (RED at base) |
| `69b40c2c` | fix(finding A): resolve persona KIND subjects against the observed kind of the scope's role in the requirement-facts provider |

## 1. The defect (verified against base 31ad828d, no counter-evidence)

- `packages/runtime/requirement-facts/provider.ts` (base L295–332): the `persona` case
  selected a plan entry ONLY when `subject === plan.root.presetId` or
  `subject === plan.member.presetId`; otherwise verdict `unknown` (reason: "not the
  observed root/member preset of this plan"). Base L428–431: an `unknown` live verdict
  falls back ONLY to a bootstrap seed of the same (domain, subject) key; without a seed
  the fact is omitted.
- `packages/domain/compatibility/src/engine.ts` L103–108: missing fact ⇒
  `available: false` ⇒ FATAL for a required requirement.
- The v2 SUBJECT CONVENTION (restored specs: plan §E.3 / ADR-24 / target-system-design
  §3.5/§16 / SKILL.md §4.1): persona requirement subjects are persona KINDs, not preset
  ids; the closed `RequiredPersonaKind = { standard }` in
  `packages/domain/compatibility/src/requirement.ts` L100–133 is the single source of
  truth (enforced at parse time by the v2 blueprint validator,
  `packages/domain/blueprint/src/validate.ts` L499–516; the convention is documented in
  `packages/runtime/requirements/observed-persona.ts` L34–41).
- Consequence: a v2 blueprint with persona teamRequirement subjects `['standard']` while
  the mounted root preset is e.g. `ptc/team-small-ctb` (composable standard persona;
  the live substrate observer reports `standard`) yields `unknown` ⇒ no
  `(persona, 'standard')` fact without a seed ⇒ spurious structural FATAL at creation —
  while the s6 probe (`mergeProbeEnvironmentFacts`, s6-remote.ts L1423) merges the
  CALLER's persona facts and can PASS: the probe/create split the review flagged.
- Role semantics (already specified): `substrate-resolver.ts` (plan §C.2, review fix
  F5 + R8) — the plan carries `root` (presetId + observed persona) and `member`
  (presetId + observed persona); "the member requirement uses the member's actual
  observation, not the root's".

## 2. The fix (minimal, spec-conformant)

`packages/runtime/requirement-facts/provider.ts` — the `persona` case (the ONLY
product change; +25/−4 lines incl. comments):

1. If the subject IS a closed required persona kind (via
   `isRequiredPersonaKind` from the domain compatibility layer — single source of
   truth): the world fact is the OBSERVED KIND of the role the SCOPE addresses —
   team scope ⇒ `plan.root.persona`, template scope ⇒ `plan.member.persona` (R8) —
   mapped through the EXISTING `personaReadiness` (standard → reachable,
   complete/absent → unreachable, unresolved → unknown with the typed reason). The
   emitted fact key stays `(persona, <kind subject>)`.
2. If the subject is NOT a kind (the frozen v1 preset-ID convention): the LEGACY path
   is kept byte-for-byte (`subject === plan.root.presetId` → root entry;
   `subject === plan.member.presetId` → member entry; else the typed unknown
   mismatch). The v1 frozen Blueprint cold resume is unchanged.
3. The probe path (s6-remote merge) was NOT touched (documented safe direction, out
   of scope). Create/gate/firstwork all consume the same provider → consistent
   automatically.

The module doc comment for the persona lane documents the dual convention.

## 3. Regression tests (real production chain — no handcrafted persona facts)

New suite `packages/runtime/test/persona-kind-provider-preflight.test.ts` (11 tests).
Chain driven (the same seam set the production host binds):
`parseBlueprint` (real v2 source) → `resolveRuntimeSubstrate` (the REAL resolver over
the production observer-seam double `observePersonaKind(presetId)` — the one injected
port) → `createRuntimeRequirementFactsProvider` (the REAL provider over the REAL
`createCapabilityReadinessProvider` with the production structural fact: only an
mcpServer probe port is registered, so the persona observation is `probeable:false`
and keeps the legacy seed-satisfied 2-state) → `runCreationPreflight` /
`evaluateCreationScopes` (driven with the SAME port shape `root.ts`'s
`enforceCreationPreflight` wires — root.ts L1319–1356: the per-scope facts thunks +
the full-resolution read ports, pre-bind default consents/availability).

| Scenario | Assertion (post-fix) | Pre-fix state at 31ad828d |
| --- | --- | --- |
| T1 | root `ptc/team-small-ctb` (std) + DIFFERENT member id (std), team req `['standard']`, NO seed → preflight **proceed**, team scope `ready`, fact `(persona, standard, available:true, gen:1)`, observation `reachable` | **RED**: observation `unknown` ("not the observed root/member preset"), fact omitted, preflight **fatal**, verdict `fatal` |
| T2 | root std / member `complete` (R8): team scope **PASS** on the ROOT observation (proceed-leg); worker member-template scope **FATAL** on the MEMBER observation (typed reason names the MEMBER preset, `fixOrDisable` with `template:worker` blocked) | **RED**: the team scope also FATALed (kind subject unknown) |
| T3 | root `complete` → team scope **FATAL** (structural §13.5 conflict; observation `unreachable` with the typed "complete effective persona" reason; NOT reclassified pending — a confirmed down stands) | RED-leg: FATAL too, but via the unknown/omitted-fact lane with the wrong diagnosis (now the typed conflict observation) |
| T4a | typed observer failure → `unresolved` → `unknown` → no seed ⇒ fact omitted ⇒ preflight **fatal** (fail-closed; asserted NOT `pending` — persona is non-probeable) | RED-leg: same outcome, unknown reason was the preset-id mismatch (now the typed unresolved reason) |
| T4b | same world WITH seed `(persona, standard, available:true, gen:5)` ⇒ the seed's truth decides ⇒ **proceed** (marked bootstrap fact) | GREEN pre-fix (the 2-state leg is convention-independent) — pinned as a guard |
| T4c | same world WITH seed `available:false` ⇒ **fatal** (the 2-state is not a blanket OPEN) | GREEN pre-fix — pinned as a guard |
| T5a | NON-kind subjects keep the legacy root/member preset-id matching byte-for-byte (root `ptc` → reachable; template-scope member `minimal` → unreachable; `other-preset` → typed unknown "not the observed root/member preset", feed empty) — through the REAL resolver | GREEN pre-fix — the frozen v1 semantics |
| T5b | a KIND subject resolves through the KIND path even when the mounted id is a bespoke one (preset `team-small-ctx` observing `standard` → proceed) | **RED**: `unknown` → fatal |
| T6 | end-to-end through the creation preflight (root.ts port shape: `substratePlan` = the real resolver over the observer double, `seedFacts` = the row `config.environmentFacts`): v2 blueprint + mounted composable preset ⇒ **proceed with NO seed** (one shared id probes once — the plan entries carry the identical frozen observation; the mixed bespoke-id world passes too); the SAME chain with a complete preset ⇒ **fatal** end-to-end (no false OPEN) | **RED**: fatal without a seed |

The existing frozen v1 preset-id suite (`runtime-requirement-facts-provider.test.ts`
L287–353, subjects `'ptc'`/`'minimal'`/`'mystery'`/`'other-preset'`) was **NOT
edited** and passes unchanged (part of the focused provider area, 112/112).

## 4. Verification

### 4.1 RED capture (pre-fix, base tree + new suite only)

`pnpm vitest run packages/runtime/test/persona-kind-provider-preflight.test.ts`
→ `t1-t6-red.log`: **7 failed | 4 passed (11), EXIT=1** (true exit code recorded).
The failure signature is the finding: `readiness: unknown` + "persona requirement
subject 'standard' is not the observed root/member preset of this plan" → preflight
`fatal`. (RED run at commit `3418b358`, before the fix commit.)

### 4.2 GREEN (post-fix, `69b40c2c`)

- New suite: **11/11 pass** (`t1-t6-green.log`, EXIT=0).
- Focused provider area (11 files: the frozen v1 suite + all provider-driven suites +
  the v2 engine persona suite + the substrate root/member suite): **112/112 pass**
  (`focused-provider-area.log`).
- Focused `packages/runtime/test` area: **267 files pass / 6 fail — the 6 failures are
  EXACTLY the recorded baseline-debt runtime files** (d3-member-identity-context 1 /
  p6t3-mediation 5 / p6t3-restart 2 + file-level collection p8s3b-result-effects /
  t12a-b2-child-identity / t12a-glue-handoff-ports) — zero new (`focused-runtime-area.log`).
- p4t6 scanner: **10/10 @ pin 897** (`p4t6-post-pin.log`; pre-bump run at 896→897 delta
  in `p4t6-pre-pin.log`).

### 4.3 Full suite — pristine-tree BASELINE vs CHANGED (parent protocol)

Both runs: same worktree, same command (`pnpm vitest run`), marker
`tests/deepseek-harness-test-use` present in both (the baseline run started only
after the marker was confirmed — the degraded ~39-collection-failure state is NOT the
baseline; `t12a-marker-check.log` records the state transition).

| | BASELINE (pristine, `31ad828d`, `baseline-head.txt`) | CHANGED (`69b40c2c`) |
| --- | --- | --- |
| Test files | **11 failed \| 396 passed (407)** | **9 failed \| 399 passed (408)** |
| Tests | **34 failed \| 4685 passed (4719)** | **19 failed \| 4711 passed (4730)** |
| Log | `full-suite-baseline.log` (EXIT=1) | `full-suite-changed.log` (EXIT=1) |

**Failed-file SET DIFF (changed − baseline): EMPTY**
(`setdiff-failed-files-changed-minus-baseline.txt`, 0 bytes;
`failed-files-*.txt` list both sets). **Zero new failures.**

Baseline failed files (11) and their status in the CHANGED run:

| File | Baseline | CHANGED |
| --- | --- | --- |
| `packages/domain/test/t1-capability-schema.test.ts` | 9 fails | 9 fails (debt) |
| `packages/domain/test/t2-blueprint-hash.test.ts` | 1 fail | 1 fail (debt) |
| `packages/runtime/test/d3-member-identity-context.test.ts` | 1 fail | 1 fail (debt) |
| `packages/runtime/test/p6t3-mediation.test.ts` | 5 fails | 5 fails (debt) |
| `packages/runtime/test/p6t3-restart.test.ts` | 2 fails | 2 fails (debt) |
| `packages/tools/test/p6t6-actions.test.ts` | 1 fail | 1 fail (debt) |
| `packages/runtime/test/p8s3b-result-effects.test.ts` | file-level collection | file-level collection (debt) |
| `packages/runtime/test/t12a-b2-child-identity.test.ts` | file-level collection | file-level collection (debt) |
| `packages/runtime/test/t12a-glue-handoff-ports.test.ts` | file-level collection | file-level collection (debt) |
| `packages/runtime/test/a2c7-subtree-matcher.test.ts` | 9 fails (**environmental** — test-use restore in progress: pinned `dsh-fs-local` backend absent, `REAL.available === false`) | **PASS** (restore completed — improvement, listed) |
| `packages/testkit/test/plugin-dsh-compat.test.ts` | 6 fails (**environmental** — test-use built `lib/` absent: `Cannot find module .../tests/deepseek-harness-test-use/packages/boot/app-boot/lib/index.js`) | **PASS** (restore completed — improvement, listed) |

The CHANGED failure set (9 files / 19 tests) is **byte-for-byte the recorded
baseline-debt list** from the mission (including the three file-level collection
failures). The p6t1-parallel flake family (P1/P2/P3 signatures) produced **zero
failures in both runs** — nothing to record, no new signature.

### 4.4 Lint (parent protocol fingerprint)

Command + fingerprint recipe per protocol: `pnpm run lint`;
`grep -E "^\s+[0-9]+:[0-9]+\s+(error|warning)" LINT_LOG | sed -E 's/^\s+//' | sort`.

| | BASELINE | CHANGED |
| --- | --- | --- |
| Summary | `✖ 143 problems (118 errors, 25 warnings)`, EXIT=1 (the pre-existing RED debt) | `✖ 143 problems (118 errors, 25 warnings)`, EXIT=1 |
| Fingerprint | `lint-fp-baseline.txt` (143 lines) | `lint-fp-changed.txt` (143 lines) |

**Fingerprint diff**: exactly 3 delete/add PAIRS, all in
`packages/runtime/requirement-facts/provider.ts` (the only product file modified):
`87:8 'ObservationState'` → `94:8`, `96:8 'RequirementFactScope'` → `103:8`,
`442:32 'observation'` → `463:32` — **the same three pre-existing errors shifted by
the lines this fix inserts above them** (verified: linting the PRISTINE file at base
reproduces the identical three errors at the old line numbers — `provider-pristine.ts`
was linted during verification; see §5). **Zero NEW lint errors in any file.** The
newly added test file and the p4t6 pin edit are lint-clean (direct `npx eslint` over
the three touched files reports only the three pre-existing provider.ts findings).

### 4.5 p4t6 scanner pin (disclosed per red lines)

The NEW test file is a scannable `packages/**` `.ts` → the pinned count moves
**896 → 897**. Updated following the sanctioned single-writer pin-bump precedent
(comment entry + the two `toBe`s; scanner `.mjs`/`.d.mts` untouched):
`packages/testkit/test/p4t6-session-event-scan.test.ts` (commit `3418b358`).
Justification recorded in the pin comment (finding A suite; in-place provider/p4t6
edits carry no count delta; the new file carries zero denylist vocabulary — the
frozen quarantine hit set is unchanged at fifteen occurrences; the 897 value is the
scanner run on this tree, authoritative, not hand-computed). Pre-bump run shows the
896→897 delta (`p4t6-pre-pin.log`); post-bump 10/10 (`p4t6-post-pin.log`).

## 5. Deviations / notes

1. **Two full-suite runs instead of one** (mission said "run ONCE at the end"): the
   parent's mid-run protocol supplement (baseline-comparison discipline) requires a
   pristine-tree baseline PLUS the changed run — both captured; the degraded-env
   (~39 collection failures, marker absent) state was never the baseline (the marker
   was confirmed present before the baseline started; `t12a-marker-check.log`).
2. **Lint fingerprint diff is not literally zero-additions**: three error lines appear
   as additions — they are the line-SHIFTED pre-existing provider.ts errors (same
   messages, same file, same rule; pristine-file lint proof). No new lint error exists
   in any file. Flagged for the parent's judgment.
3. **Test-authoring self-catch (no scope impact)**: the first RED attempt hit a
   YAML-indent bug in the NEW test's own fixture (a `.replace()` search string lost 2
   of 4 indent spaces → 6-space continuation → `decodeYamlFrontmatter` MALFORMED_DTO).
   Fixed before the recorded RED capture; the recorded RED is the genuine
   pre-fix behavior, not an artifact.
4. **Verdict vocabulary**: the authority's per-requirement outcomes are lowercase
   (`REQUIREMENT_OUTCOMES` `pass`/`warning`/`fatal`) — the suite asserts through that
   closed set (one test-authoring correction, same file, before the fix commit).
5. **Scope discipline**: ONLY finding A touched. No upstream/DSH changes; no
   push/merge/force-push; no port 3080/3180 or `~/.dsh`; no host instances; no
   model/config changes; `dev/agent-workflow/graph.yaml` untouched; no existing test
   weakened or deleted (the frozen v1 preset-id suite passes unmodified); the
   probe path (s6-remote merge) deliberately not patched (documented safe
   direction, out of scope).
6. **Environment**: node v24.21.0, pnpm 11.7.0; `node_modules` already installed (no
   install needed); all git/pnpm commands run from inside
   `.worktrees/fix-persona-kind` only (single writer).
