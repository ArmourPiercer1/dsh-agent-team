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
