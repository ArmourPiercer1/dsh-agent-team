# A2 — D3 member identity prompt seam + dependency proof (v2)

- task_id: A2
- model_route: qiyuan-self/qwen3.8-27b (verified — see §0)
- base_sha: 2baad2f (docs: P0-v2 baseline for Team D1-D6 repair v2)
- branch: task/team-d1-d6-v2-A2
- worktree: .worktrees/team-d1-d6-v2-A2
- status: DONE
- product_changes: none (read-only; only this evidence file created)
- seam_verdict: yes
- blocker_type: none
- elapsed_minutes: 10

## 0. Model route verification (ROUTER_RULES §1.4)

Runtime declaration of this session: "powered by the qwen3.8-27b model".
Composition check (read-only, stable instance home):
- `C:\Users\user\.dsh\settings.yaml` → `agent-default-model: {provider: qiyuan-self, model: qwen3.8-27b}`; provider `qiyuan-self` registers model `qwen3.8-27b`.
- `C:\Users\user\.dsh\profiles\web\cordis.yml` → no model/route override lines.
- Session preset `small-ctx-create` (`C:\Users\user\.dsh\.agent-presets\small-ctx-create\agent.cordis.yml`) → persona uses `{{model}}` resolved from the agent's own route; no `modelPolicies` override.
- Resolved route: **qiyuan-self/qwen3.8-27b — PASS**. No model mismatch; no stop.

## 1. Seam verdict

`seam_verdict: yes` — the D3 member identity block inserts at exactly one public
composition point: the member branch of `getPersonaSlot().promptSurface.installScopedPersona`
in `packages/runtime/src/plugin/live/agent-bindings.mjs`. Every field of the v2
context block (plan §8 B2) is available in the `identity` object at that branch;
nothing is missing, no global registry is needed. The test dependency chain
(`pnpm install --ignore-scripts` → vitest → `yaml` resolvable) **works in a fresh
worktree** — the v1 `Cannot find package 'yaml'` failure does NOT reproduce (§4).

## 2. Insertion point with lines (base 2baad2f)

File: `packages/runtime/src/plugin/live/agent-bindings.mjs` (1611 lines at base).

- `getPersonaSlot()` — lines 690–740. Builds the persona overlay slot over the
  blueprint (`parseBlueprint`) and the preset substrate; passes `promptSurface`
  into `createPersonaOverlaySlot` (line 694, imported line 165 from
  `../../../agent-setup/persona/index.js`).
- `promptSurface.installScopedPersona: (sessionId, identity) => { ... }` — **lines 714–736**.
  This is the slot's REAL install callback (the resolver's `apply` reaches it via
  `adapter.apply` → `this.promptSurface.installScopedPersona(target.sessionId, identity)`,
  `packages/runtime/agent-setup/persona/adapter.ts:250`).
  - line 715: `const agentCtx = liveAgentCtxs.get(String(sessionId))`
  - lines 716–718: no live ctx → throw (slot installs only at setup time)
  - line 728: `const sid = String(sessionId)` — for a MEMBER this is the CHILD
    session id, NOT the root
  - **lines 729–734: the `identity.kind === 'root'` branch** — appends
    `rootTeamContextBlock(sid)` to the persona text and registers a spread copy:
    ```js
    const base = String(identity.personaText ?? '')
    const combined = base === '' ? rootTeamContextBlock(sid) : `${base}\n\n${rootTeamContextBlock(sid)}`
    registerPersonaSection(sid, agentCtx, { ...identity, personaText: combined })
    ```
  - **line 735: the member branch — `registerPersonaSection(sid, agentCtx, identity)`**
    — the EXACT insertion point. B2 mirrors the root-branch pattern here:
    compose `memberTeamContextBlock(identity.rootSessionId, identity.instanceId)`
    and register `{ ...identity, personaText: combined }`.
- `registerPersonaSection(sessionId, agentCtx, identity)` — lines 621–641:
  re-install disposes the previous scoped entry for the same session first
  (lines 623–627), so repeated installs converge to exactly one
  `deployment:persona` scoped section (line 633–637: `systemPrompt.section({name: 'deployment:persona', order: 0, text})`).
- `rootTeamContextBlock(rootSessionId)` — lines 753–760 (the root analog B2 mirrors;
  note its UNQUOTED `rootSessionId=${...}` style — the B2 spec block uses QUOTED
  attribute values, §3).
- `installPersonaForSetup(sessionId, instanceId, templateIdHint, bindPath, teamRootSid)` —
  lines 776–811: builds the `target` the resolver turns into the identity:
  - line 790 (root): `target = { kind: 'root', sessionId: teamRoot, rootSessionId: teamRoot, instanceId: LEADER_INSTANCE_ID }`
  - line 800 (member, committed row): `target = { kind: 'member', sessionId, rootSessionId: membersRoot, instanceId: String(row.instanceId) }` with `membersRoot = teamRoot ?? rootSid` (line 796); row found by `childSessionId` (line 798)
  - line 804 (member, fresh-create window): `target = { kind: 'member', sessionId, rootSessionId: membersRoot, instanceId }` — `instanceId` is the hint bridged from the child factory (`instanceIdHint`, lines 890–905 / `resolveConsumptionViews` lines 397–448)
  - line 807: member with neither row nor hint → throw (fail closed — preserved by B2)
  - line 810: `slot.apply({ target, record, path: bindPath })`
- Callers: `agentSetup` (line 575, shared create/resume setup), `boot()` create
  phase line 999–1007 (boot-root seeded members, no teamRootSid → boot root),
  `childFactory.createChildSession` lines 914/933 (fresh/cold member under the
  REQUEST's owning root), `ensureLiveAgent` lines 833–842 (cold resume under
  `teamRootOfSession(sessionId)`, lines 342–374), `createRootAgent` lines 1215/1224.

### Identity object available at line 735 — every field with its source line

The `identity` is the `ScopedPersonaIdentity` frozen by
`buildScopedIdentity` (`packages/runtime/agent-setup/persona/adapter.ts:184–206`;
type: `packages/runtime/agent-setup/persona/types.ts:58–71`):

| field | member value at the branch | source line(s) |
|---|---|---|
| `kind` | `'member'` (union `'root' \| 'member'`) | adapter.ts:199 ← agent-bindings.mjs:800/804 |
| `rootSessionId` | the OWNING durable team root (threaded `teamRootSid`, else boot `rootSid`) | adapter.ts:200 ← agent-bindings.mjs:796/800/804 |
| `instanceId` | the member's durable/hint instance id — ALWAYS present for members (both member-target branches set it) | adapter.ts:201 (conditional spread; condition true for members) ← agent-bindings.mjs:800 (`String(row.instanceId)`) / :804 (hint) |
| `presetId` | inherited root substrate preset id | adapter.ts:202 ← agent-bindings.mjs:698/604–609 |
| `personaOrigin` | literal `'blueprint'` | adapter.ts:203 |
| `personaText` | the blueprint member-template persona prose (verbatim) | adapter.ts:194/204 ← agent-bindings.mjs:702–708 (`getMemberPersona`) |

`deepFreeze`d (adapter.ts:198) → **B2 must not mutate it**; the root branch's
`{ ...identity, personaText: combined }` spread (line 732) is the pattern to copy.

## 3. v2 context block (plan §8 B2) constructibility

```text
[team-member-context rootSessionId="<root>" instanceId="<instance>" role="member"]
Every team_* tool call must include rootSessionId="<root>" and a fresh unique requestToken; do not use another team's rootSessionId or another member's instanceId.
```

| block field | source at line 735 | available? |
|---|---|---|
| `rootSessionId` | `identity.rootSessionId` | yes |
| `instanceId` | `identity.instanceId` | yes (always set for members) |
| `role` | literal `'member'` (branch is reached iff `identity.kind !== 'root'`; union is exhaustive) | yes |
| requestToken rule | static text | yes |

**Fully constructible — no field missing.** Pitfalls for B2:
1. Frozen identity → spread-copy, never mutate (root-branch pattern, line 732).
2. The block must use `identity.rootSessionId` (the OWNING root), NOT the `sid`
   parameter (line 728) — for a member `sid` is the child session id. Using `sid`
   would silently break cross-root members.
3. Empty `personaText` case: mirror line 731 (`base === ''` → block alone).
4. Byte format: the B2 spec uses QUOTED attribute values
   (`rootSessionId="<root>"`), unlike `rootTeamContextBlock`'s unquoted style
   (lines 755–758) — follow the B2 spec; the red test asserts byte-identity.
5. Fresh-create window: `instanceId` is the hint (exact value the activation flow
   commits moments later, lines 891–896) — the block is consistent fresh vs resumed
   by construction (same provenance as C1's `fresh_resume_consistent: yes`).

## 4. Dependency proof (the v1 `yaml` failure) — transcript

Exact command sequence (all in this session, 2026-09-08 local time):

```text
# repo root D:\AgentDev\dsh-plugins\dsh-agent-team
git worktree add .worktrees/team-d1-d6-v2-A2 -b task/team-d1-d6-v2-A2 2baad2f
# → OK, 5482 files, branch task/team-d1-d6-v2-A2 @ 2baad2f

# inside .worktrees\team-d1-d6-v2-A2 (FRESH worktree, no node_modules before)
pnpm install --ignore-scripts
# → EXIT=0, duration 68.1s (1m 7.5s, pnpm v11.7.0)
# → "Progress: resolved 463, reused 463, downloaded 0, added 463, done"
# → devDependencies: @eslint/js 9.39.5, eslint 9.39.5, globals 16.5.0,
#   typescript 6.0.3, typescript-eslint 8.68.0, vitest 4.1.11

pnpm exec vitest run packages/runtime/test/tcm-d4-root-context.test.ts
# → EXIT=0
# → RUN v4.1.11 D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/team-d1-d6-v2-A2
# → ✓ packages/runtime/test/tcm-d4-root-context.test.ts (7 tests) 3ms
# → Test Files 1 passed (1) / Tests 7 passed (7)
# → Duration 891ms (transform 444ms, setup 0ms, import 777ms, tests 3ms)
```

Findings:
- The v1 failure recorded in `dev/agent-workflow/evidence/team-d1-d6-repair/T2-d3-status.md`
  ("Vitest failed before collection with `Cannot find package 'yaml' imported from
  packages/domain/blueprint/src/parse.ts`" in a fresh worktree) **does not
  reproduce**: the test transitively imports the contracts/domain blueprint parse
  (which imports `yaml`), and collection + all 7 tests passed.
- The t12a bridge self-provisioned its four `@deepseek-ai/*` junction links into the
  worktree `node_modules` during the run (dsh-agent, dsh-session, dsh-llm,
  dsh-mcp-client → `references/deepseek-harness-test-use` workspace packages;
  gitignored local env provisioning per `t12a-live-bridge.mjs:12–20, 72–84`).
  The test-use checkout's own `node_modules` is present; test-use was READ-ONLY
  (never written).
- Worktree `git status --porcelain` after the run: only this task's two transient
  log captures (removed before commit) — no product/test files touched.
- **Conclusion: B2 can assume the install+run chain in a fresh worktree; no
  TEST_INFRA_BLOCKER.** Plan §4 DAG constraint ("A2/B2 若依赖安装仍失败…") satisfied:
  install succeeded, tests actually ran (never marked PASS without running).

## 5. RED-test recipe for B2

**New vitest file**: `packages/runtime/test/d3-member-identity-context.test.ts`
(TypeScript, same import pattern as `tcm-d4-root-context.test.ts`).

**World construction** (t12a-live-bridge doubles over the REAL glue):
- `createLiveWorld({...})` — `t12a-live-bridge.mjs:423–513`. Options used:
  `rootSessionId`, `members` (boot-root rows), `membersByRoot` (non-boot roots),
  `teamSessions` (multi-root durable rows), `configOverrides: { mcpServer: null,
  seedMembers: [WORKER] }` (seeded boot-root member created by `boot()` at
  agent-bindings.mjs:995–1010). Bridge defaults include a valid closed-v1
  `blueprintSource` with member template `t12a-worker`
  (persona "You are member t12a-worker of the t12a test team.", bridge:453–472).
- Second root N + real ten-tool stack: copy the tcm-d4 world pattern
  (`tcm-d4-root-context.test.ts:128–184`): `createP6T6World` + durable
  `teamSessions.put`/`sessionBindings.put` for N + `createTeamTools({...,
  resolveCaller: world.binding.resolveCaller})` → `world.teamToolsRef.current` →
  `await world.binding.boot()` → `await world.binding.createRootAgent(N)`.

**Observing the scoped persona text** (the t12a-live-bridge helper API):
- Handle/ctx: `world.agents.handles.get(sessionId)!.agent.ctx` — the agents double
  (`t12a-live-bridge.mjs:211–274`; `makeHandle` lines 227–253 exposes
  `{ session, ctx, followup, whenIdle, cancel }` on `agent`, the handle on the map).
- The ctx double's `systemPrompt` builtin (`t12a-live-bridge.mjs:110–149`):
  `section(spec)` registers an agent-scoped section (duplicate scoped names in
  one scope THROW, lines 125–128 — double registration surfaces loudly);
  `assemble()` returns `{name, order, text, scope}[]` where scoped sections
  shadow same-named globals (lines 141–148).
- Helper (verbatim from `tcm-d4-root-context.test.ts:116–120`):
  ```ts
  function scopedPersona(ctx: AgentCtxDouble): AssembledPromptSection | undefined {
    return ctx.systemPrompt.assemble().find(
      (section) => section.name === 'deployment:persona' && section.scope === 'scoped',
    )
  }
  ```
  Note: the bridge does NOT export the `AgentCtxDouble`/`AssembledPromptSection`
  types (tcm-d4's `import type` from the `.mjs` is erased at runtime); the new
  test should declare minimal local structural types or use the values directly.
- **Snapshot live reads BEFORE the file's `close()`** (tcm-d4 pattern, lines 189–199:
  `it()` bodies run after top-level setup; disposed registrations would empty the
  sections).

**Expected block constant** (must stay byte-identical to the B2 implementation):
```ts
const memberContext = (root: string, instanceId: string): string =>
  `[team-member-context rootSessionId="${root}" instanceId="${instanceId}" role="member"]\n` +
  `Every team_* tool call must include rootSessionId="${root}" and a fresh unique requestToken; do not use another team's rootSessionId or another member's instanceId.`
```

**The 5 required assertions**:
1. **Fresh member block present** — boot-seeded member (and/or a
   `childFactory.createChildSession({ rootSessionId: N, instanceId, templateId })`
   fresh-window member under N — agent-bindings.mjs:881–937, hint path before the
   MemberInstance row commits):
   `scopedPersona(workerCtx)!.text === \`${MEMBER_PERSONA}\n\n${memberContext(BOOT, WORKER.instanceId)}\``
   and `order === 0`.
2. **Cold resume block present** — the tcm-d4 D4-6 pattern
   (`tcm-d4-root-context.test.ts:260–278`): `world.binding.dropResidency(child)` →
   `withDshHome(home, …)` + `writeDurableFixture(home, child)` (bridge:523–552) →
   `world.binding.sessionInput.submitAttributedInput({sessionId: child, …})`
   (triggers `ensureLiveAgent` → `agents.resume` with the shared setup under the
   owning root, agent-bindings.mjs:820–849) → `removeFixtureHome(home)` → assert
   the resumed ctx's scoped persona text is byte-identical, plus
   `world.records.resumes` entry with `setupProvided: true`.
3. **Cross-root member uses its owning root** — a member under N
   (`membersByRoot: { [N]: [memberN] }` + N's `teamSessions` row; cold resume via
   `teamRootOfSession`, agent-bindings.mjs:342–374, or fresh `childFactory` under
   N): the block in that member's scoped persona carries
   `rootSessionId="${N}"` — never the boot root's id.
4. **Wrong rootSessionId rejected** (fail closed, the block never bypasses the
   closed layer) — execute the REAL tool stack through
   `runGlueTool('team_list_members', { rootSessionId: <wrong>, requestToken }, child)`
   (pattern `tcm-d4-root-context.test.ts:223–233`): unknown root →
   `status: 'rejected'` with the runtime code `TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND`
   (admission zero-writes, precedent `p6t1-explicit.test.ts:629`; runtime-error →
   rejected mapping `packages/tools/src/tools.ts:139–146`); missing rootSessionId →
   `TEAM_TOOL_BAD_ARGUMENTS` (pinned by tcm-d4 D4-3, lines 330–349); and
   `status !== 'executed'` in all cases.
5. **Repeated setup does not duplicate the section** — re-run the setup callback
   on the SAME live ctx: `await world.binding.agentSetup(child, instanceId,
   templateId, 'fresh-member', BOOT)(workerCtx)` (the public `agentSetup` factory,
   agent-bindings.mjs:543–591, is returned at line 1644) →
   `ctx.systemPrompt.assemble().filter(s => s.name === 'deployment:persona' && s.scope === 'scoped')`
   has length **1** with unchanged text (convergence by
   `registerPersonaSection` disposing the previous entry, lines 621–641; the
   double's duplicate-name throw, bridge:125–128, guards the other direction).

**Run command** (fresh worktree): `pnpm install --ignore-scripts` then
`pnpm exec vitest run packages/runtime/test/d3-member-identity-context.test.ts`.

**Existing-test impact (B2 owns this per plan §8 B2 "对应 focused tests")**:
`tcm-d4-root-context.test.ts:372–375` (D4-4: "the member keeps the template
persona verbatim — no root context block for non-root agents", asserting
`workerPersonaAfterCreate!.text).toBe(MEMBER_PERSONA)`) is superseded by B2
semantics and MUST be updated to the new combined member text in B2.

## 6. Blocker

None. (`blocker_type: none`.)

## 7. Notes / deltas vs v1 evidence

- C1 evidence read from its original branch worktree
  `.worktrees/team-d3-c1-member-context-seam` (branch `task/team-d3-c1-member-context-seam`
  @ 66f38c7) — the file `dev/agent-workflow/evidence/team-d1-d6-repair/C1/C1-result.md`
  is NOT in base 2baad2f (v1 C1 never merged; only the 7 tracked v1 evidence files
  are). C1's seam conclusion matches 2baad2f exactly (member branch at line 735,
  same identity shape); C1's `minimal_context_fields` list is exactly the fields
  the B2 spec block needs.
- T2's caveat ("the existing source context differed from the C1 characterization
  assumptions", T2-d3-status.md line 12) was re-checked against 2baad2f: the member
  branch is still the single no-block path and the identity shape is unchanged —
  no residual divergence found.
- `docs/local-issues/team-member-context-missing-root-session.md` is untracked
  (main checkout only; gitignored area not in the worktree) — read read-only from
  the main checkout; its code-path analysis (lines 24–28) matches the base 2baad2f
  line numbers.
- v2 evidence dir state at base: `dev/agent-workflow/evidence/team-d1-d6-repair-v2/`
  contained only `P0/` at 2baad2f; this task created the `A2/` directory with this
  file (per the task card path).
