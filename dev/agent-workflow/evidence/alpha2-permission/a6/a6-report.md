# A6 — production wiring — task report (alpha.2, plan §11)

Task branch: `task/alpha2-a6-production-wiring` (worktree `.worktrees/alpha2-a6`)
Base: `3a4304c` (A1+A2+A3+A4+A5 merged; worktree clean at start, single writer)
Commit: this report ships in the single task commit on the branch —
**A6 alpha.2: production wiring (frozen A1–A5 composition into the live agent
lifecycle: per-agent tools/pre-execute install, control-service ref, lazy
session-cwd closure, fail-closed typed error; 37-test spec; p4t6 pin
665→666; dist rebuilt)** (SHA visible via `git log` on the branch; cherry-pick
to int uses `-x`).

## 1. Deliverables

| Path | Kind | Note |
| --- | --- | --- |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | EDITED (hotspot) | +164/−?: the install decision, the extracted `locateTemplate`, the lazy cwd closure, the fail-closed typed error, the `onObserve` hook |
| `packages/runtime/src/plugin/root.ts` | EDITED (hotspot) | +32/−?: REQUIRED `controlServiceRef` param + the synchronous fill after `createControlService` |
| `packages/runtime/src/plugin/host.ts` | EDITED (hotspot) | +26/−?: the shared ref object, passed to BOTH the glue and the root |
| `packages/runtime/test/t12a-live-bridge.mjs` | EDITED (bridge, additive) | +107: `makeFakeFs()`, the handle `agent.session.header.cwd`, the `ctx.agent` back-ref, the `controlServiceRef` option/passthrough |
| `packages/runtime/test/t12a-live-bridge.d.mts` | EDITED (bridge types) | +39: `FakeFsDouble`, the type surface for the above |
| `packages/runtime/test/a6a-production-wiring.test.ts` | NEW (test) | 37 tests — the install decision, the listener lifecycle, the driven frozen pipeline, the ref contract |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | EDITED | Pin 665→666 + DEC-1 comment entry (g) (A6); scanner `.mjs` byte-unchanged |
| `packages/runtime/dist/**` | REBUILT | 8 files (the mirror of the three hotspots + the byte-identical glue copy); artifact check passes |
| `dev/agent-workflow/evidence/alpha2-permission/a6/*` | NEW (evidence) | This report + wiring map + baseline/after logs + scanner verification |

Source + test delta: 6 files, +378/−21. Dist delta: 8 files, +194/−13.

## 2. What was composed (no re-implementation)

The full composition is in `wiring-map.md`. The shape, in one paragraph:
`host.ts` creates one plain `controlServiceRef` object (the `teamToolsRef`
pattern) and passes it to both `glue.createAgentBindings` (optional dep) and
`createTeamProductionRoot` (required param); `root.ts` fills `.current`
synchronously right after `createControlService` (A4); `agentSetup` in
`agent-bindings.mjs` locates the bound template once (extracted
`locateTemplate`, identical throw contract), projects the alpha.1
capabilities with the unchanged `staticCapabilitiesOf`, reads
`capabilities.permissions` directly off the located deep-frozen template
(FACT 3a), and — when present — installs exactly one A5
`installParameterPermissionListener` per agent with the team-root scope,
the durable instance identity (`{kind:'instance', instanceId}`,
`isLeader = sessionId === teamRoot`), a LAZY session-cwd `resolveTarget`
closure (FACT 3b), and an `onObserve` hook into the existing observation
surface; the disposer goes into `toolDisposers` (close drains, cold resume
reinstalls).

## 3. Design rulings

- **FACT 3a — the policy read is DIRECT**: `staticCapabilitiesOf` does not
  project `permissions` (the alpha.1 pins its shape — changing it would be an
  A1-surface change). The glue reads `boundTemplate.capabilities?.permissions`
  off the located (A1-normalized, deep-frozen) template. Behavioral proof:
  the a6a per-agent scoping legs (leader + member A installed; member B —
  capabilities present, policy absent — gets zero listeners).
- **FACT 3b — the session cwd is read LAZILY at resolve time** (see §5
  deviation 1 for the relation to the A5 handoff note). The closure reads
  `agentCtx.agent?.session?.header?.cwd` per call, threads it into
  `agentCtx.fs.resolve(path, { cwd })`, and returns
  `{ key: String(target.targetKey), display: String(target.displayPath) }`.
  Same basis as the upstream file tools (they read
  `exec.agent?.session.header.cwd`). The seam is a plain function; A5's R2
  cache caches exact-rule keys, never the cwd.
- **Caller identity — `state.instanceId` for BOTH roles**: from the glue's
  durable consumption resolution (`resolveConsumptionViews`), where the
  leader position resolves to `'inst-leader'` (`instanceIdForSession`) and a
  member to its durable row id. `caller = targetInstanceId = instanceId` —
  pinned by the a6a requestControl scope assertions for both roles.
- **Control-service ref design**: one shared plain object; the host creates
  it, the root fills it during construction (immediately after
  `createControlService`), the glue reads it lazily at setup time.
  `boot()` only runs after construction, so production always sees a
  constructed service. Mirrors `teamToolsRef` exactly (doc + option shape).
  `createTeamProductionRoot`'s param is REQUIRED (its only caller is
  `host.ts`; mirrors the `teamToolsRef` precedent).
- **Fail-closed choice**: permissions present + ref absent/malformed at
  setup → `agentSetup` throws the typed
  `alpha2-permission-control-unavailable` error (a setup rejection rolls the
  unpublished agent back — the AgentSetup contract). Only the alpha.2 path
  can reach it: absent policy = the ref is never read. The error names the
  session + instance id and emits one observation row (never silent).
- **`onObserve` rows**: `alpha2-perm: <compact JSON>` into the existing
  `observations` array (the established `p6t6:` / `alpha1:` style) — small
  structured records (stage + callId + ids), no tool payloads; a throwing
  hook never affects the decision (A5 invariant).

## 4. Tests — `packages/runtime/test/a6a-production-wiring.test.ts` (37 tests)

World: the REAL live glue over the t12a bridge doubles (the t4a foundation)
— real `agentSetup` execution, real blueprint parsing, real A5 adapter —
over a spy control service + the bridge's fake fs seam. Six worlds (create +
permissions; alpha.1 no-permissions; cold resume; driven; lazy ref fill;
fail-closed). The plain-node shim constraint (synchronous `it` bodies) means
all worlds build and all legs drive at MODULE TOP LEVEL; the `it` blocks
assert on captured state.

| Block | Legs | Pins |
| --- | --- | --- |
| install decision | create: leader 1 active listener; member A 1; member B 0; alpha.1 world: 0/0/0 + capability wiring UNCHANGED (leader selection, member A selection + builtin deny, member B deny) | plan §11.1; the legacy/alpha.1 regression proof (absent permissions = zero listeners, behavior byte-identical) |
| listener lifecycle | cold resume: fresh ctxs, reinstalled (leader + member A 1, member B 0), ctxs are fresh doubles; close(): all drained (active=false, entries kept) | plan §11.3 (agent-scoped, lifecycle-owned, no module-level mutable authority) |
| driven pipeline (leader) | static allow (read exact): next once, zero control; ask (write exact): `user-approval` + caller/target = `inst-leader` + action/tool/correlation/fingerprint scope, wait on the EXACT created request, guard on the exact scope, next once; static deny (lsp any): deny, zero next, zero control; unsupported (`team_delegate`): next once, zero control | the frozen A5 pipeline through the production install; the routing bit; the exact A4 scope |
| driven pipeline (member A) | ask (write any): `leader-approval` + caller/target = `inst-a6aa` + wait/guard exact + next once; static allow (read any, RELATIVE path): next once + session cwd threaded to the resolver; static deny (bash any): deny, zero next; LAZY cwd: header rewritten between drives → resolver cwd tracks (`/a6a/ws-1` then `/a6a/ws-2`), distinct canonical keys → distinct fingerprints | the member identity; the lazy cwd (FACT 3b) |
| onObserve | all five observed stages present (canonicalized, decision, request-created, decision-arrived, guard-verdict); every row parses as a small `{ stage, callId, ... }` record | the diagnostics contract |
| ref contract | same object returned; unfilled at construction + filled pre-boot → installs (lazy read); member B still 0; fail-closed: unfilled ref → boot rejects with the typed code + session/instance in the message + observation row + boot stopped at root (no member created) | the teamToolsRef-pattern contract; the fail-closed choice |

## 5. Deviations from the brief

1. **FACT 3b vs the A5 handoff note**: the A5 report §9 said "session cwd =
   `exec.agent.session.header.cwd` captured at install (R1)". The A6 closure
   reads the header LAZILY at resolve time instead. Rationale: (a) the seam
   is a plain function and the upstream file tools read the same header at
   call time, so the lazy read matches the production basis exactly; (b) a
   capture-at-install would freeze the cwd for the whole agent lifetime
   (a resumed/updated header would stop being authoritative); (c) A5's R2
   cache makes the per-call read cheap for exact rules anyway. The a6a
   lazy-cwd leg pins the behavior. No A5 source changed (the closure is A6's).
2. **Testkit after = 124/0** (the brief estimated "125/0 or 126/0"): the pin
   update is in-place (no new `it`), and the A5 report §6 records the A5
   after-state as 124/0 — the count is stable. Proof both ways (see §6):
   old pin + new tree → 123/1 (exactly the pin test fails); new pin → 124/0.
3. **`createTeamProductionRoot` param made REQUIRED** (`controlServiceRef`):
   mirrors the `teamToolsRef` precedent; the only caller is `host.ts`
   (verified — no test calls the root constructor directly). The p8s5a host
   entry exercises it (3/3 + 7/7, §6).
4. No other deviations: the A5 API is consumed verbatim (same param names,
   same action name, same scope fields), the alpha.1 wiring order is
   untouched, and no frozen A1–A5 source was modified.

## 6. Gates — exact commands, baseline vs after

All commands from the worktree root
`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2-a6`.

| Gate | Command | Baseline (3a4304c) | After |
| --- | --- | --- | --- |
| install | `pnpm install --ignore-scripts` | — | EXIT=0 (no dependency changes) |
| runtime suite | `node scripts/run-tests.mjs runtime` | a2 30 PASS; a3 28 PASS; a4a 28 PASS; a5a 39 PASS; FAIL d1-member-base-tools 3/6, d1-s6-remote-v3 6/14, d1-team-ownership-index 5/16, d2-s6-ensure-root-live 5/10, d3-member-identity-context 1/5, d5-instance-contract 2/9 + plain-node process abort at `d5-instance-contract.test.ts:109` (`toHaveLength` shim gap — no final summary line; file-level comparison is the contract) | IDENTICAL + **a6a-production-wiring 37 PASS** — the only delta in the file-level diff (zero NEW failures); same abort, same position (logs: baseline/after-`runtime-runtests.log`) |
| abort-tail spot checks | `node` single-file runner (the tail never executes under the runner, baseline OR after — verified individually after the edits) | (not run under the runner) | t4a-capability-wiring 27/27; p8s3b-result-effects 16/16 (real glue WITHOUT controlServiceRef — the optional dep is behavior-inert); p8s5a-host-loadability 3/3; p8s5a-production-assembly 7/7 (the real host entry over the new REQUIRED root param); p8s3-work-chain 12/12 |
| typecheck | `pnpm typecheck` (full repo) | — | EXIT=0, every package "Done" (final tree, after all edits) |
| build | `pnpm build` | — | EXIT=0 (all packages "Done") |
| composition build | `pnpm build:composition` (place-dist-glue + client composition + artifact check) | — | the first pass reports the 8-file content drift (expected — the fresh build of the three hotspots); after `git add packages/runtime/dist`: **check-artifacts-committed EXIT=0 — "OK: 1080 files; committed install-surface artifacts match the fresh build"** |
| testkit suite (pin) | `node scripts/run-tests.mjs testkit` | 124/0 at the int tip (A5 report §6); with the NEW tree but the OLD pin (stash proof): 123/1 — exactly the pin test fails | **124/0** (pin 665→666, entry (g) A6) |
| scanner verification | `scanSessionEventVocabulary()` (the committed scanner, unchanged) | 665 files, 15 frozen-quarantine hits | **666 files** (`642+10+1+7+1+2+2+1`), the a6a file in the scan list with **0 denylist hits**, the frozen quarantine UNCHANGED at 15 hits (log: `p4t6-scan-verification.log`); scanner `.mjs` byte-unchanged (`git status` clean for it) |

Evidence logs: `dev/agent-workflow/evidence/alpha2-permission/a6/`
(`baseline-runtime-runtests.log`, `after-runtime-runtests.log`,
`after-testkit-runtests.log`, `p4t6-scan-verification.log`,
`wiring-map.md`, this report).

## 7. Red-line status

| Red line | Status |
| --- | --- |
| CORE PATCH BUDGET = 0 (no `references/**` edits) | KEPT — zero changes under `references/` |
| A1–A5 sources READ-ONLY | KEPT — `git status` shows no change under `packages/domain/**`, `packages/runtime/operation-permission/**`, `packages/runtime/control/**` |
| No upstream edits, no new dependencies | KEPT — `pnpm install --ignore-scripts` clean; no `package.json` change |
| Legacy/alpha.1 behaviorally unchanged | KEPT — the absent-permissions legs (zero listeners on all three alpha.1 agents) + t4a 27/27 + the alpha.1 capability-wiring assertions |
| No push | KEPT — local commit only |
| One task = one branch = one worktree, single writer | KEPT — `task/alpha2-a6-production-wiring` in `.worktrees/alpha2-a6` |
| Source + tests + dist + evidence in one commit | KEPT — single task commit |
| Working tree ends clean | KEPT — transient `.tmp-a6a-run.mjs` / `.tmp-a6a-scan.mjs` + the untracked `a6-brief.md` removed before commit |
| Scanner `.mjs` byte-unchanged | KEPT — only the pin value + the DEC-1 (g) comment in the test changed |

## 8. V1 readiness

A6 is COMPLETE. The production agent lifecycle now composes the frozen
A1–A5 chain end to end: a team whose templates declare `capabilities.
permissions` gets exactly one `tools/pre-execute` enforcement listener per
permitted agent, routed over the durable A4 control plane (leader →
`user-approval`, member → `leader-approval`, exact fingerprint scope,
check-and-reserve last mile), failing closed and zero-effect on every
non-allow path, with the legacy/alpha.1 world byte-for-byte unchanged
(absent policy = the ref is never read and no listener is installed). The
remaining verification for the V1 gate is the L4 smoke on a REAL host (the
lazy cwd read against the real `SessionHeader.cwd`, per the fact rulings
above) — nothing in A6's seam depends on the bridge doubles for that step.
