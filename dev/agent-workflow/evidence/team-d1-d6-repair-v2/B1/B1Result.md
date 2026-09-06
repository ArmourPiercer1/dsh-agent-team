# B1 — D1: member base tools via `agentPresets.mount` on member bind paths (v2)

**Task**: B1 (Wave B, D1 fix of Team D1-D6 repair v2)
**Attempt**: 1
**Branch/worktree**: `task/team-d1-d6-v2-B1` / `.worktrees/team-d1-d6-v2-B1` (base `0b968d7`)
**Elapsed**: ~15 min (started 2026-09-07T01:20:27+08:00)
**Model route verification**: runtime declaration states model `qwen3.8-27b`; in the host config
(`C:\Users\user\.dsh\settings.yaml:3-5`) `agent-default-model` is `qiyuan-self` / `qwen3.8-27b` and the
model id is offered exclusively by provider `qiyuan-self`. Full route `qiyuan-self/qwen3.8-27b` —
**verified OK**.

## Verdict

**PASS** — no blocker (seam fully public per A1 verdict `public_composition_seam = yes`; no upstream
touch; no private API). TDD red→green honored; full runtime suite green; typecheck + lint green.

## What changed

1. **`packages/runtime/src/plugin/types.ts`** — `TeamPluginConfig` gains
   `readonly memberPresetId?: string` (undefined = deployment default preset; the glue then calls
   `mount(agentCtx, undefined)`, which upstream resolves to `defaultId`).
2. **`packages/runtime/src/plugin/host.ts`** — the glue is given the `agentPresets` public service as an
   **additive OPTIONAL dep**, LAZY (per-call `ctx.get('agentPresets')`) accessor in the same style as the
   existing `sessionPersistence` wrapper. It is passed into `glue.createAgentBindings({ ..., agentPresets })`
   but deliberately NOT added to the hard-inject array (a host without the service still boots; the
   accessor throws the stable typed error only when a MEMBER setup actually needs it). The accessor
   throws `TeamPluginError(TEAM_PLUGIN_SERVICE_MISSING, ...)` if the service is absent or lacks a callable
   `mount`. `validateTeamPluginConfig` rejects a non-string (or empty) `memberPresetId`.
3. **`packages/runtime/src/plugin/live/agent-bindings.mjs`** — destructures `agentPresets` from deps; in the
   SHARED `agentSetup` closure, ONLY on the member bind paths (`fresh-member` / `cold-member`), AFTER the
   model-selection install and BEFORE the team-tools loop (order per A1: installSelection → mount → own
   registrations):
   - service present → `await agentPresets.mount(agentCtx, config.memberPresetId)` (undefined id passes
     through to the upstream default resolution);
   - service absent (or lacks `mount`) → throws the NEW typed error
     `code: 'member-base-tools-unavailable'` (message prefix `agent-bindings:`, `observations.push` — the
     same fail-closed pattern as the existing `recursive-drain-unavailable`). Per the `AgentSetup` contract
     (A1 Q1), a setup rejection rolls the unpublished agent back — so a member NEVER comes up base-tool-less.
   - ROOT bind paths (`fresh-root`, `cold-root`) do NOT mount (v2 scope: root unchanged).
4. **`packages/runtime/test/t12a-live-bridge.mjs` + `.d.mts`** — the bridge world gains an
   `agentPresets: createAgentPresetsDouble()` option. The recording double stores
   `mounts: [{ agentCtx, presetId }]` per call and supports a `mountBehavior: 'reject'` option. The `.d.mts`
   (the `.mjs`'s type surface) is edited as part of the same test-double unit: without it the runtime
   package `typecheck` (tsc over `src` + `test`) cannot pass, and GREEN requires it.
5. **`packages/runtime/test/d1-member-base-tools.test.ts` (new)** — 6 tests over the real
   `agent-bindings.mjs` in the t12a-live-bridge world, with the REAL ten-tool stack (`createP6T6World`) on
   the member worlds:
   - D1-1 member create mounts exactly once with the configured `memberPresetId`; root never mounts;
   - D1-2 `memberPresetId` undefined → `mount(agentCtx, undefined)` (deployment default);
   - D1-3 root create (fresh-root) and root resume (cold-root boot + cold re-attach) never call mount;
   - D1-4 cold-member resume mounts exactly once per agent lifecycle (drop residency, `ensureLiveAgent`
     again → one more mount, no double registration within a lifecycle);
   - D1-5 absent service on the member path fails closed with the typed error
     (`member-base-tools-unavailable`, stable code — boot rejects, no base-tool-less member);
   - D1-6 the ten `team_*` tools are still registered on the member row (frozen vocabulary, closed set) and
     the root tool table is unchanged (guard against the mount ever replacing team registration).

## TDD evidence (transcripts in this directory)

**RED** — `pnpm vitest run test/d1-member-base-tools.test.ts` BEFORE the glue/host/types change
(`red-d1.txt`): the new file ran against the UNCHANGED glue; the double was already wired into the bridge
world but nothing ever called `mount`:

```
❯ test/d1-member-base-tools.test.ts (6 tests | 5 failed)
     × D1-1 member create: mount exactly once for the member with the configured memberPresetId; the root never mounts
     × D1-2 memberPresetId undefined: mount is called with NO id (the deployment default)
     × D1-3 root create/resume never call mount (fresh-root world A; cold-root boot + cold re-attach world C)
     × D1-4 cold-member resume mounts exactly once per agent lifecycle (no double registration)
     × D1-5 absent service on the member path fails closed with the typed error (no base-tool-less member)
     ✓ D1-6 the ten team_* tools are still registered on the member row (no regression; root unchanged)
AssertionError: expected +0 to be 1 // Object.is equality   (world.agentPresets.mounts.length === 0)
Test Files  1 failed (1)
     Tests  5 failed | 1 passed (6)
```

**GREEN** — same command AFTER the change (`green-d1.txt`):

```
✓ test/d1-member-base-tools.test.ts (6 tests)
Test Files  1 passed (1)
     Tests  6 passed (6)
```

**Mandatory regression subset** — `pnpm vitest run test/tcm-d4-root-context.test.ts test/d5-instance-contract.test.ts`
(`regression-subset.txt`):

```
✓ test/d5-instance-contract.test.ts (5 tests)
✓ test/tcm-d4-root-context.test.ts (7 tests)
Test Files  2 passed (2)
     Tests  12 passed (12)
```

`d5-instance-contract.test.ts` needed no edit (it has no member bind path). `tcm-d4-root-context.test.ts`
is the mandated regression: its boot-root member now goes through the mount — the double records one mount
with the deployment-default id, and all 7 D4 assertions (root context block, ten-tool registration,
caller resolution) still pass byte-for-byte, proving the mount composes IN ADDITION to the team
registration.

**Full runtime suite** — `pnpm vitest run` (`full-suite-green.txt`; the pre-wiring run
`full-suite-after-change.txt` shows the 8 expected file-level failures, all
`agent-bindings: member base tools unavailable ... (code: member-base-tools-unavailable)`, i.e. the new
fail-closed semantics correctly firing on member-driven worlds that lacked the double):

```
Test Files  128 passed (128)
     Tests  1174 passed (1174)
```

**Typecheck** — `pnpm --filter @dsh-agent-team/runtime typecheck` (tsc -p tsconfig.json, src+test):
exit 0 (`typecheck.txt`). **Lint** — eslint over the full changed set: 0 errors / 0 warnings.

**One environment note** (not a test defect): after the first (pre-wiring) full-suite run aborted two
files mid-setup, their gitignored scratch dirs
(`packages/testkit/test/.tmp-fault/{t12a-team-tools-reg,tcm-d4-root-ctx}`) held a stale `team_domain`, so
the next run's `createTeamDomain` rejected with `team_domain already exists` — the same scratch-leftover
pattern the M2 precedent documents. Deleting the stale scratch dirs (tests own/clean their own scratch)
made the suite green; no test code was affected.

## Changed files (all in the worktree)

Owned source (the task's owned files):
- `packages/runtime/src/plugin/types.ts` (config field)
- `packages/runtime/src/plugin/host.ts` (lazy accessor + glue dep)
- `packages/runtime/src/plugin/live/agent-bindings.mjs` (member-path mount + typed fail-closed)

Test files (new + edited, within write scope):
- `packages/runtime/test/d1-member-base-tools.test.ts` (new)
- `packages/runtime/test/t12a-live-bridge.mjs`, `packages/runtime/test/t12a-live-bridge.d.mts` (bridge
  double + its type surface)
- Mechanical `createAgentPresetsDouble()` wiring (import + one option line, M2 precedent: host-entry test
  worlds gain the minimal stub) into the 8 member-driven worlds whose boot now legitimately requires the
  service: `t12a-b2-child-identity.test.ts`, `t12a-b3-external-deny.test.ts`,
  `t12a-h1-nullable-mcp.test.ts` (member world only — the root-only control world stays unchanged),
  `t12a-m1-effective-cwd.test.ts`, `t12a-m2-persona.test.ts` (world A only — D/E/F are root-only),
  `t12a-m3-recursive-drain.test.ts` (the shared `buildWorld` helper),
  `t12a-team-tools-registration.test.ts` (world A only — world B is root-only resume),
  `tcm-d4-root-context.test.ts` (the mandated regression world).

Build artifacts (R131 discipline; M2 precedent `7444932` "runtime dist regenerated from the new source" —
source changes ship with their rebuilt dist mirror in the SAME commit; `packages/runtime/dist` is a
committed install surface per `.gitignore: !packages/runtime/dist/`):
- `packages/runtime/dist/.../host.js`, `host.js.map`, `host.d.ts.map`
- `packages/runtime/dist/.../types.d.ts`, `types.d.ts.map`, `types.js.map`
- `packages/runtime/dist/.../live/agent-bindings.mjs` (placed byte-identically by
  `node scripts/place-dist-glue.mjs` — verified `equals()` true against source)

Rebuild commands used: `pnpm --filter @dsh-agent-team/runtime build` (tsc -p tsconfig.build.json) then
`node scripts/place-dist-glue.mjs` from the worktree root. No other package's dist changed
(`git status` shows only the runtime dist mirror).

Evidence: this file + `red-d1.txt`, `green-d1.txt`, `regression-subset.txt`, `full-suite-after-change.txt`,
`full-suite-green.txt`, `typecheck.txt`.

## 3180-host regression recipe for the G2 gate (WRITE only — NOT executed this wave)

Precondition: this commit has been cherry-picked onto the int branch, passed the gate, and is merged into
master (no host instance is run in this wave; `references/` is untouched — pristine upstream
`76fda72979` with an empty `git status --porcelain`, verified 2026-09-07).

**Step 1 — point the 3180 world at the B1-built artifacts (mechanical, per A1).**
The test world's profile `references/.dsh-test/profiles/web/cordis.patch.yml` pins the MAIN checkout's
built artifacts by absolute file URL:
`host.js` → `file:///D:/AgentDev/dsh-plugins/dsh-agent-team/packages/runtime/dist/packages/runtime/src/plugin/host.js`
and `glueUrl` → `.../dist/packages/runtime/src/plugin/live/agent-bindings.mjs`.
So after the merge, rebuild the main checkout and the pinned URLs automatically serve B1:

```powershell
cd D:\AgentDev\dsh-plugins\dsh-agent-team
git checkout master                      # post-gate merge
pnpm install --ignore-scripts
pnpm setup                               # = pnpm build (all 9 packages) && pnpm build:composition
                                         #   (dist glue placement + client composition + check-artifacts-committed)
# sanity: packages/runtime/dist/.../live/agent-bindings.mjs contains the member-path
# `agentPresets.mount` block; the host.js contains the lazy agentPresets accessor.
```

**Step 2 — boot the 3180 test host** (TEST_METHODS.md §2, verbatim chain; stable instance :3080 must
remain untouched):

```powershell
cd D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use
pnpm install --ignore-scripts            # first use only (already installed 2026-09-06)
$env:DSH_CLIENT_COMMIT_HASH = '76fda72979'
$env:ESBUILD_WORKER_THREADS = '1'
node scripts/build.ts
$env:DSH_HOME = 'D:/AgentDev/dsh-plugins/dsh-agent-team/references/.dsh-test'
node apps/cli/lib/bin.js web --port 3180 --no-open
# success line: `dsh web: http://127.0.0.1:3180/?token=...`
```

The web front-end bundle `apps/web/dist` already exists in the test-use checkout (built 2026-09-06 by the
Playwright acceptance worker; gitignored), so the UI is drivable; if it is stale/missing, rebuild once per
TEST_METHODS.md §2 note 3 (`pnpm run build:web`, registered in the G2 evidence).

**Step 3 — drive ONE real member turn (the D1 acceptance).** In the 3180 web UI (the `dsh-agent-team`
row config in the pinned profile already defines blueprint `my-team-bp-1` with leader + worker template,
`staticModel: qiyuan-self/qwen3.8-27b`, `defaultWorkspace: D:/AgentDev/dsh-plugins/dsh-agent-team`):
open the Team root session (its agent carries the ten `team_*` tools), then send the leader a turn such as:
*"Ask Worker A to read `D:/AgentDev/dsh-plugins/dsh-agent-team/README.md`, quote its first line, and run
`pwd`. Report back what it found."* The leader is expected to `team_create_member` (if no live member) and
`team_delegate` the task to Worker A.

**Step 4 — assertions (record all in G2 evidence).** In the MEMBER session's durable log under
`references/.dsh-test` (dsh-session log):
1. a **successful file-read tool call** from the member (from the mounted `standard` preset —
   `@deepseek-ai/dsh-tool-fs`): the result contains the real file content, not a model guess;
2. a **successful shell `pwd` call** (the preset's win32 shell tool `@deepseek-ai/dsh-tool-pwsh`): the
   result is the member's effective workspace path — this is the D1 diagnostic's failing probe
   (`docs/local-issues/team-member-missing-base-tools.md`);
3. at least one **successful `team_*` tool call** in the same member session (e.g. `team_report_progress`) —
   ordinary tools and team tools coexist in one tool table;
4. the member's model-visible tool table = ordinary preset tools **+** the ten team tools (the v1 bug was
   team-tools-only);
5. controls: the root/leader tool table is unchanged (v2 scope leaves root alone), and an ordinary
   non-Team session's tool table is unchanged.
   (The exact model-visible tool names are read off the session log — the `standard` preset composes
   shell (`dsh-tool-pwsh` on win32), filesystem (`dsh-tool-fs`, `dsh-tool-fs-search`), jobs, skills,
   web, todo, ask-user, subagent/workflow rows; assert on the SUCCESSFUL calls above, not on a frozen
   name list.)

**Step 5 — teardown & hygiene.** Stop the managed background job; `references/deepseek-harness-test-use`
`git status --porcelain` empty; stable `:3080` still 200 and untouched.

## Scope-interpretation decisions (documented for the gate)

1. `t12a-live-bridge.d.mts` (the bridge double's committed type surface, `.gitignore:
   !packages/runtime/test/t12a-live-bridge.d.mts`) was edited as part of the test-double unit: it declares
   the same options/members the `.mjs` gained, and the runtime package typecheck (tsc over `src`+`test`)
   would fail without it — GREEN requires it.
2. The 8 test files' worlds were wired with `createAgentPresetsDouble()`: the mandatory fail-closed member
   semantics (service absent → typed setup rejection) is the spec'd behavior, so every pre-existing
   member-driven world must provide the service. This is the M2 precedent verbatim ("17 host-entry test
   worlds gain the minimal stub registry") — mechanical one-line wiring, no assertion changes.
3. Rebuilt `packages/runtime/dist/` ships in the same commit: it is the committed plugin install surface
   (`.gitignore` re-includes it; the 3180 profile mounts the dist `host.js`/glue directly), and the M2
   precedent (`7444932`) established same-commit dist regeneration. Only the runtime mirror changed.

## Remaining risks / follow-ups

- **G2 (this wave's explicit gate)**: the real-host verification above is documented, not executed — a
  member turn on a live `standard`-preset mount has not been observed end-to-end. Unit+integration evidence
  (real glue over doubles, real ten-tool stack) covers the logic; the host covers the actual preset
  composition (persona/shell/fs rows) and the real model's tool availability.
- `memberPresetId` default = deployment default (`standard` in the web bundle). A deployment whose default
  preset lacks file/shell tools would hand members that preset — config-visible, no code guard by design.
- Root agents still have no ordinary preset tools (v2 scope; the D1 diagnostic's root probe stays as-is by
  design — a later wave may extend the same seam to `fresh-root`/`cold-root` if the plan wants it).
- Timebox headroom: finished ~15 min into a 75-min budget.
