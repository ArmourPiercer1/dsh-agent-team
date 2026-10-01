# Finding A (P1) — persona KIND subject vs presetId mismatch: fix report

**Branch**: `fix/persona-kind-preflight` (worktree `.worktrees/fix-persona-kind`)
**Base**: `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (= master; recorded in `baseline-head.txt`)
**PR**: #46 (pushed by the main agent at round-1 tip `141ee133`)
**Commits**:

| SHA | Round | Subject |
| --- | --- | --- |
| `3418b358` | 1 | test(finding A): persona KIND subject regression suite over the REAL production provider → preflight chain (RED at base) |
| `69b40c2c` | 1 | fix(finding A): resolve persona KIND subjects against the observed kind of the scope's role in the requirement-facts provider |
| `141ee133` | 1 | bookkeeping(finding A): SESSION_ROUTER_LOG entry + evidence (RED/GREEN captures, full-suite baseline vs changed + set diff, lint fingerprints, p4t6 pin 896→897 runs, marker-state probe) |
| `1461a6f2` | 2 (external review) | fix(Blocker-1): the template scope carries its role identity — the leader is judged by its OWN (root) observation |
| `7a4d7d60` | 2 (external review) | fix(Blocker-3): the complete observation surfaces the TYPED §13.5 conflict lane end-to-end (alongside `(persona, 'complete')` world fact) |
| `fcf67b6f` | 2 (external review) | build(Blocker-2): ship the rebuilt dist artifacts + the SHIPPED DIST SMOKE |
| (this commit) | 2 (external review) | bookkeeping: this report (round-2 update) + new evidence logs + SESSION_ROUTER_LOG entry |

---

# ROUND 2 — external review of PR #46 @ 141ee133 (BLOCK; fixed on the same branch, same writer)

Three blockers (2× P1, 1× P2) + an evidence-wording correction. All fixed at the
commits above; every gate re-verified at the NEW head (§R2-5).

## R2-1. Blocker 1 (P1) — leader/member role identity (commit `1461a6f2`)

**The defect (verified from code at 141ee133, no counter-evidence)**:
`scopeRequirementInputsOf` (scope-requirements.ts L95–100) puts the LEADER among
the template scopes (leader first, then members). Round 1 built every template
scope as `{kind:'template', templateId}` with NO role, and the provider kind
branch mapped EVERY template scope to `plan.member` — so a leader-template
persona requirement was judged by the MEMBER's observation. Two concrete
regression directions, both real:

- a healthy leader (root preset observing `standard`) under a complete-observing
  member preset → the leader scope was judged by the member's `complete`
  observation → spurious FATAL/fixOrDisable;
- a complete-observing leader under a standard member preset → the leader scope
  was judged by the member's `standard` observation → FALSE PASS.

**Leader mount authority (VERIFIED from code — the review's required citation)**:
the leader IS the root; the plan needs NO extension.

- `packages/runtime/src/plugin/live/agent-bindings.mjs` L2149–2155 (v3): "the
  root mounts `config.rootPresetId` and the member mounts `config.memberPresetId`"
  (`await presets.mount(agentCtx, isRoot ? config.rootPresetId :
  config.memberPresetId)`); the error lane: "the leader (root) must never run
  without its ordinary base tools".
- Plan §C.2: the plan's ROOT entry is "the actual preset used by the Leader".
- `root.ts` presetSeam: the bind-time persona slot reads the ROOT entry
  (Architecture §13.1: members inherit the root's bind substrate).

⇒ the ROOT plan entry is exactly the leader's actually-mounted preset
observation. **Chosen mapping (smallest correct design): team → `plan.root`,
template scope role `leader` → `plan.root`, role `member` → `plan.member`.**
plan §C.2 R8 needs the leader distinction; it is now carried by the shared
contract below.

**The shared contract (kept minimal + orthogonal so F's rebase is trivial)**:
`packages/runtime/requirement-facts/types.ts` —

- `REQUIREMENT_FACT_SCOPE_ROLES = { leader: 'leader', member: 'member' }`
  (closed 2-set) + `type RequirementFactScopeRole`;
- the template scope variant REQUIRES `role`:
  `{ kind:'template'; templateId: string; role: RequirementFactScopeRole;
  instanceId?: string }`;
- `assertRequirementFactScope` validates the role (typed `MALFORMED_DTO
  $.role`) — the templateId check stays FIRST (the frozen assert test at
  L381 passes unchanged);
- `requirementFactScopeRoleOf(leaderTemplateId, templateId)` — the bound
  blueprint knows its leader template id;
- exported from `requirement-facts/index.ts`.

**EVERY scope-construction site updated** to pass the real role from the bound
blueprint: `root.ts` ×5 (boot feed / per-blueprint facts thunk / full-resolution
read port / creation preflight / fresh facts source) + the test sites (the
d1-d3, leader-template, leader-recovery feed builders derive it from the
blueprint; the persona-kind suite's `templateRead` helper mirrors root.ts; the
frozen v1 suite's `dev` template constant and the mcp-live `dev` constant get
`role: 'member'` — a MEMBER boundary in both worlds; **the frozen suite's
assertions are byte-identical, only the scope literal conforms to the new
required field — disclosed per the review's own contract wording**).

**Provider kind path**: `team` → `plan.root`; template role `leader` →
`plan.root`; role `member` → `plan.member`. The LEGACY preset-id path (non-kind
subjects) stays byte-for-byte and never reads the role.

**New real-chain regression suite (Blocker-1 describe — RED captured at
141ee133 FIRST, per the review; `b1-red.log`: 3F|11P EXIT=1)**:

| Test | World | Assertion (post-fix) | Pre-fix signature in the RED capture |
| --- | --- | --- | --- |
| BL1 | the review's concrete direction 1 — root preset id `ptc/team-small-ctb` observed `standard`, member `ptc/member-custom` observed `complete`; LEADER requires `standard`; NO member requirement, NO team requirement (the pure leader world) | **proceed**; the leader scope ready on the ROOT observation; feed `[(persona, standard, true, 1)]` | leader observation `unreachable` (the member's `complete` observation was used) → the healthy leader misjudged |
| BL2 | the inverse — root `ptc/member-minimal` observed `complete`, member `ptc/member-std` observed `standard`; LEADER requires `standard` | the leader scope FATALs with the LEADER's OWN observation (typed §13.5 reason names the ROOT preset + "complete effective persona") → preflight `fixOrDisable` (a blocked template scope), `blockedScopeKeys [template:leader]`, `fixOrDisableRequirementIds [req-persona-standard-leader]`, `evaluateCreationScopes` (all four ports) verdict `fatal` — **the assertion is exactly the preflight verdict; NO execution bypass is claimed** (the bind-time persona slot has its own downstream guard reading the ROOT entry) | `reachable` — FALSE PASS (the leader was judged by the member's `standard` observation) |
| BL3 | both roles — leader + worker templates both require `standard`; root observed `standard`, member observed `complete` (team requirement passes on the root) | the leader scope PASSES on the root observation while the worker scope BLOCKS on the member observation; ONLY `template:worker` blocked; per-scope observations differ | `blockedScopeKeys [template:leader, template:worker]` — both blocked (the leader wrongly) |

GREEN: `suite-green-newhead.log` — 14/14 EXIT=0 (the 11 round-1 tests + BL1–3).

## R2-2. Blocker 3 (P2) — typed end-to-end diagnostics (commit `7a4d7d60`)

**The defect**: the provider-fed complete worlds yielded only
`(persona, <kind subject>, available:false)`. The engine's typed lane
(`packages/domain/compatibility/src/engine.ts` L160–162:
`facts.some(f => f.domain === 'persona' && f.subject === 'complete')` →
`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`, else `PERSONA_INCOMPATIBLE`; only for
`complete:true` persona requirements) fires only when a `(persona, 'complete')`
world fact EXISTS — so the complete observation DEGRADED to the generic
`PERSONA_INCOMPATIBLE` in the provider lane (prose/FATAL-only diagnostics).

**Design (the engine's typed lane read FIRST, then matched)**: the lane comment
defines the expectation — "The world fact's SUBJECT is the OBSERVED KIND (the
persona kind convention)". The fix keeps the kind-subject fact keying AND
surfaces the complete observation through that exact lane: when the observed
kind of the scope's role is `complete`, the provider emits the
`(persona, 'complete', available: true)` world fact **alongside** the
kind-subject fact (same live generation). The legacy preset-id path does not
emit it (the frozen v1 feed stays byte-identical — the frozen suite's
exact-feed assertions are untouched and pass).

**RED captured for the new assertions** (provider without the alongside block;
`b3-red.log`: 3F|11P EXIT=1): the feeds lack the complete fact and the engine
returns `PERSONA_INCOMPATIBLE` where `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`
is expected — the exact degradation the review described.

**The test now asserts the EXPLICIT reasonCode** (not just prose/FATAL) —
`evaluateCompatibility` (the frozen persona-requirement-v2 test shape) over the
REAL provider feed:

- T2's worker template scope, T3's team scope, T6's end-to-end world each
  assert `reasonCode ===
  COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` (+
  `outcome: 'FATAL'`);
- the feed assertions carry the alongside fact, sorted by (domain, subject):
  `[(persona, complete, true, 1), (persona, standard, false, 1)]`.

## R2-3. Blocker 2 (P1) — the SHIPPED dist (commit `fcf67b6f`)

**The defect (verified at 141ee133)**: the plugin loads from the committed dist
mirror WITHOUT a separate build step — root package.json `./host` export →
`packages/runtime/dist/packages/runtime/src/plugin/host.js` (README L85–88:
install-and-run with no build step; L121: the required generated artifacts must
be committed in the same commit as the source) — and the PR shipped NO
artifacts: the shipped `dist/.../requirement-facts/provider.js` L250–256 still
carried the old preset-id-only matching (verified by reading the built file).

**The fix (the policy-PR precedent: `pnpm build` + co-committed dist +
check:artifacts)**:

- `pnpm build` 9/9 Done (`build-changed.log`); the dist delta is EXACTLY the
  changed modules — 15 files in `packages/runtime/dist`:
  `requirement-facts/{index,provider,types}.{js,d.ts,map}` (role contract +
  role-aware kind path + alongside complete fact) +
  `src/plugin/root.{js,d.ts.map,map}` (the five role-aware sites); zero drift in
  the other eight packages' committed mirrors;
- `pnpm run check:artifacts` **EXIT=0**: "OK: 1372 files; committed
  install-surface artifacts match the fresh build (incl. 1 glue placement(s))"
  (`check-artifacts-changed.log`, re-run after the commit);
- `pnpm build:composition` NOT run — the composition surface is unchanged
  (no client change; the glue placement is verified by check:artifacts to match
  the fresh build).

**NEW SHIPPED DIST SMOKE** (labeled exactly what it is: a **SHIPPED DIST
SMOKE** — the artifact-lane evidence; it does NOT replace the unit-level
suite and it is NOT a live host: no host entry is booted, no instance is
started): `packages/runtime/test/persona-kind-shipped-dist-smoke.test.ts`
imports the BUILT `provider.js` from the dist mirror via the file-URL
dynamic-import precedent (`plugin-dsh-compat.test.ts` imports a prebuilt lib
the same way; the vitest .js→.ts sibling hook cannot rewrite a dist path —
there is no .ts sibling in the mirror — so the loaded module is the built JS
itself) and asserts over the SHIPPED module: the kind subject resolves to the
OBSERVED-kind fact (never `unknown`, no seed); the template scope's role
selects the plan entry (leader → root, member → member); the complete
observation carries the alongside `(persona, 'complete')` world fact; the
legacy preset-id path is intact. **Behavioral discriminator (old vs new
artifact)**: against the pre-fix built provider the same assertions FAIL (the
kind subject was `unknown` → the seed-less fact omitted → empty feed).
Result: 2/2 pass.

**p4t6 scanner pin 897 → 898** (the new smoke file is +1 scannable; sanctioned
single-writer pin-bump precedent — justification recorded in the pin comment;
the rebuilt dist files are already-scanned artifacts with no count delta; the
new file carries zero denylist vocabulary — the frozen quarantine hit set is
unchanged at fifteen occurrences; the 898 value is the scanner run on this
tree, authoritative, not hand-computed): 10/10 EXIT=0 (`p4t6-post-898.log`).

## R2-4. Evidence wording correction (the review's required exact wording)

- The round-1 suite (11 tests; 14 after BL1–3) = **real parser/provider/
  preflight integration over the observer-seam double (the one injected port)
  — NOT root assembly, NOT the remote probe path, NOT the live host**.
- The new smoke = **shipped dist smoke** (the artifact lane) — labeled as such.

## R2-5. Gates re-verified at the NEW head (post-`fcf67b6f`)

| Gate | Result | Log |
| --- | --- | --- |
| New suite (14 tests) | **14/14, EXIT=0** (RED→GREEN: `b1-red.log` 3F\|11P @ 141ee133; `b3-red.log` 3F\|11P for the typed assertions) | `suite-green-newhead.log` |
| Focused area (`packages/runtime/test`) | 7 failed files \| 266 passed (273); 9 failed \| 2793 passed (2802) — the 7 = EXACTLY the 6 baseline-debt runtime files + `p6t1-parallel` 1 test with the **documented P2 flake signature** (passes 9/9 in isolation ×2 — same recorded family, zero new signatures) | `b1b3-area.log` |
| Full suite vs baseline | **9 failed \| 400 passed (409) files; 19 failed \| 4716 passed (4735) tests**; failed-file SET DIFF vs `failed-files-baseline.txt` = **EMPTY** (`setdiff-failed-files-newhead-minus-baseline.txt`, 0 B) — **zero new failures**; 4735 = baseline 4719 + 14 (suite) + 2 (smoke) | `full-suite-newhead.log` |
| Typecheck (all 8 packages that define the script; `legacy` has none) | **EXIT=0** | `typecheck-newhead.log` |
| Lint FILE-AWARE (parent's protocol: file path + line:col + severity + message, sorted) | **143 = 143**; diff vs the round-1 changed fingerprint (`lint-fa-r1changed.txt` vs `lint-fa-newhead.txt`) = exactly 3 pre-existing errors line-shifted in touched files (provider.ts 103→104 `'RequirementFactScope'`, 463→505 `'observation'`; d1-d3 test 340→341 `'SIGNAL_ID'`) — **zero NEW lint errors in any file** (all newly added files lint-clean) | `lint-newhead.log` |
| check:artifacts | **EXIT=0, 1372 files** (zero drift, incl. 1 glue placement) | `check-artifacts-changed.log` |
| p4t6 scanner | **10/10 @ pin 898, EXIT=0** | `p4t6-post-898.log` |
| SHIPPED DIST SMOKE | **2/2, EXIT=0** | (in the full-suite log + standalone run) |

## R2-6. Deviations / disclosures (round 2)

1. **Commit grouping** (the review left it to me): Blocker-1+contract and
   Blocker-3 are separate commits, each GREEN on its own (C1 state = the
   contract + leader fix with BL1–3 and NO B3 assertions — verified 14/14
   before C2; C2 adds the alongside fact + the typed assertions; C3 = dist +
   smoke + pin). This keeps every commit bisectable-green.
2. **BL2 fixture self-catch (no scope impact)**: the first BL2 attempt built
   its world from a fixture that carried a TEAM requirement — in the
   root-complete world the team scope also blocked and the classifier returned
   `fatal`, masking the leader-scope semantics. Fixed with the pure-leader
   world (no team requirement, no member requirement) before the recorded
   RED/GREEN; the recorded captures are genuine.
3. **Test-authoring correction (B3)**: the engine entry
   (`evaluateCompatibility`, `COMPATIBILITY_REASON_CODES`) lives in
   `domain/compatibility`, not re-exported by `domain/blueprint` — one import
   source fix in the test before the recorded GREEN.
4. **p4t6 pin 897 → 898** (disclosed, §R2-3) — sanctioned precedent.
5. **Frozen v1 suite constant**: the `TEMPLATE` scope constant in
   `runtime-requirement-facts-provider.test.ts` gained the required
   `role: 'member'` literal (a member boundary per the file's own R8 comment —
   its template scope reads the member preset); **all assertions
   byte-identical** — the minimal conformance to the new required contract
   field, disclosed.
6. **Scope discipline (round 2)**: ONLY the three blockers touched. No
   upstream/DSH changes; no host launches / :3080 / :3180 / `~/.dsh`; no
   model/config changes; `dev/agent-workflow/graph.yaml` untouched; no
   test weakened or deleted; minimal diff (C1: 10 files; C2: 2 files; C3: 17
   files = 15 dist + smoke + pin).
7. **Environment**: node v24.21.0, pnpm 11.7.0; all git/pnpm commands run from
   inside `.worktrees/fix-persona-kind` only (single writer); scratch logs in
   `.worktrees/.scratch-logs/persona/` (gitignored), evidence copies in this
   directory.

---

# ROUND 1 (history — the finding-A fix, as reported for PR #46)

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
product change in round 1; the round-2 commits extend it per §R2-1/§R2-3):

1. If the subject IS a closed required persona kind (via `isRequiredPersonaKind`
   from the domain compatibility layer — single source of truth): the world fact is
   the OBSERVED KIND of the role the SCOPE addresses (round 2: team ⇒ `plan.root`,
   template role `leader` ⇒ `plan.root`, role `member` ⇒ `plan.member`), mapped
   through the EXISTING `personaReadiness` (standard → reachable,
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

## 3. Regression tests (round 1) — real production chain

Suite `packages/runtime/test/persona-kind-provider-preflight.test.ts` (11 tests in
round 1; 14 after BL1–3 — §R2-1). **Evidence wording (the review's required
correction, applied to all prior claims): this is real parser/provider/preflight
integration over the observer-seam double (the one injected port) — NOT root
assembly, NOT the remote probe path, NOT the live host.** Chain driven:
`parseBlueprint` (real v2 source) → `resolveRuntimeSubstrate` (the REAL resolver
over the production observer-seam double `observePersonaKind(presetId)`) →
`createRuntimeRequirementFactsProvider` (the REAL provider over the REAL
`createCapabilityReadinessProvider` with the production structural fact: only an
mcpServer probe port is registered, so the persona observation is
`probeable:false` and keeps the legacy seed-satisfied 2-state) →
`runCreationPreflight` / `evaluateCreationScopes` (driven with the SAME port shape
`root.ts`'s `enforceCreationPreflight` wires).

| Scenario | Assertion (post-fix) | Pre-fix state at 31ad828d |
| --- | --- | --- |
| T1 | root `ptc/team-small-ctb` (std) + DIFFERENT member id (std), team req `['standard']`, NO seed → preflight **proceed**, team scope `ready`, fact `(persona, standard, available:true, gen:1)`, observation `reachable` | **RED**: observation `unknown`, fact omitted, preflight **fatal**, verdict `fatal` |
| T2 | root std / member `complete` (R8): team scope **PASS** on the ROOT observation; worker member-template scope **FATAL** on the MEMBER observation (typed reason names the MEMBER preset, `fixOrDisable` with `template:worker` blocked) + (round 2, §R2-3) the alongside complete fact + `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` asserted end-to-end | **RED**: the team scope also FATALed (kind subject unknown) |
| T3 | root `complete` → team scope **FATAL** (structural §13.5 conflict; typed "complete effective persona" reason; NOT reclassified pending) + (round 2) the explicit `reasonCode` | RED-leg: FATAL too, but via the unknown/omitted-fact lane with the wrong diagnosis |
| T4a | typed observer failure → `unresolved` → `unknown` → no seed ⇒ fact omitted ⇒ preflight **fatal** (fail-closed; asserted NOT `pending` — persona is non-probeable) | RED-leg: same outcome, unknown reason was the preset-id mismatch |
| T4b | same world WITH seed `(persona, standard, available:true, gen:5)` ⇒ **proceed** (marked bootstrap fact) | GREEN pre-fix — pinned as a guard |
| T4c | same world WITH seed `available:false` ⇒ **fatal** (the 2-state is not a blanket OPEN) | GREEN pre-fix — pinned as a guard |
| T5a | NON-kind subjects keep the legacy root/member preset-id matching byte-for-byte (through the REAL resolver) | GREEN pre-fix — the frozen v1 semantics |
| T5b | a KIND subject resolves through the KIND path even when the mounted id is a bespoke one | **RED**: `unknown` → fatal |
| T6 | end-to-end through the creation preflight (root.ts port shape): v2 blueprint + mounted composable preset ⇒ **proceed with NO seed**; the SAME chain with a complete preset ⇒ **fatal** end-to-end (no false OPEN) + (round 2) the explicit `reasonCode` | **RED**: fatal without a seed |

## 4. Round-1 verification (as reported; re-verified at the new head per §R2-5)

- RED capture (`t1-t6-red.log`): 7F|4P EXIT=1 at base; GREEN (`t1-t6-green.log`):
  11/11 EXIT=0; focused provider area 112/112; full suite baseline
  11F|34F|4685P(4719) vs changed 9F|19F|4711P(4730), failed-file SET DIFF empty
  (`setdiff-failed-files-changed-minus-baseline.txt`, 0 B); lint 143=143 with the
  3 pre-existing provider.ts errors line-shifted (pristine-file lint proof), zero
  new; p4t6 896→897 (disclosed). The two environmental baseline files
  (a2c7-subtree-matcher, plugin-dsh-compat) turned PASS after the test-use restore
  (improvement, listed).

## 5. Round-1 deviations / notes

1. Two full-suite runs instead of one (the parent's mid-run protocol supplement
   requires a pristine-tree baseline PLUS the changed run); the degraded-env state
   was never the baseline (`t12a-marker-check.log`).
2. Lint fingerprint diff = 3 line-shifted pre-existing errors (pristine-file
   proof), no new lint error in any file.
3. Test-authoring self-catches (fixture YAML indent; authority verdict
   vocabulary `REQUIREMENT_OUTCOMES`) — no scope impact.
4. Scope discipline: ONLY finding A touched; no upstream changes; no
   push/merge/force-push; no port 3080/3180 or `~/.dsh`; no host instances; no
   model/config changes; `graph.yaml` untouched; no existing test weakened or
   deleted; the probe path deliberately not patched.
5. Environment: node v24.21.0, pnpm 11.7.0; all git/pnpm from inside
   `.worktrees/fix-persona-kind` only (single writer).
