# B2 — D3 member persona branch: machine-readable team identity context block (v2)

- task_id: B2
- model_route: qiyuan-self/qwen3.8-27b (verified — runtime declaration of this session: "powered by the qwen3.8-27b model"; no override in the session preset — matches the required route, no stop)
- base_sha: 0b968d7
- head_sha: the single atomic commit of this evidence file on branch `task/team-d1-d6-v2-B2` (1 commit above base)
- branch: task/team-d1-d6-v2-B2
- worktree: .worktrees/team-d1-d6-v2-B2
- attempt: 1
- elapsed_minutes: 25
- status: DONE
- verdict: PASS
- blocker: none

## 0. Model route verification (ROUTER_RULES §1.4)

Runtime declaration of this session: "You are a coding agent powered by the
qwen3.8-27b model". No `DSH_MODEL` env override is set (DSH_* env inspected:
only HOME/SESSION_ID/SESSION_JSONL/SHELL/WEB_URL), so the session resolves the
agent default route — `qwen3.8-27b` under provider `qiyuan-self` per the
stable-instance composition (verified by A2, A2Result.md §0). Resolved route:
**qiyuan-self/qwen3.8-27b — PASS**. No mismatch; no stop.

## 1. Changed files (write scope)

| File | Role |
|---|---|
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | owned — the member branch of `getPersonaSlot().promptSurface.installScopedPersona` (the exact seam A2 §2 / C1 pinpointed) + new `memberTeamContextBlock` helper |
| `packages/runtime/test/d3-member-identity-context.test.ts` | NEW — D3-1…D3-5 behavior tests (A2 red-test recipe) |
| `packages/runtime/test/tcm-d4-root-context.test.ts` | owned — D4-4 negative assertion updated per the A2 recipe (member keeps the template persona verbatim, now prefixed by the member block; the ROOT block must not leak into the member branch) |
| `packages/runtime/test/t12a-m2-persona.test.ts` | test file updated beyond the named list — M2-1/M2-3 pinned the exact v1 behavior this task supersedes; see §5 risk R2 |
| `dev/agent-workflow/evidence/team-d1-d6-repair-v2/B2/B2Result.md` | this evidence file |

## 2. The exact context block (substituted, not reworded)

The task-card block template, verbatim (`<rootSessionId>` / `<instanceId>`
substituted from the identity object at install time):

```text
[team-member-context rootSessionId="<rootSessionId>" instanceId="<instanceId>" role="member"]
Every team_* tool call must include rootSessionId="<rootSessionId>" and a fresh unique requestToken; do not use another teams rootSessionId or another members instanceId.
```

The implementation constant (`memberTeamContextBlock` in
`agent-bindings.mjs`) and the two test-file constants are byte-identical to
each other and to this template (the D3-1/D3-2/D3-3/D4-4 assertions pin the
full-text equality).

## 3. Exact diff hunk of the member branch (base 0b968d7)

File: `packages/runtime/src/plugin/live/agent-bindings.mjs`

```diff
@@ -724,7 +724,8 @@ export function createAgentBindings(deps) {
           // appended to the SAME single scoped section the blueprint
           // persona composed (the blueprint text stays verbatim ahead of
           // the block; the re-registration below converges to exactly one
-          // entry). Members and non-root identities are unchanged.
+          // entry). D3 (B2): the MEMBER branch appends the analogous
+          // machine-readable member identity block (below).
           const sid = String(sessionId)
           if (identity.kind === 'root') {
             const base = String(identity.personaText ?? '')
@@ -732,7 +733,25 @@ export function createAgentBindings(deps) {
             registerPersonaSection(sid, agentCtx, { ...identity, personaText: combined })
             return
           }
-          registerPersonaSection(sid, agentCtx, identity)
+          // D3 (Team D1-D6 repair v2, B2): the MEMBER branch appends the
+          // concise machine-readable Team identity context — the OWNING
+          // durable root (identity.rootSessionId — NEVER the child session
+          // id `sid`, which would silently break cross-root members) and
+          // the member's own instanceId (both durable facts resolved by
+          // installPersonaForSetup under the owning root: the committed
+          // MemberInstance row, or the fresh-create instanceIdHint bridging
+          // the pre-commit window) — to the SAME single scoped section the
+          // blueprint persona composed (the blueprint text stays verbatim
+          // ahead of the block; the spread copy keeps the frozen identity
+          // intact; the re-registration converges to exactly one entry, as
+          // for the root branch). The block is identical on fresh create
+          // and cold resume (both flow through this one install seam).
+          const memberBase = String(identity.personaText ?? '')
+          const memberBlock = memberTeamContextBlock(String(identity.rootSessionId), String(identity.instanceId))
+          registerPersonaSection(sid, agentCtx, {
+            ...identity,
+            personaText: memberBase === '' ? memberBlock : `${memberBase}\n\n${memberBlock}`,
+          })
         },
       },
     })
@@ -759,6 +778,32 @@ export function createAgentBindings(deps) {
     )
   }
 
+  /**
+   * D3 (Team D1-D6 repair v2, B2): the concise machine-readable Team
+   * identity context appended to the MEMBER agent's scoped persona
+   * section: the canonical OWNING rootSessionId (identity.rootSessionId —
+   * the root the durable MemberInstance row / fresh-create request was
+   * committed under, never the child session id), the member's own
+   * instanceId, the member role, and the contract that every team_* call
+   * must carry that rootSessionId + a FRESH UNIQUE requestToken (the
+   * closed tool layer rejects a missing rootSessionId / requestToken as
+   * bad arguments, an unknown root as TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND,
+   * and a root the caller does not belong to as TEAM_RUNTIME_CALLER_NOT_
+   * FOUND — the member needs these facts to address its own team).
+   * @param {string} rootSessionId the OWNING team root
+   * @param {string} instanceId the member's own instance id
+   * @returns {string} the two-line context block
+   */
+  function memberTeamContextBlock(rootSessionId, instanceId) {
+    return (
+      `[team-member-context rootSessionId="${rootSessionId}" ` +
+      `instanceId="${instanceId}" role="member"]\n` +
+      `Every team_* tool call must include rootSessionId="${rootSessionId}" ` +
+      `and a fresh unique requestToken; do not use another teams ` +
+      `rootSessionId or another members instanceId.`
+    )
+  }
+
```

Fresh/resume consistency (requirement 1, verified): BOTH fresh-member create
(boot seed loop line ~1006, childFactory fresh path line ~933) and cold-member
resume (`ensureLiveAgent` line ~838, childFactory cold path line ~914) flow
through `agentSetup` → `installPersonaForSetup` → `slot.apply` → this one
member branch — no per-path duplication, matching the v1 C1 evidence
(`fresh_resume_consistent: yes`). The D3-2/D3-3 tests pin byte-identical
across the restart.

## 4. Tests

### 4.1 Commands

```powershell
# fresh worktree (mandatory):
pnpm install --ignore-scripts          # 1m 45.2s, exit 0
# RED (before the implementation):
pnpm exec vitest run packages/runtime/test/d3-member-identity-context.test.ts packages/runtime/test/tcm-d4-root-context.test.ts
# GREEN (after the implementation):
pnpm exec vitest run packages/runtime/test/d3-member-identity-context.test.ts packages/runtime/test/tcm-d4-root-context.test.ts packages/runtime/test/d5-instance-contract.test.ts
# broader regression (shared-glue sanity):
pnpm exec vitest run packages/runtime
```

### 4.2 RED transcript (excerpt — the failing behavior tests, pre-fix)

```
 ❯ packages/runtime/test/tcm-d4-root-context.test.ts (7 tests | 1 failed) 6ms
     × D4-4 the model-visible scoped context: N carries the canonical rootSessionId N + leader id + call contract 3ms
 ❯ packages/runtime/test/d3-member-identity-context.test.ts (5 tests | 3 failed) 6ms
     × D3-1 FRESH member create: the scoped persona carries the identity block (owning root + own instanceId + role=member) on the verbatim template persona 4ms
     × D3-2 COLD RESUME: the resumed member's scoped persona is byte-identical to the create-time one (shared install seam) 1ms
     × D3-3 CROSS-ROOT: the N member gets the owning root N — never the boot root — on fresh create AND cold resume; the N root keeps only the root block 1ms
     ✓ D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer; a foreign-root setup rejects without installing a block 0ms
     ✓ D3-5 repeated setup converges: exactly ONE scoped deployment:persona section, unchanged text 0ms

 Test Files  2 failed (2)
      Tests  4 failed | 8 passed (12)
```

Representative RED assertion (member persona has the template text only — no block):

```
AssertionError: expected 'You are member t12a-worker of the t12…' to be 'You are member t12a-worker of the t12…' // Object.is equality
- Expected
+ Received
  You are member t12a-worker of the t12a test team.
-
- [team-member-context rootSessionId="session-root-p6t1" instanceId="inst-p6t2seedw01" role="member"]
- Every team_* tool call must include rootSessionId="session-root-p6t1" and a fresh unique requestToken; do not use another teams rootSessionId or another members instanceId.
```

(D3-4/D3-5 are green in RED by design: the closed-layer rejections and the
re-install convergence are pre-existing invariants the new block must not
bypass — the A2 recipe pins them as guards.)

### 4.3 GREEN transcript (post-fix)

Focused (task-mandated): 3 files / 17 tests all pass.

```
 ✓ packages/runtime/test/d5-instance-contract.test.ts (5 tests) 3ms
 ✓ packages/runtime/test/tcm-d4-root-context.test.ts (7 tests) 3ms
 ✓ packages/runtime/test/d3-member-identity-context.test.ts (5 tests) 3ms

 Test Files  3 passed (3)
      Tests  17 passed (17)
```

Plus the updated t12a-m2-persona file (see §5 R2):

```
 ✓ packages/runtime/test/t12a-m2-persona.test.ts (8 tests) 12ms
 Test Files  4 passed (4)
      Tests  25 passed (25)
```

Full runtime-package regression (128 files):

```
 Test Files  128 passed (128)
      Tests  1173 passed (1173)
```

### 4.4 What the new test file pins (d3-member-identity-context.test.ts)

Real glue (`agent-bindings.mjs`) through the t12a-live-bridge doubles + the
REAL ten-tool `createTeamTools` stack over the P6-T2 durable world, wired with
the glue's OWN `resolveCaller` (root.ts A04 production wiring), same as
tcm-d4:

- **D3-1** fresh member create — three member shapes: the boot-seeded member
  (committed-row path, boot root), a fresh member under second root N
  (committed-row path, root N), and a fresh member under N in the pre-commit
  window (the instanceIdHint path, root N). Each scoped persona =
  `<template persona>\n\n<member block>` with the OWNING root, the member's
  own instanceId, `role="member"`, and the fresh-unique-requestToken rule.
  A derivation guard pins the test's mirrored `childSessionIdFor` to the
  glue's own deterministic derivation.
- **D3-2** cold resume — `dropResidency` + durable session fixture + first
  `submitAttributedInput` cold-resumes the member via `agents.resume` under
  its owning root (recorded `setupProvided: true`); the resumed scoped
  persona is BYTE-IDENTICAL to the create-time text.
- **D3-3** cross-root — a member of non-boot root N (row committed under N)
  gets the block with N on fresh create AND cold resume (`teamRootOfSession`
  resolves the owning root; the boot root never appears in the text); control:
  the N root agent keeps the pre-existing ROOT block only (no member-block
  leak into the root branch).
- **D3-4** fail closed — the member executes the real tool stack: unknown
  rootSessionId → `rejected` / `TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND`; a root
  the member does not belong to → `rejected` / `TEAM_RUNTIME_CALLER_NOT_
  FOUND`; missing rootSessionId → `rejected` / `TEAM_TOOL_BAD_ARGUMENTS`;
  never `executed`. Setup level: a committed member whose setup is attempted
  under a foreign root (no row there, no hint) — the setup REJECTS with the
  pre-existing fail-closed error and installs NO section.
- **D3-5** repeated setup — re-running `agentSetup(...)` on the same live
  ctx converges to exactly ONE scoped `deployment:persona` section with
  unchanged text.

## 5. Remaining risks / disclosures

- **R1 — block wording: task card vs plan §8 (needs main-agent ruling).**
  The task-card block (this task's governing text, "do not reword") reads
  `do not use another teams rootSessionId or another members instanceId.`
  while plan v2 §8 B2 and A2Result's expected constant read `another team's
  ... another member's` (apostrophes). I followed the TASK CARD verbatim —
  implementation and both test constants are byte-identical to it. If the
  gate rules the plan wording canonical, the fix is one line in three places
  (`memberTeamContextBlock` + the two test constants).
- **R2 — one test file updated beyond the named list (disclosed).**
  A2's "existing-test impact" list names only tcm-d4 D4-4, but
  `t12a-m2-persona.test.ts` M2-1/M2-3 ALSO pinned the superseded v1 member
  persona text (the M2-1 comment literally said "the member section keeps
  the template persona verbatim — no context block"). Left red, they fail on
  the exact bytes B2 is mandated to add. I updated them per the D4-4
  precedent explicitly authorized for this task (same-package test file,
  same seam, same kind of supersession: template persona verbatim + block,
  plus no-root-block-leak checks). The full runtime suite is green with the
  update (1173/1173). Flagged for the main agent's admission decision.
- **R3 — empty-blueprint-persona path.** When a member's blueprint persona is
  empty the section text is the block alone (mirroring the root branch's
  `base === ''` handling). Implemented consistently; not separately covered
  by a test (every fixture blueprint in this package carries non-empty
  member personas).
- **R4 — suite-environment note (pre-existing, unrelated).** During the first
  full-suite run, leftover scratch dirs under the gitignored
  `packages/testkit/test/.tmp-fault/` from an earlier crashed run made
  `p5t6-cold-member`/`p6t1-parallel` fail with `team_domain already exists`.
  After clearing the leftovers the same command is 128/128 green. Neither
  file imports `agent-bindings.mjs`; the failure mode (scratch-dir lifecycle
  under vitest worker load) is orthogonal to this change.
- **R5 — host-level smoke.** No host instance was started in this wave (per
  the wave rules); the model-visible prompt effect is proven at the real
  glue/agent-ctx prompt-surface boundary (the bridge's `systemPrompt.section`
  double is the same DSH builtin surface the production root wires). The
  wave gate's host smoke covers the live-instance side.

## 6. Verdict

- verdict: **PASS**
- blocker: **none**
- The D3 member identity block is appended ONLY on the member persona branch
  (`kind === 'member'`), after the existing `registerPersonaSection`
  behavior, using the identity object fields available at
  `installScopedPersona` time (`identity.rootSessionId`,
  `identity.instanceId`); it appears on both fresh-member create and
  cold-member resume; the cross-root member gets the OWNING root; wrong/
  foreign root claims fail closed at both the tool layer and the setup
  layer; repeated setup does not duplicate the section; the root branch is
  unchanged (tcm-d4 D4-1…D4-7 + t12a-m2 M2-1…M2-8 green).
