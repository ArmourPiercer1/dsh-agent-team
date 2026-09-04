# P9-T8 / S9 — `pnpm lint` fixes (Task A) + Task B/C gate evidence

Branch `task/P9-ui-legacy-reuse`, worktree `.worktrees/P9`, single writer P9-T8.
All commands run with the worktree as cwd. No git commands were used by this
agent (the main agent commits).

## 1. Per-rule before/after (lint)

Baseline: `pnpm lint` RED — **778 errors / 0 warnings** (the task's rule
inventory summed to 776 + 1 'signature'; the 2 missing entries were
`@typescript-eslint/no-empty-object-type` sites not listed in the inventory —
flagged, see §5 judgment 2).

| Rule | Before | After | Disposition |
| --- | ---: | ---: | --- |
| `@typescript-eslint/no-explicit-any` | 379 | 0 | 344 targeted `eslint-disable-next-line` (runtime test files, three reason variants, §3.2) + 35 fixed with real types across client/contracts/domain/legacy/remote/runtime source |
| `no-undef` | 244 | 0 | scoped flat-config `globals.node` blocks: one pre-existing (`scripts/**/*.mjs`) + one new covering 7 harness/e2e/live plugin `.mjs` files (§3.3) |
| `@typescript-eslint/no-unused-vars` | 123 | 0 | deleted dead bindings/imports/args/functions; `_`-rename only where the kept call has side effects or can throw (js/ts twins kept in parity) |
| `@typescript-eslint/no-unused-expressions` | 7 | 0 | `p5t1-binder-core.test.ts`: discarded `instanceof TypeError` booleans wrapped as real `expect(…).toBe(true)` assertions (helper returns the thrown value; intent documented in the test header) |
| `react-hooks/exhaustive-deps` | 5 | 0 | deleted 5 stale `eslint-disable-next-line` comments in `TeamCreationPanel.tsx` (plugin not installed, so every such comment errors) |
| `prefer-const` | 5 | 0 | 4× `let`→`const`; `activation/provider.ts`: declaration moved to the (unconditional, post-throw-branch) assignment site — an uninitialized `const` is TS1155, so the `let` could not simply become an in-place `const` |
| `no-control-regex` | 5 | 0 | 5 targeted disables (§3.1, §5 judgment 7 — the `\uXXXX` rewrite the task preferred is already in the source and is flagged by this ESLint version) |
| `no-useless-catch` | 2 | 0 | unwrapped `try { x = f() } catch (e) { throw e }` → direct call (provisioning `coordinator.js` + `coordinator.ts` twins; `root` never reassigned — verified) |
| `no-useless-escape` | 2 | 0 | unescaped backtick inside regex char class `(["'`])` (session-event-scan.mjs, p6t6-bypass-scan.mjs) — regex semantics identical |
| `no-fallthrough` | 1 | 0 | `// falls through` comment in `TeamLedger.tsx` (inner `switch` always returns; a `break` would be dead code) |
| `no-var` | 1 | 0 | `declare var URL` → `declare const URL` in the ambient shim `node-min.d.ts` (typecheck stays green) |
| `no-constant-binary-expression` | 1 | 0 | resolved in the earlier session alongside the dead-code removals; the individual site is not reconstructible after scratch inventories were deleted (evidence gap, §5 judgment 13) |
| parsing error (reported as rule `signature`) | 1 | 0 | `t12a-live-bridge.d.mts`: 5 malformed `readonly` method declarations → valid syntax (one ESLint parsing-error entry for the file) |
| `@typescript-eslint/no-empty-object-type` | 2 | 0 | **not in the task inventory** (flagged): `contracts/.../activity.ts:160` `{}`→`object`; `remote/.../params.ts:152` empty interface→`type … = object` |
| **Total** | **778** | **0** | `pnpm lint` exit 0, 0 errors 0 warnings |

A3 config change: `eslint.config.mjs` — added `'tests/**'` to global ignores
and the new scoped `globals.node` block (files listed in §3.3). No other
config change.

## 2. Complete changed-file list (110 by this task + 2 flagged)

Reasons are one line each; "twin" = the parallel `.js`/`.ts` implementation
pair, edited in parity.

| File | Reason |
| --- | --- |
| `eslint.config.mjs` | A1: `'tests/**'` global ignore + scoped `globals.node` block for 7 plugin/harness `.mjs` files |
| `packages/runtime/test/t12a-live-bridge.d.mts` | fixed 5 malformed `readonly` method declarations (parsing error) |
| `packages/contracts/src/projection/activity.ts` | no-empty-object-type: `{}`→`object` (not in task inventory) |
| `packages/remote/src/contracts/params.ts` | no-empty-object-type: empty interface→`type … = object` (not in task inventory) |
| `packages/testkit/test/t6-1-no-agent-dependency.test.ts` | B1: dynamic import anchored via `toTsUrl` file-URL (Vite clamps `..` escapes) |
| `packages/runtime/root-binding/harness/run.mjs` | added missing `readFileSync` to the `node:fs` import (real latent bug) |
| `packages/runtime/test/p8s5a-production-assembly.test.ts` | no-explicit-any: targeted disables (dynamic service doubles / untyped payloads) |
| `packages/runtime/test/p8s6-pagination.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s6-push-reconnect.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s6-principal.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s7r2-effective-config.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s7r2-disposed-history.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s6-remote-commands.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s7r2-model-state.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s7r2-policy-state-durable.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/t12b1-real-create.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s7r4-handoff-wiring.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/p8s7r4-fork-describe.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/t12b6-handoff-agent-start.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/t12b2-resume-separation.test.ts` | no-explicit-any: targeted disables |
| `packages/runtime/test/t12m4-remote-mount.test.ts` | no-explicit-any: targeted disables |
| `packages/client/src/plugin/team-mount-core.ts` | no-unused-vars: removed dead binding(s) |
| `packages/client/src/transport/team-remote-client.ts` | no-unused-vars: removed dead binding(s) |
| `packages/client/src/ui/TeamSettingsSection.tsx` | no-unused-vars: removed dead binding(s) |
| `packages/client/src/ui/TeamView.tsx` | no-unused-vars: removed dead binding(s) |
| `packages/client/test/projection-adapter.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/client/test/team-activity.client.spec.tsx` | no-unused-vars: removed dead import(s) |
| `packages/client/test/team-governance.client.spec.tsx` | no-unused-vars: removed dead import(s) |
| `packages/client/test/team-ledger.client.spec.tsx` | no-unused-vars: removed dead import(s) |
| `packages/client/test/team-plugin.client.spec.tsx` | no-unused-vars: removed dead import(s) |
| `packages/client/test/team-remote-client.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/client/test/team-view.client.spec.tsx` | no-unused-vars: removed dead import(s) |
| `packages/client/test/team-projection-store.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/contracts/src/dto/blueprint-snapshot.ts` | no-unused-vars: removed dead import(s) |
| `packages/contracts/src/dto/session-binding.ts` | no-unused-vars: removed dead import (twin .js below) |
| `packages/contracts/src/dto/session-binding.js` | no-unused-vars: twin of session-binding.ts |
| `packages/contracts/src/ids/session-id.ts` | no-unused-vars: removed dead import (twin .js below) |
| `packages/contracts/src/ids/session-id.js` | no-unused-vars: twin of session-id.ts |
| `packages/contracts/src/projection/effective-config.ts` | no-unused-vars: removed dead import(s) |
| `packages/contracts/src/projection/model-state.ts` | no-unused-vars: removed dead import (twin .js below) |
| `packages/contracts/src/projection/model-state.js` | no-unused-vars: twin of model-state.ts |
| `packages/contracts/test/leader-instance-record.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/domain/compatibility/src/engine.ts` | no-unused-vars: removed dead binding(s) |
| `packages/domain/policy/src/errors.ts` | no-unused-vars: removed dead binding(s) |
| `packages/domain/test/t3-lifecycle-property.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/domain/test/t3-member-workspace.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/domain/test/t4-policy-negative.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/legacy/session-reader/e2e/plugin.mjs` | no-unused-vars: removed dead binding(s) |
| `packages/remote/test/p8t4-negative-scan.mjs` | no-unused-vars: removed dead binding(s) |
| `packages/legacy/test/p7t7-integrated-drift-ack.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/legacy/test/p7t7-integrated-lifecycle-restore.test.ts` | no-unused-vars: removed dead import(s) |
| `packages/runtime/action-router/effects.js` | no-unused-vars: dropped unused destructured dep (twin .ts below) |
| `packages/runtime/action-router/effects.ts` | no-unused-vars: twin of effects.js |
| `packages/runtime/action-router/work-execution.js` | no-unused-vars: dropped unused destructured dep (twin .ts below) |
| `packages/runtime/action-router/work-execution.ts` | no-unused-vars twin + prefer-const `fromLifecycle`→`const` |
| `packages/runtime/activation/provider.js` | no-unused-vars: deleted pure `createTemplateAddress` call result (twin .ts below) |
| `packages/runtime/activation/provider.ts` | no-unused-vars twin + prefer-const: `compatibilityStatus` declared at assignment site (TS1155-safe) |
| `packages/runtime/activation/checks.js` | no-unused-vars: deleted pure `teamAllow` Set (twin .ts below) |
| `packages/runtime/activation/checks.ts` | no-unused-vars: twin of checks.js |
| `packages/runtime/admission/gate.js` | no-unused-vars: import narrowed to `ACTIVATION_ERROR_CODES` (twin .ts below) |
| `packages/runtime/admission/gate.ts` | no-unused-vars: twin of gate.js |
| `packages/runtime/member-residency/harness/plugin.mjs` | no-unused-vars: deleted never-read `installOverlayCallCount` counter (+increment), dropped unused `sessionId` param, dropped unused destructured `assembly`, `_svc` rename (kept throwing `resolveServices(ctx)` call) |
| `packages/runtime/messaging/coordinator.ts` | no-unused-vars: deleted `TeamDomain` type import |
| `packages/runtime/root-binding/fresh-root.ts` | no-unused-vars: import narrowed to `TeamAgentBinder` |
| `packages/runtime/src/plugin/live/agent-bindings.mjs` | no-unused-vars: `node:fs` import narrowed to `readdirSync` |
| `packages/runtime/member-residency/harness/slots-t6.mjs` | no-unused-vars: dropped unused `agentPresets` param (+JSDoc), unused arrow arg removed (twin harness below) |
| `packages/runtime/root-binding/harness/slots.mjs` | no-unused-vars: twin of slots-t6.mjs |
| `packages/runtime/test/p5t1-double-bind.test.ts` | no-unused-vars: removed dead import |
| `packages/runtime/test/p6t1-delegate.test.ts` | no-unused-vars: removed dead imports + `ROOT` const |
| `packages/runtime/test/p6t2-addressing.test.ts` | no-unused-vars: removed dead type import |
| `packages/runtime/test/p6t5-intervals.test.ts` | no-unused-vars: 4× discarded `openInterval` results → bare `await` (the calls are the test) |
| `packages/runtime/test/p6t5-progress.test.ts` | no-unused-vars: removed dead imports |
| `packages/runtime/test/p6t1-helpers.ts` | no-unused-vars: `repositories`→`_repositories` (getter has side effects, call kept) |
| `packages/runtime/test/p7t5-failure-before-root-create.test.ts` | no-unused-vars: removed `FakeSummarizer`; discarded `state` → bare `await` |
| `packages/runtime/test/p7t4-ordinary-fork.test.ts` | no-unused-vars: deleted unused `MEMBER_CHILD` const |
| `packages/runtime/test/p7t4-repeat-reconcile.test.ts` | no-unused-vars: removed dead import |
| `packages/runtime/test/p8s4b-override-admission.test.ts` | no-unused-vars: discarded `c1` → bare `await` |
| `packages/runtime/test/p8s7r4-bc22-idempotency.test.ts` | no-unused-vars: deleted unused `check()` helper (+JSDoc) |
| `packages/runtime/test/p8s7r4-handoff-surface.test.ts` | no-unused-vars: unused map arg removed |
| `packages/runtime/test/p8t2-helpers.ts` | no-unused-vars: removed `SessionId` import |
| `packages/runtime/test/p8s6-projection.test.ts` | no-unused-vars: unused callback arg removed |
| `packages/runtime/test/p5t1-binder-core.test.ts` | no-unused-expressions ×7: wrapped discarded booleans as `expect(…).toBe(true)` |
| `packages/runtime/test/p5t6-evict-readmit.test.ts` | prefer-const: `let e3` → `const e3` (array only mutated, never reassigned) |
| `packages/runtime/src/plugin/effective-config-view.ts` | prefer-const: `let value` → `const value` |
| `packages/runtime/mutation/service.ts` | no-control-regex: targeted disable on the stateId control-char scanner (intentional) |
| `packages/runtime/src/plugin/node-min.d.ts` | no-var: `declare var URL` → `declare const URL` |
| `packages/storage/bindings/binding-service.ts` | no-unused-vars: removed dead `SessionBindingDto` import |
| `packages/storage/operations/journal.js` | no-unused-vars: deleted dead nested `verifyFactScope` (never called) (twin .ts below) |
| `packages/storage/operations/journal.ts` | no-unused-vars: twin of journal.js |
| `packages/storage/provisioning/coordinator.js` | no-useless-catch: unwrapped rethrow try/catch, `let root` → `const` (no later reassignment — verified) (twin .ts below) |
| `packages/storage/provisioning/coordinator.ts` | no-useless-catch: twin of coordinator.js |
| `packages/storage/test/g8s1-stamp-advance.test.ts` | no-unused-vars: deleted unused `bCount1` read |
| `packages/storage/test/p4t2-conflicts.test.ts` | no-unused-vars: discarded `r1` → bare `await` |
| `packages/storage/test/p4t4-one-committed-invariant.test.ts` | no-unused-vars: removed dead import |
| `packages/storage/test/p4t4-per-stage-retry.test.ts` | no-unused-vars: discarded `s1b` → bare `await` |
| `packages/testkit/fault-injection/session-event-scan.mjs` | B2: `.tmp-fault` directory skip + ENOENT-only guard in the walker; no-useless-escape: backtick unescaped in `SPECIFIER_PATTERN` char class |
| `packages/testkit/test/t6-3-lifecycle-matrix.test.ts` | no-unused-vars: removed dead import |
| `packages/testkit/test/t6-6-snapshot-immutability.test.ts` | no-unused-vars: removed dead type import |
| `packages/testkit/test/t6-7-fresh-per-delegation.test.ts` | no-unused-vars: removed dead imports |
| `packages/testkit/test/t6-8-serialization-roundtrip.test.ts` | no-unused-vars: removed dead type import |
| `packages/tools/harness/run.mjs` | no-unused-vars: `node:path` import narrowed to used members |
| `packages/tools/test/p6t6-actions.test.ts` | no-unused-vars: removed dead import |
| `packages/tools/test/p6t6-bypass-scan.mjs` | no-useless-escape: backtick unescaped in `SESSION_TYPES_SPECIFIER_PATTERN` char class |
| `packages/domain/blueprint/src/hash.ts` | prefer-const: `let code` → `const code` |
| `packages/domain/blueprint/src/validate.js` | no-control-regex: targeted disable on `CONTROL_CHARS` (intentional scanner) (twin .ts below) |
| `packages/domain/blueprint/src/validate.ts` | no-control-regex: twin of validate.js |
| `packages/domain/policy/src/validate.js` | no-control-regex: targeted disable in `hasForbiddenIdChars` (twin .ts below) |
| `packages/domain/policy/src/validate.ts` | no-control-regex: twin of validate.js |
| `packages/client/src/ui/TeamCreationPanel.tsx` | react-hooks: deleted 5 stale `exhaustive-deps` disable comments (plugin not installed) |
| `packages/client/src/ui/TeamLedger.tsx` | no-fallthrough: `// falls through` between the inner switch and `default:` (inner switch always returns) |

**Flagged, NOT changed by this task** (mtime anomaly, content untouched by me):
`scripts/composition-smoke.mjs` (mtime 2026-09-04 12:56:16) and
`scripts/composition-smoke-assets-loader.mjs` (mtime 12:55:50) — modified
between the 12:53 recursive build and task start; this agent never wrote to
`scripts/` (task-forbidden). Both files differ from the main checkout's copy
(the main checkout is at an older base commit, and the assets-loader file does
not exist there at all), so a content diff against this branch's base is not
possible without git. Reported for the main agent's awareness.

## 3. Targeted eslint-disable comments added

### 3.1 no-control-regex (5)

| File:line | Reason text |
| --- | --- |
| `packages/domain/blueprint/src/validate.js:46` (above the `CONTROL_CHARS` const) | `-- intentional scanner: rejects control characters in blueprint strings` |
| `packages/domain/blueprint/src/validate.ts:108` (above the `CONTROL_CHARS` const) | `-- intentional scanner: rejects control characters in blueprint strings` |
| `packages/domain/policy/src/validate.js:95` (above the `return` in `hasForbiddenIdChars`) | `-- intentional scanner: rejects control characters in policy ids` |
| `packages/domain/policy/src/validate.ts:142` (above the `return` in `hasForbiddenIdChars`) | `-- intentional scanner: rejects control characters in policy ids` |
| `packages/runtime/mutation/service.ts:817` (inside the `stateId` `||` chain) | `-- intentional scanner: rejects control characters in state ids` |

### 3.2 no-explicit-any (344)

All in `packages/runtime/test/` (17 files, §2). Three reason variants:
- `-- dynamic service surface (test double), untyped by design`
- `-- untyped test payload / hidden internal state`
- `-- waterfall listeners are positional`

- `packages/runtime/test/p8s5a-production-assembly.test.ts`
  - L194, L196, L201, L203, L210, L232, L239, L242, L278, L701 - dynamic service surface (test double), untyped by design
  - L352, L396, L408, L616, L653, L774 - untyped test payload / hidden internal state
- `packages/runtime/test/p8s6-pagination.test.ts`
  - L137, L174, L176, L181, L183, L189, L211, L213, L216, L226, L237, L277, L283, L401, L404, L408, L410, L414, L417, L429, L442, L450, L455, L463, L471, L480, L485, L494 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s6-principal.test.ts`
  - L164, L201, L203, L208, L210, L216, L238, L240, L243, L258, L269, L272, L291, L298, L308, L313, L486, L575, L604, L625, L642, L644, L650, L657, L659, L665 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s6-projection.test.ts`
  - L134, L171, L173, L178, L180, L187, L209, L211, L214, L231, L288, L303, L314, L322, L329, L345, L367, L370, L406, L435, L443, L491, L557, L560, L568, L571, L614 - dynamic service surface (test double), untyped by design
  - L533, L535 - untyped test payload / hidden internal state
- `packages/runtime/test/p8s6-push-reconnect.test.ts`
  - L122, L159, L161, L166, L168, L174, L196, L198, L201, L211, L231, L236, L244, L249, L257, L260, L270, L278, L283, L324, L333 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s6-remote-commands.test.ts`
  - L134, L171, L173, L178, L180, L186, L208, L210, L213, L228, L238, L241, L269, L274, L282, L287, L329, L380, L385, L396, L410, L427, L437, L441, L453, L470 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s7r2-disposed-history.test.ts`
  - L311, L316, L318, L349, L359, L449, L506 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s7r2-effective-config.test.ts`
  - L233, L235, L240, L242, L249, L271, L274, L277, L289, L302, L305, L307, L309, L319, L326, L336, L341, L349, L353, L356, L361, L363, L367, L372, L390, L392, L399, L411, L416, L419, L422, L426, L429, L434, L439, L442, L523, L527, L529, L531, L683, L697, L715, L729, L756 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s7r2-model-state.test.ts`
  - L230, L232, L237, L239, L246, L268, L271, L274, L286, L299, L302, L304, L306, L316, L323, L333, L338, L346, L350, L353, L358, L360, L368, L373, L390, L392, L396, L398, L400, L402, L405, L407, L411, L415, L420, L422, L480, L623, L676, L770 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s7r2-policy-state-durable.test.ts`
  - L175, L177, L182, L184, L191, L213, L216, L219, L231, L245, L248, L250, L254, L263, L270, L294, L299, L307, L311, L314, L323, L328, L430, L441, L443, L495 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s7r4-fork-describe.test.ts`
  - L143, L175, L181, L203, L206, L209, L318 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/p8s7r4-handoff-wiring.test.ts`
  - L121, L153, L159, L181, L184, L187, L201, L204, L206, L208, L218, L225, L233, L238, L246, L252, L257, L273, L296, L318, L370, L375, L381, L383, L385 - dynamic service surface (test double), untyped by design
- `packages/runtime/test/t12a-live-bridge.d.mts`
  - L43 - waterfall listeners are positional
- `packages/runtime/test/t12b1-real-create.test.ts`
  - L102, L128, L134, L155, L158, L161 - dynamic service surface (test double), untyped by design
  - L188, L240 - untyped test payload / hidden internal state
- `packages/runtime/test/t12b2-resume-separation.test.ts`
  - L124, L150, L156, L177, L180, L183, L189, L192 - dynamic service surface (test double), untyped by design
  - L229, L231, L233, L237, L239, L241, L258, L270, L289, L291, L295, L297 - untyped test payload / hidden internal state
- `packages/runtime/test/t12b6-handoff-agent-start.test.ts`
  - L135, L161, L167, L188, L191, L194, L215, L238, L250, L281, L327, L347, L376 - dynamic service surface (test double), untyped by design
  - L257 - untyped test payload / hidden internal state
- `packages/runtime/test/t12m4-remote-mount.test.ts`
  - L161, L167, L169, L193, L222 - dynamic service surface (test double), untyped by design

### 3.3 no-undef: no disables — scoped globals instead

`eslint.config.mjs` new block: `files: ['packages/tools/harness/**/*.mjs',
'packages/runtime/member-residency/harness/**/*.mjs',
'packages/runtime/root-binding/harness/**/*.mjs',
'packages/legacy/session-reader/e2e/**/*.mjs',
'packages/runtime/test/t12a-live-bridge.mjs',
'packages/runtime/src/plugin/upstream-resolver.mjs',
'packages/runtime/src/plugin/live/agent-bindings.mjs']`,
`languageOptions: { globals: { ...globals.node } }` (the pre-existing
`scripts/**/*.mjs` block was left untouched).

## 4. Gate results (tails)

Final ordered gate run, single background job, worktree cwd: `pnpm lint` then `pnpm -r run typecheck` then `pnpm -r run test`.

### 4.1 `pnpm lint` - EXIT 0

Full captured output (7 lines). The only content is pnpm echoing the
script line `$ eslint .` to stderr, which PowerShell renders as a
NativeCommandError record (any stderr from a native command is flagged
this way). eslint itself printed no diagnostics - 0 problems - and the
process exited 0. The capture wrapped the long pnpm path mid-line.

    pnpm.exe : $ eslint .
    At D:\.pnpm-store\v11\links\@pnpm\exe\11.7.0\a254132c028a4f0368fb9ee996a0169a530281496d7f26c4b2de752a7553ec1c\bin\p
    npm.ps1:14 char:3
    +   & "$basedir/../node_modules/@pnpm/exe/pnpm.exe"   $args
    +   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      + CategoryInfo          : NotSpecified: ($ eslint .:String) [], RemoteException
      + FullyQualifiedErrorId : NativeCommandError

### 4.2 `pnpm -r run typecheck` - EXIT 0

Complete output (17 lines):

    Scope: 9 of 10 workspace projects
    packages/contracts typecheck$ tsc -p tsconfig.json
    packages/domain typecheck$ tsc -p tsconfig.json
    packages/runtime typecheck$ tsc -p tsconfig.json
    packages/remote typecheck$ tsc -p tsconfig.json
    packages/contracts typecheck: Done
    packages/storage typecheck$ tsc -p tsconfig.json
    packages/remote typecheck: Done
    packages/testkit typecheck$ tsc -p tsconfig.json
    packages/domain typecheck: Done
    packages/tools typecheck$ tsc -p tsconfig.json
    packages/storage typecheck: Done
    packages/testkit typecheck: Done
    packages/tools typecheck: Done
    packages/runtime typecheck: Done
    packages/client typecheck$ tsc -p tsconfig.json
    packages/client typecheck: Done

9 of 9 projects with a typecheck script: Done.

### 4.3 `pnpm -r run test` - EXIT 1 (testkit only; pnpm default bail)

Scope: 9 of 10 workspace projects have a test script. In this run
contracts, remote, domain and storage completed green (13 + 9 + 17 + 21
test files, 0 failed). testkit failed (below); pnpm then applied its
default bail: the in-flight runtime run was cut after 72 passing
files (zero failures observed before the cut); tools had just started
(no output before the cut); client and legacy - the remaining 2 of the
9 test-script packages - were never started. Final pnpm verdict block,
verbatim:

    packages/testkit test:  Test Files  2 failed | 13 passed (15)
    packages/testkit test:       Tests  4 failed | 120 passed (124)
    packages/testkit test:    Start at  13:30:07
    packages/testkit test:    Duration  1.44s (transform 4.45s, setup 0ms, import 6.93s, tests 286ms, environment 1ms)
    packages/testkit test: Failed
    D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9\packages\testkit:
    [ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @dsh-agent-team/testkit@0.0.0 test: `vitest run`
    Exit status 1

Failing files - both pre-existing and out of scope (causes: section 5,
item 12):
- packages/testkit/test/p4t6-session-event-scan.test.ts (3 tests): stale
  pins from before later P9 tasks added scannable files and the
  legacy-vocabulary .d.ts twin (763 scannable vs pinned 601; 20
  quarantine hits vs pinned 15).
- packages/testkit/test/t6-1-no-agent-dependency.test.ts (1 test):
  Object.isExtensible assertion - vitest 4.1.11 / vite-node returns
  extensible namespace objects for in-workspace TS imports, so it fails
  under vitest while passing under plain node.
- p4t5-crash-matrix.test.ts PASSED here (13/13): the ENOTEMPTY suite
  failure from the 13:23 dedicated testkit run (Windows handle-release
  race in .tmp-fault cleanup) did not reproduce.

## 5. Judgment calls

1. **379 no-explicit-any → 344 targeted disables + 35 real types.** Typing the
   dynamic service doubles would cascade through 16 test files and risk the
   green typecheck gate; the task allows targeted disables with a short
   reason. Some inserted comments sit between a JSDoc block and its
   declaration (cosmetic doc separation only).
2. **Inventory discrepancy:** the task's rule inventory sums to 776 (+1
   'signature') vs the measured baseline of 778. The 2 unlisted errors were
   `@typescript-eslint/no-empty-object-type` (`activity.ts:160`,
   `params.ts:152`) — fixed minimally (`object` / `type … = object`), flagged
   here instead of silently.
3. **'signature' rule** = the ESLint parsing error in
   `t12a-live-bridge.d.mts` (5 malformed readonly-method declarations in one
   file = one parsing-error entry).
4. **`stateCells` renamed, not deleted** (an earlier site): the surviving
   call has validation-throw side effects; dropping it would change behavior.
   Same principle as `_svc` in member-residency `plugin.mjs`
   (`resolveServices(ctx)` throws on missing services) and
   `_repositories` in `p6t1-helpers.ts` (getter side effect).
5. **`root-binding/harness/run.mjs` missing `readFileSync` import** = real
   latent bug fixed (import added to the existing `node:fs` line).
6. **Discarded booleans in `p5t1-binder-core.test.ts`** became real
   `expect(…).toBe(true)` assertions (never `void`-suppressed): the helper
   returns the thrown value, and the test header states the expected
   `TypeError`, so the assertion matches intent.
7. **no-control-regex targets the `\uXXXX` escape form in this ESLint
   version.** Verified in isolation: `/[\u0000-\u001f\u007f]/` literals AND
   `new RegExp('[\\u0000-\\u001f\\u007f]')` constructor patterns are both
   flagged; the source already used the escape form (task's preferred
   rewrite), so only a targeted disable remains compliant. `\p{Cc}` passes
   lint but widens the matched set to C1 controls (behavior change) —
   rejected. The five disables in §3.1 are the compliant option.
8. **`installOverlayCallCount` deleted entirely** (harness
   `plugin.mjs`): the self-referencing `+= 1` is not a "use" for
   no-unused-vars, and the counter is read nowhere (grep-verified).
9. **TeamLedger fallthrough** gets `// falls through`, not `break`: the inner
   `switch` covers all cases and always returns, so a `break` would be dead
   code; the fallthrough to `default:` (which also returns `'ongoing'`) is
   intentional and semantically unchanged.
10. **`declare var URL` → `declare const URL`** in the ambient shim:
    no-var-clean and typecheck stays green.
11. **`activation/provider.ts` prefer-const:** an uninitialized `const` is
    TS1155, so the flagged `let compatibilityStatus` (assigned once, after
    two fail-closed throw branches) was restructured — declaration removed at
    the top and re-declared as
    `const compatibilityStatus: CompatibilityStatus = admission.status` at
    the assignment site. Behavior identical (the earlier branches always
    throw; the assignment is unconditional on the surviving path).
12. **`pnpm -C packages/testkit test` does NOT go fully green (B3 stop).**
    After the specified `.tmp-fault` removal, 3 of 15 files still fail —
    all pre-existing/other-worktree causes, none caused by this task's
    edits; per the task protocol (no improvised fixes outside Tasks A/B)
    they are reported verbatim instead of fixed:
    - `t6-1-no-agent-dependency.test.ts` — `expect(Object.isExtensible(mod)).toBe(false)`
      (line 108) fails for **all nine** direct-bundle imports under
      vitest 4.1.11: every file-URL-anchored TS import yields an extensible
      namespace object in this vitest/vite-node version (reproduced with a
      temporary probe: `extensible=true markerOk=true` for all 9 entries; the
      probe was deleted). B1's anchor fix itself works (imports resolve,
      markers present). The assertion predates the vitest version behavior;
      fixing it means editing the test's assertion — outside Task B scope.
    - `p4t6-session-event-scan.test.ts` — 3 failures, all stale test data
      relative to files added by other P9 tasks after the pin was last
      recorded (p4t6 test file last modified 2026-09-04 02:38):
      (a) `expect(scanResult.filesScanned).toBe(601)` — actual **763**
      (162 extra scannable `.ts/.mts/.mjs` files in the tree; none created
      by this task — every change here edits existing files);
      (b) "zero denylist violations outside the frozen quarantine set" —
      5 new `event-string` hits in `packages/contracts/src/legacy-vocabulary.d.ts`
      (a `.d.ts` twin added after the pin; the pinned set covers
      `legacy-vocabulary.ts` only) not present in `QUARANTINE_FILES`;
      (c) "quarantine hits pinned exactly: fifteen …" — actual 20
      (the same 5 `.d.ts` hits). Fixing = updating the p4t6 pins/quarantine —
      outside Task B scope (B1 = t6-1 only, B2 = scanner only).
    - `p4t5-crash-matrix.test.ts` — suite-level `Error: ENOTEMPTY, Directory
      not empty: …\packages\testkit\test\.tmp-fault\p4t5m-B1` in
      `destroyDir` (`fault-injection/file-seam.mjs:425`, `rmSync`
      recursive+force) during `runBoundary` cleanup: a Windows handle-release
      race after the crash-simulated child is killed; no zombie node process
      was found after the run, and the failure directory was recreated
      *during* this run (fresh, not the removed stale one). The run left one
      scratch file (`.tmp-fault\p4t5m-B1\team_domain.meta.json`), which was
       removed before the final gate. Confirmed in the final
       `pnpm -r run test` gate (section 4.3): p4t5-crash-matrix.test.ts
       passed 13/13 - the ENOTEMPTY did not reproduce; the persistent
       testkit reds in that run are the two files above (p4t6 stale
       pins, t6-1 extensibility).
13. **no-constant-binary-expression site** (1 error, baseline): resolved in
    the earlier session alongside dead-code removals; the individual site is
    not reconstructible after the scratch lint inventories were deleted —
    recorded as an evidence gap, not silently dropped.
