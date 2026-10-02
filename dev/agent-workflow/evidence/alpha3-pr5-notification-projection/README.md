# Evidence — ALPHA.3 PR5: permission notification + read projection (DRAFT, unwired by design)

Branch `task/alpha3-pr5-notification-projection`, base `6259cf4bc4d61af74d84bbd9d265184f95493172` (= `origin/master` at start, verified `git rev-parse HEAD`).
Worktree `.worktrees/pr5-notification`. node_modules copied (read-usage only) from the MERGED `pr3-gms-permission-mutation` lane (root + packages/{client,domain,runtime,testkit}); NO pnpm install was run. Offline only (vitest/tsc/node/eslint; no host, no port, no model, no network; :3080/:3180 zero-touch). Frozen lease paths (`.worktrees/pr4-permission-lifecycle`, `.worktrees/int-alpha3-stage2`, `tests/homes/`) were NEVER touched.

## Raw logs (chronological; every rc captured via `cmd > log 2>&1; rc=$?`, never through a pipe)

| File | Command | Result |
| --- | --- | --- |
| `baseline-runtime-suite.log` | `npx vitest run` (packages/runtime) @ base, PR5 files staged out | rc=1 — 7 failed files / 10 failed / 3146 passed. PRE-EXISTING live-seam failures (`p6t1-parallel`, `p6t3-mediation`, `p6t3-restart`, `d3-member-identity-context`, `p8s3b-result-effects`, `t12a-*` collection) — baseline for the no-regression bar (`baseline-fail-set.txt`). |
| `red-module-absent.log` | the three `a3p5-*` specs BEFORE the module directory exists | rc=1 — 3 files fail with raw `Cannot find module '../permission-notification/index.js'` = honest RED (the specs genuinely exercise the module; 0 tests collect). |
| `green-directed-run1.log` | the three `a3p5-*` specs after implementation | rc=1 — 3 failed / 28 passed: all three failures are TEST-CHOREOGRAPHY bugs (a forbidden-import regex matching `permission-governance` as a substring; an isolation fixture that wrote the very row the negative leg expected empty; the append-guard probe polluting its own `touched` recorder). No production behavior implicated. |
| `green-directed-run2.log` | same three specs, choreography fixed | rc=0 — **31 passed / 31** (notification 15 + read-projection 7 + lane-hygiene 9). THE PR5 directed green run. |
| `typecheck-runtime.log` | `npx tsc -p tsconfig.json` (packages/runtime) | rc=0, empty. (An intermediate rc=2 run — missing `.js` extension on the helpers import — was fixed before this capture; the first capture's content is the clean run's.) |
| `full-runtime-suite-final.log` + `final-fail-set.txt` | `npx vitest run` (packages/runtime) final | rc=1 — 6 failed files / **8 failed / 3179 passed (3187)**. Failure set vs baseline: `diff` shows ONLY REMOVALS (the two `p6t1-parallel` cold-FS flakes went green on the warm run — proven by `p6t1-parallel-standalone.log`, rc=0, 9/9). **Zero new failures**; +31 tests, all PR5, all pass (3156 → 3187). |
| `p6t1-parallel-standalone.log` | `npx vitest run test/p6t1-parallel.test.ts` | rc=0 — 9 passed (documents the baseline flake class: live-seam timing on a cold-copied node_modules tree). |
| `p4t6-pin-942-green.log` | `npx vitest run test/p4t6-session-event-scan.test.ts` (packages/testkit) | rc=0 — 10 passed. Scanner reports **filesScanned = 942** (authoritative run, not hand-computed): 934 pin + 7 PR5 files + **1 PRE-EXISTING missed increment** (merged PR #56 added `packages/client/test/pr56-control-subject-payload.test.ts` without a pin update — the leg was ALREADY RED at the PR5 base, 935 ≠ 934). Recorded explicitly in the pin text and the test title per the merge-union precedent, not silently absorbed. Quarantine hit set unchanged at 15. |
| `typecheck-testkit.log` | `npx tsc -p tsconfig.json` (packages/testkit) | rc=0, empty. |
| `testkit-suite-final.log` | `npx vitest run` (packages/testkit) final | rc=0 — **158 passed / 158**. |
| `build.log` | `pnpm run build` (root, recursive) | rc=0. |
| `check-artifacts.log` | `node scripts/check-artifacts-committed.mjs` after the build | rc=0 — `[check-artifacts-committed] OK: 1392 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))`. PR5 adds NO dist churn (the unwired lane ships out of the tsc build exactly like the PR1 foundation), so the install surface is byte-unchanged; a post-commit re-check is recorded below. |

ESLint over all new/changed files (`npx eslint packages/runtime/permission-notification packages/runtime/test/a3p5-*.test.ts packages/testkit/test/p4t6-session-event-scan.test.ts`): rc=0, zero findings.
Staged-diff secret scan (`git diff --cached | grep -icE 'api[_-]?key|secret|passwd|password|ghp_|AKIA|-----BEGIN'`): 0 matches.

## What the PR is (one paragraph)

A PURE awareness layer `packages/runtime/permission-notification/` (4 sources + 3 specs), delivering exactly the PR5 scope (ADR §9): **(1)** active-Agent best-effort notification of committed permission mutations — the generation-tagged record/renderer (`[team-perm-changed team=… instance=… generation=N]` token-leading, deterministic, rule COUNT only, never the rule payload) plus an active-only never-throwing notifier (READ-ONLY liveness point read; `idle`/`unknown` → delivery seam NEVER touched — idle Agents are not awakened; delivery faults are converted to a closed skip outcome, never rethrown, so a notification failure cannot affect or roll back a mutation or alter the mutation success ack — pinned by the commit→ack→notify composition leg); **(2)** staleness = marking only — a superseded notice carries its generation and the superseding generation, permissions byte-unchanged (raw durable rows stable, `append` Proxy-guarded and never reached; `latest`-only injected type); **(3)** the read projection (`readAuthority` = the highest-generation durable snapshot mirror; `readHistoryAudit` = ascending audit rows, never folded) through the EXISTING PR1 access boundaries ONLY (`latest`/`history`, `append` narrowed away by the injected type AND Proxy-pinned). **Zero new authority:** the lane's runtime export set is closed (two factories, one builder, one renderer) with no authorize/resolve/assemble/mutate/grant/revoke/envelope/admit/approve/decide/permit vocabulary in ANY export (the "never consumed as authorization input" leg); every cross-lane edge is TYPE-ONLY to the stable PR1 overlay vocabulary; ZERO runtime imports — nothing from governance internals, the resolver, effective-policy, storage, `src/`, or the PR60-rewritten files (`host.ts`/permission-plane/blueprint schema), which also makes the PR dist-level and file-level collision-free against PR60.

## WIRED vs PENDING (the honest state — same table as the module README; repeated in the PR body)

| Piece | State |
| --- | --- |
| Builder / renderer / notifier / projection | implemented + 31 hostless tests over the REAL durable overlay port — **library code, NO production caller, NO production emission point** |
| Post-commit notification EMISSION in the permission-lane mutation path | PENDING (small splice after PR60 stabilizes; call `notifyPermissionCommit(result.snapshot)` in the `changed:true` branch only, outcome never joined into the ack) |
| Production bindings of the three seams (READ-ONLY agent liveness over the existing `status === 'idle'` DSH Agent surface; active-target input-turn delivery; the durable overlay port) | PENDING — EXISTING surfaces only |
| Integration test (live post-commit emission + production read-projection wiring) | PENDING — lands with the splice, coordinated via parent |
| The hygiene zero-consumer walk leg | pins DORMANCY — the wiring splice must update it ON PURPOSE |

No tsc-build include and no dist artifact ship the lane yet (exactly the PR1 `permission-governance` precedent for unwired layers), so landing this PR changes no runtime behavior of the product.

## Deviations / notes

- p4t6 pin: updated 934 → 942 covering the +7 PR5 files AND the pre-existing +1 drift from merged PR #56 (the leg was red at base; disclosed here, in the pin text, and in the test title).
- `p6t1-parallel` baseline flake: two live-seam tests failed in the baseline cold run and passed warm; standalone rc=0 proves it. Failure-set identity claim is stated as "zero NEW failures + final ⊆ baseline".
- No production files outside `packages/runtime/permission-notification/` (new), the three new `a3p5-*` specs, `packages/testkit/test/p4t6-session-event-scan.test.ts` (pin), and this evidence directory were touched.

---

# ROUND 2 (parent GO) — the DELIVERY BINDING module (inject-only ruling)

Scope (parent GO, this round only): the NON-CONFLICTING binding module + tests in the
lane. Shared root/agent-bindings/GMS splice remains NOT GO (awaits PR60 stabilizing).
Base: lane head `ebd57905` (the PR5 lane commit). The pure-lane raw record above stays
retained as-is; everything below is the new round (file prefixes `binding-*`).

## Ruled design implemented (source anchors, pristine 0.1.7-rc.1 `46a7f68b09`)

`packages/runtime/permission-notification/binding.ts`: delivery uses PUBLIC
`Agent.inject` ONLY (`packages/core/agent/src/runtime-types.ts:233-241` "without
waking"; `agent-loop/src/agent.ts:153-171`: `inject = send('next-step', /*wake*/false)`,
the sole wake call `if (wakeup) this.wakeDriver(...)` at :159 is never reached, no latch
in any phase :213-234). `steer`/`followup` are forbidden (wake=true; idle STARTS a turn,
runtime-types.ts:225-231). The agent type is `Pick<Agent, 'status' | 'inject'>` — a
wake-capable member is NOT NAMEABLE (compile-level, not discipline). The receipt gate
(closing → owned live-handle for the EXACT pair → identity equality → lifecycle fact →
`status === 'running'` → one `inject`) is a FULLY SYNCHRONOUS function — zero awaits
between final check and inject is structural, not sequencing. Closed drop vocabulary
(`closing | not-live | identity-mismatch | lifecycle-blocked | not-running |
inject-fault`); never throws; no queue/pending/retry of ours; host durable-inbox parking
used AS-IS. `createPermissionDeliveryAdapter` maps drops to the typed
`PermissionNoticeDropped` for the existing port; `detachPermissionNotice` fires the
awareness dispatch off the ack path (rejections swallowed). Upstream facts re-verified
in this worktree's own `node_modules/@deepseek-ai/dsh-agent/lib/types/*` (runtime-types
d.ts :147 status, inject/steer/followup doc+members; AgentStatus = 'idle'|'running').

## Raw logs (real rc via `> log 2>&1; rc=$?`)

| File | Command | Result |
| --- | --- | --- |
| `binding-red-module-absent.log` | new binding spec BEFORE binding.ts exists | rc=1 — 17 failed, raw `createPermissionDeliveryBinding is not a function` (honest RED). |
| `binding-green-run1..3.log` | first implementations | rc=1 — three choreography fixes recorded honestly (facts reader inverted for closing → three-state FactRead read; two spec-shape fixes: port `append` returns the snapshot directly; `rawOverlayRows(dir)` arg). |
| `binding-green-final.log` | binding spec final | rc=0 — **17 passed / 17**. |
| `binding-all-directed-final.log` | all FOUR PR5 specs together | rc=0 — **48 passed / 48** (notification 15 + projection 7 + hygiene 9 + binding 17). |
| `binding-typecheck-runtime.log` | `npx tsc -p tsconfig.json` (packages/runtime) | rc=0 (after one intermediate rc=2: `Promise.withResolvers` not in the package lib target — replaced with a plain deferred; capture kept is the clean run). |
| `binding-full-runtime-suite.log` + `binding-final-fail-set.txt` | `npx vitest run` final | rc=1 — 6 files / **8 failed / 3196 passed (3204)**; `diff` against the retained round-1 `final-fail-set.txt` = IDENTICAL (pre-existing live-seam set only). +17 tests, all binding, all pass. |
| `binding-p4t6-pin-944-green.log` | p4t6 after pin bump 942→944 | rc=0 — 10 passed; scanner reports filesScanned = **944** = 942 + 2 (binding.ts + its spec; authoritative run, not hand-computed). Quarantine hits unchanged at 15. |
| `binding-typecheck-testkit.log` / `binding-testkit-suite-final.log` | testkit tsc / suite | rc=0 both — 158/158. |
| `binding-build.log` / `binding-check-artifacts.log` | `pnpm run build` / `node scripts/check-artifacts-committed.mjs` | rc=0 / rc=0 — `OK: 1392 files` (lane ships OUT of the tsc build per PR1 precedent: ZERO dist churn; nothing to co-commit). |
| ESLint (all new/changed files) | `npx eslint ...` | rc=0, zero findings. |

## Test classes (parent GO (a)-(e)) — all in `binding-green-final.log` (17/17)

(a) RUNNING receives: one `inject` of the rendered `[team-perm-changed …]` awareness
text as a model-visible user message (fresh id per attempt — parked-notice id collision
impossible), rule payload never rides (count only), and an end-to-end leg through the
REAL notifier + REAL adapter + REAL durable port;
(b) idle / cold / closing / lifecycle-blocked / identity-mismatch → closed drop reasons,
ZERO injects, ZERO touches of any wake-capable member (landmine proxy), closing drops
BEFORE any handle lookup; the adapter surfaces drops typed (`PermissionNoticeDropped`);
(c) RACE: advisory liveness LIES active, target flips idle WHILE the async authority
read is in flight → the sync receipt gate drops at receipt (`delivery-failed` outcome,
zero inbox writes); plus the direct leg proving no interleaving point exists between
gate and send;
(d) cancel-while-running: exactly one inject; `touched` set ⊆ {status, inject} —
`steer`/`followup`/`whenIdle`/`cancel`/`send` landmines NEVER touched (module-side half
of the no-wake guarantee; the upstream half — wake=false neither wakes nor latches — is
source-pinned above, not re-implemented); plus a source scan proving binding.ts contains
no wake-capable call site and uses the two-member `Pick`;
(e) ack independence DETACHED: slow (timer) → both acks settle BEFORE any delivery
settles, order = commit order; never-settling → acks complete, next mutation unaffected;
faulting inject → ack list + raw durable rows BYTE-EQUAL the no-notification golden
world; sync-throwing dispatch swallowed.

## Deviations / notes (round 2)

- Hygiene updated ON PURPOSE (leg 1 allow-list + leg 2 import graph): the lane now has
  EXACTLY two PUBLIC upstream edges — `@deepseek-ai/dsh-agent` TYPE-only and
  `@deepseek-ai/dsh-llm` with the single `createUserMessage` value import (both pinned
  to exact lines); repo cross-directory edges remain TYPE-ONLY to PR1. Zero-consumer
  walk still passes (module remains UNWIRED — the GO explicitly keeps the production
  splice NOT GO).
- Public-boundary findings: NONE insufficient (GO rule 7 not triggered) — `inject`,
  `status`, `Pick<Agent,…>` structural typing, and `createUserMessage` all exist on the
  public installed surface; no hidden hooks, no own queues.
- Status mirror honesty (parent §4 verdict): the notifier's liveness read stays
  ADVISORY (park/drop labeling); the guarantee lives in the sync receipt gate + inject
  non-wake semantics. Class (c) pins exactly that division.
- Files touched this round (exact): `packages/runtime/permission-notification/binding.ts`
  (new), `index.ts` (exports + header), `types.ts` (delivery-port doc: steer-style →
  inject-only), `README.md` (WIRED/PENDING rows), `packages/runtime/test/
  a3p5-permission-delivery-binding.test.ts` (new), lane hygiene spec (on-purpose
  updates), `packages/testkit/test/p4t6-session-event-scan.test.ts` (pin 942→944), this
  evidence directory. No dist churn; no production file outside the lane touched.

## Post-commit re-check (round 2)

- Lane commit `45b15e900aa909b5bda2decc51ceda54d61dc07b` (parent `ebd57905…`, the
  round-1 evidence commit; forward-only).
- `binding-postcommit-check-artifacts.log`: `node scripts/check-artifacts-committed.mjs`
  on the committed lane → rc=0, `OK: 1392 files` — the committed install-surface
  artifacts match a fresh build (zero dist churn confirmed POST-commit, same
  re-check discipline as round 1).

---

# ROUND 3 (parent final GO) — SOURCE-PROVENANCE FIX (PR61 review BLOCK)

BLOCK (parent-found): the inject message carried `source: { kind: 'user' }` — human
attribution for a runtime plugin notice. Impact is not merely audit: the upstream
consecutive-wake budget refills EXACTLY on user-sourced claims —
`packages/jobs/tool-jobs/src/index.ts:211-215` (pristine 46a7f68b09; NOT in any
installed library bundle — the tool-jobs plugin ships in the harness app tree; closest
installed equivalent is the claim-event typing `agent/inbox/claimed` with `message:
UserMessage` at `@deepseek-ai/dsh-agent/lib/types/runtime-types.d.ts:277`):
`if (message.source.kind === 'user') spentWakes.delete(agent)`; the budget is SPENT at
:295-305 (wake-delivery `followup` while `spent < wakeBudget`, else `inject`). A plugin
notice wearing kind:'user' would refill that Human pathway. Fix per GO:

- `binding.ts` — inject source → `{ kind: 'plugin:dsh-agent-team' }` (the pinned Team v4
  producer kind, same as the glue precedent agent-bindings.mjs:4078-4081). Carrier stays
  `createUserMessage`/role 'user' (host message-carrier distinction). Upstream admission
  verified THIS round: v4 rejects ONLY the retired shared wrapper (pristine
  session-format-v3-to-v4 src/message-sources.ts:8-11 — non-empty string kind, !==
  'plugin'); MessageSourceMap is merge-extensible BY DESIGN with "no shared catch-all
  plugin kind" and "user messages carry any producer's kind" (installed dsh-llm
  message.d.ts:95-107); the plugin registers its kind via declaration merging
  (src/plugin/live/message-sources.d.ts, in the runtime tsc program via tsconfig
  include `src` — the literal typechecks rc=0).
- Spec (same file): producer source asserted on the DIRECT leg, the COMPOSED
  notifier→adapter→binding leg, and the park (cancel-while-running) leg; NEW dedicated
  leg asserts the exact upstream predicate negation per message
  (`message.source.kind === 'user'` is false; role 'user' carrier kept), with the
  tool-jobs file:line cited in the test comment.
- Lane README: producer-provenance paragraph + PENDING NOTE per GO item 5: the lane has
  NO production dist reference today (stays UNWIRED; hygiene zero-consumer leg green);
  the FINAL splice commit WILL require a regular build + dist co-commit +
  check-artifacts verification of the new surface.

Raw logs (real rc): `source-binding-spec.log` rc=0 — **18/18** (+1 new provenance leg);
`source-all-directed.log` rc=0 — **49/49** four lane specs (zero-consumer leg green);
`source-typecheck-runtime.log` rc=0; `source-eslint.log` rc=0; `source-p4t6.log` rc=0
(944 pin unchanged — no new files); `source-build.log` rc=0 +
`source-check-artifacts.log` rc=0 OK 1392 (zero dist churn — lane ships out of the tsc
build); `source-full-runtime-suite.log` + `source-final-fail-set.txt` rc=1 — 8 failed /
**3197 passed** (3205), failure-set diff vs the retained set = IDENTICAL (zero new;
+1 = the new provenance leg, passing).

Scope honored: ONLY binding.ts + its spec + lane README + evidence. Shared
root/agent-bindings/GMS glue untouched; no interface-range change; pr4 worktree untouched.

## ROOT BLOCK fix batch (round 5) — raws in `fixbatch/`

Formal root GO (aggregated fix batch): BLOCK-2 receipt-identity fix,
BLOCK-1 production readprojection wiring, docs corrections, real-glue
receipt tests, restore regressions, advisories A8-1/2/3. All raws below
carry their real rc (A8-1).

| Leg | Raw | Result |
| --- | --- | --- |
| ESLint (9 changed/new files; incl. the two PRE-EXISTING s6-remote findings fixed to keep the zero-findings changed-file law) | `fixbatch/eslint-fixbatch.log` | rc=0, zero findings |
| runtime tsc --noEmit | `fixbatch/tsc-runtime-fixbatch.log` (intermediate: rc=2 — 3 test-surface type errors) -> fixes landed in the batch -> **GREEN capture `fixbatch/tsc-runtime-fixbatch-2.log` rc=0 (committed; R-C BLOCK-F1 close — the clean claim now carries its raw)** |
| remote tsc --noEmit | `fixbatch/tsc-remote-fixbatch.log` | rc=0 |
| testkit tsc --noEmit | `fixbatch/tsc-testkit-fixbatch.log` | rc=0 |
| p4t6 session-event scan (2 new scannable specs) | `fixbatch/p4t6-RED.log` (= committed as `p4t6-fixbatch.log`, the RED scanner run) / `fixbatch/p4t6-GREEN.log` | RED `expected 958 to be 956`; repinned 956 -> 958; GREEN 10/10 rc=0; quarantine hits stay 15 |
| remote package suite (versioned-union pins advanced 30 -> 31, v7-only set gains `override.getPermission`; 4th pin on the runtime side in p8s7r4 spec) | `fixbatch/remote-suite-fixbatch.log` | 220/220 rc=0 |
| testkit suite | `fixbatch/testkit-suite-fixbatch.log` | 158/158 rc=0 |
| a3p5 lane + fix-batch specs (splice 9, read-wiring 12 [group A 8 + group B 4], glue-receipt 8, hygiene 9, notification 15, binding 18, read-projection 7) | `fixbatch/lane-suite-fixbatch.log` | 78/78; SUPERSEDED by `fixbatch/lane-suite-fixbatch-2.log` (81/81 rc=0 after the BLOCK-3/4 glue round: glue-receipt 8 -> 11) |
| full runtime suite | `fixbatch/full-runtime-suite-fixbatch.log` | 3322/3330 (8 failed), failset BYTE-IDENTICAL to `splice/final-fail-set.txt` (diff empty; `fixbatch/final-fail-set-fixbatch.txt`) |
| build (pnpm -r run build) + composition (glue placement + client composition bundle) | `fixbatch/build-fixbatch.log` / `fixbatch/composition-fixbatch.log` | rc=0 / rc=0 |
| check:artifacts prestage (drift preview -> co-committed) / postcommit | `fixbatch/prestage-check-artifacts.log` / `fixbatch/postcommit-check-artifacts.log` | preview 21 drifted install-surface files; postcommit rc=0 |

Real-glue harness note: `test/a3p5-glue-permission-receipt.test.ts` runs
the ACTUAL `agent-bindings.mjs` receipt module (t12a live bridge, hostless
dependent fakes) — non-derived seed / restored / leader durable rows
resolve, ANTI-ECHO collision returns the TRUE owner (gate drops
identity-mismatch), stale re-pointed row reads undefined with the new key
staying cold, ghost undefined, derived-id regression; create/resume/steer/
followup counters pinned on every leg (cold-stays-cold). Host/kit
dimension stays NOT_RUN (never claimed).

## Successor round (ROOT GO BLOCK-3/BLOCK-4) — raws `fixbatch/*-2.log` + `fixbatch/glue-consumers-fixbatch.log`

Two real BLOCKs in the fix's OWNERSHIP (verdict on `ecbc30f6`; projection /
ack / SETTLED law untouched):

- **BLOCK-3 (Leader was dropped)**: the real v2 `LeaderInstanceRecordDto`
  carries NO child/lifecycle keys (contracts
  `dto/member-instance-record.ts:116-130` + `:206-213` — validation
  REJECTS their presence), while the boot registers the root handle AT the
  team session id (`agent-bindings.mjs:3560 liveAgents.set(rootSid, ...)`).
  The receipt now restores the LEADER branch: pair targeting the leader
  instance keys to the durable TeamSession row's rootSessionId (exactly
  the registration key), attribution proven from the durable TeamSession
  row + the durable v2 leader row (both read back; identity never echoed;
  no fake child/lifecycle consulted). Cold root / missing team row ->
  undefined (zero creates — pinned).
- **BLOCK-4 (first-match owner)**: owner resolution collects ALL rows
  binding the key; count != 1 -> REFUSAL (undefined) regardless of
  list() order, including when the requesting pair is one of the
  claimants (a corrupted binding is not a delivery target); no
  first-match anywhere in the return path (the forward lookup is
  likewise exactly-one). Single-binding members and the leader still
  resolve (no over-refusal).

Tests (REAL glue, validator-gated fixtures): `a3p5-glue-permission-receipt`
grew to **11 legs** — real-v2 leader receives (fixture passes
`parseMemberInstanceRecord`, which REJECTS child/lifecycle presence —
asserted), leader fail-closed x2 (no team row / cold root, counters 0),
ambiguity refusal in REAL list order + swapped order + no-over-refusal;
the six member-path legs stay verbatim. The legacy child-bearing fake
leader fixture is GONE.

| Leg | Raw | Result |
| --- | --- | --- |
| runtime tsc --noEmit (GREEN capture closing R-C BLOCK-F1) | `fixbatch/tsc-runtime-fixbatch-2.log` | rc=0 |
| ESLint (changed files) | `fixbatch/eslint-fixbatch-2.log` | rc=0 |
| a3p5 lane suite (post-BLOCK-3/4) | `fixbatch/lane-suite-fixbatch-2.log` | 81/81 rc=0 |
| p4t6 scanner (no new scannable files; count unchanged) | `fixbatch/p4t6-fixbatch-2.log` | rc=0 (958 holds) |
| glue consumers (t12a family GREEN-class + shipped-dist smoke over the rebuilt dist) | `fixbatch/glue-consumers-fixbatch.log` | 34/34 rc=0 |
| build + composition | `fixbatch/build-fixbatch-2.log` / `fixbatch/composition-fixbatch-2.log` | rc=0 / rc=0 |

Same-batch DOC corrections (root's five, edited in-place): BOTH v7 methods
quoted everywhere; 15-tool catalog vs Blueprint-filtered Leader view
(acceptance needs grant/revoke visible); notification = best-effort
AT-MOST-ONE attempt, changed:true-gated, re-checked at receipt (no
exactly-one / immediate-visibility guarantee); FOREIGN teamSessionId vs
current-team-other-member -> INSTANCE_UNKNOWN split stated; readprojection
= overlay+history ONLY, NOT the effective outcome (validate by safe next
op). R-C advisories folded: A9-1 per-file counts corrected to the raw
(15/18), A9-2 RED-file naming aligned, A9-4 fixed (both methods), R-C(a)
positive transport pointer added; group labels aligned to the raw
(A 8 + B 4 = 12). Host/kit remains NOT_RUN.
