# CUT-BOUNDARY-ADDITIONS — the A1 cut's boundary completion

> **This is a boundary COMPLETION, not a re-decision.** Every file below was retired
> because its *subject died inside the frozen A1 cut* (or because it was build output of
> a file the cut deleted). No frozen module keep/delete verdict was revisited, no retired
> module was re-created, and no compatibility layer was added. The frozen boundary is
> `dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json` (148 files, 37 modules): both
> gates still read `cut=cut(148/148)` and `cut=cut(0/148)`, and the assets gate still
> records `delete=146 replace=2`.

Branch: `vnext/a1-cut` · phase: A1 · author: delegated cut-closure agent (2026-11-21)

## 1. Retired files that were NOT in the frozen A0 delete set

The frozen set enumerates module *sources*; it does not enumerate the two U6 suites whose
subject was that module, nor this row (the row was booked as `replace`, not `delete`, and
its replacement is the assembly-level vnext layout — no row is re-created).

| # | file | why |
| --- | --- | --- |
| 1 | `packages/runtime/src/plugin/live/center-shadow-row.mjs` | The U6 PR1 center-assembly SHADOW row. Its only production reference was a dynamic `import('../../../governance-center/index.js')` into the retired `governance-center` lane — with that lane deleted the row's only remaining behaviour was a dynamic import of a missing module (a fail-open hole), not a feature. The new assembly (`packages/runtime/src/plugin/vnext/*`) replaces it at assembly level, not as a row. Boundary completion; no frozen verdict changed (`replace` remains the recorded disposition). |
| 2 | `packages/runtime/test/u6-pr1-shadow-inert.test.ts` | The C1 suite whose subject IS the row above: it drives `installCenterShadowRow` and asserts the inert law. It retires with its subject (there is no inert row left to certify). |
| 3 | `packages/runtime/test/u6-fixk-shadow-ledger.test.ts` | The FIX-K K5 bounded-ledger suite whose subject IS the same row: it drives the row's ledger writer and its row/byte budgets. It retires with its subject. |

## 2. Dist mirrors deleted (build output of sources the cut deleted)

The frozen A0 accounting counted **52 committed dist artifacts**. The closure gate maps a
source to `packages/<pkg>/dist/packages/<pkg>/…` only, so it cannot see the aggregated
`packages/runtime/dist/packages/<other-pkg>/…` mirrors — and for `.mjs` byte-copies it
looks for `.js`/`.d.ts` only. Comparing the tracked dist tree against the frozen delete set
found **150 more stale mirrors**, plus the mirror of the row retired above (151 total).
All are mirrors of deleted/replaced sources; nothing else was touched. The two files the
task named are both in this list.

- `packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs` — mirror of `packages/runtime/src/plugin/live/agent-bindings.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/center-shadow-row.mjs` — mirror of `packages/runtime/src/plugin/live/center-shadow-row.mjs` (the row retired by this change, not a frozen-set file); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/confined-bash-tool.mjs` — mirror of `packages/runtime/src/plugin/live/confined-bash-tool.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/confined-fs-tool.mjs` — mirror of `packages/runtime/src/plugin/live/confined-fs-tool.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/confined-search-tool.mjs` — mirror of `packages/runtime/src/plugin/live/confined-search-tool.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/confined-terminal-tool.mjs` — mirror of `packages/runtime/src/plugin/live/confined-terminal-tool.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/confined-web-tool.mjs` — mirror of `packages/runtime/src/plugin/live/confined-web-tool.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/family-assembly.mjs` — mirror of `packages/runtime/src/plugin/live/family-assembly.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/native-bash-tool.mjs` — mirror of `packages/runtime/src/plugin/live/native-bash-tool.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/native-tool-admission.mjs` — mirror of `packages/runtime/src/plugin/live/native-tool-admission.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/pa-mount-registry.mjs` — mirror of `packages/runtime/src/plugin/live/pa-mount-registry.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/runtime/src/plugin/live/team-tool-plane.mjs` — mirror of `packages/runtime/src/plugin/live/team-tool-plane.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/args.d.ts` — mirror of `packages/tools/a5p5-tools/src/args.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/args.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/args.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/args.js` — mirror of `packages/tools/a5p5-tools/src/args.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/args.js.map` — mirror of `packages/tools/a5p5-tools/src/args.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-contract.d.ts` — mirror of `packages/tools/a5p5-tools/src/backend-contract.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-contract.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/backend-contract.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-contract.js` — mirror of `packages/tools/a5p5-tools/src/backend-contract.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-contract.js.map` — mirror of `packages/tools/a5p5-tools/src/backend-contract.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-direct.d.ts` — mirror of `packages/tools/a5p5-tools/src/backend-direct.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-direct.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/backend-direct.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-direct.js` — mirror of `packages/tools/a5p5-tools/src/backend-direct.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-direct.js.map` — mirror of `packages/tools/a5p5-tools/src/backend-direct.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-stub.d.ts` — mirror of `packages/tools/a5p5-tools/src/backend-stub.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-stub.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/backend-stub.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-stub.js` — mirror of `packages/tools/a5p5-tools/src/backend-stub.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/backend-stub.js.map` — mirror of `packages/tools/a5p5-tools/src/backend-stub.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/effects-schema.d.ts` — mirror of `packages/tools/a5p5-tools/src/effects-schema.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/effects-schema.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/effects-schema.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/effects-schema.js` — mirror of `packages/tools/a5p5-tools/src/effects-schema.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/effects-schema.js.map` — mirror of `packages/tools/a5p5-tools/src/effects-schema.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/index.d.ts` — mirror of `packages/tools/a5p5-tools/src/index.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/index.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/index.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/index.js` — mirror of `packages/tools/a5p5-tools/src/index.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/index.js.map` — mirror of `packages/tools/a5p5-tools/src/index.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/pipeline.d.ts` — mirror of `packages/tools/a5p5-tools/src/pipeline.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/pipeline.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/pipeline.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/pipeline.js` — mirror of `packages/tools/a5p5-tools/src/pipeline.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/pipeline.js.map` — mirror of `packages/tools/a5p5-tools/src/pipeline.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/register.d.ts` — mirror of `packages/tools/a5p5-tools/src/register.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/register.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/register.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/register.js` — mirror of `packages/tools/a5p5-tools/src/register.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/register.js.map` — mirror of `packages/tools/a5p5-tools/src/register.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/render.d.ts` — mirror of `packages/tools/a5p5-tools/src/render.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/render.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/render.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/render.js` — mirror of `packages/tools/a5p5-tools/src/render.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/render.js.map` — mirror of `packages/tools/a5p5-tools/src/render.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/spill.d.ts` — mirror of `packages/tools/a5p5-tools/src/spill.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/spill.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/spill.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/spill.js` — mirror of `packages/tools/a5p5-tools/src/spill.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/spill.js.map` — mirror of `packages/tools/a5p5-tools/src/spill.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/types.d.ts` — mirror of `packages/tools/a5p5-tools/src/types.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/types.d.ts.map` — mirror of `packages/tools/a5p5-tools/src/types.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/types.js` — mirror of `packages/tools/a5p5-tools/src/types.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/a5p5-tools/src/types.js.map` — mirror of `packages/tools/a5p5-tools/src/types.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/agent-control-contribution.mjs` — mirror of `packages/tools/agent-control-family/src/agent-control-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/agent-control-executor.mjs` — mirror of `packages/tools/agent-control-family/src/agent-control-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/agent-control-mechanics.mjs` — mirror of `packages/tools/agent-control-family/src/agent-control-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/agent-runtime-port.mjs` — mirror of `packages/tools/agent-control-family/src/agent-runtime-port.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/fork-row.mjs` — mirror of `packages/tools/agent-control-family/src/fork-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/index.mjs` — mirror of `packages/tools/agent-control-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/interrupt-row.mjs` — mirror of `packages/tools/agent-control-family/src/interrupt-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/list-agents-row.mjs` — mirror of `packages/tools/agent-control-family/src/list-agents-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/list-models-row.mjs` — mirror of `packages/tools/agent-control-family/src/list-models-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/native-output-schemas.mjs` — mirror of `packages/tools/agent-control-family/src/native-output-schemas.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/spawn-row.mjs` — mirror of `packages/tools/agent-control-family/src/spawn-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/steer-row.mjs` — mirror of `packages/tools/agent-control-family/src/steer-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-control-family/src/workflow-row.mjs` — mirror of `packages/tools/agent-control-family/src/workflow-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-state-family/src/agent-state-law.mjs` — mirror of `packages/tools/agent-state-family/src/agent-state-law.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-state-family/src/contribution.mjs` — mirror of `packages/tools/agent-state-family/src/contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-state-family/src/executors.mjs` — mirror of `packages/tools/agent-state-family/src/executors.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-state-family/src/fs-state-store.mjs` — mirror of `packages/tools/agent-state-family/src/fs-state-store.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-state-family/src/index.mjs` — mirror of `packages/tools/agent-state-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/agent-state-family/src/state-store.mjs` — mirror of `packages/tools/agent-state-family/src/state-store.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/agent-control.mjs` — mirror of `packages/tools/families/agent-control.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/agent-state.mjs` — mirror of `packages/tools/families/agent-state.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/fs.mjs` — mirror of `packages/tools/families/fs.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/index.mjs` — mirror of `packages/tools/families/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/inspect.mjs` — mirror of `packages/tools/families/inspect.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/manifest.json` — mirror of `packages/tools/families/manifest.json` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/process.mjs` — mirror of `packages/tools/families/process.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/search.mjs` — mirror of `packages/tools/families/search.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/ui.mjs` — mirror of `packages/tools/families/ui.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/families/web.mjs` — mirror of `packages/tools/families/web.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/edit-executor.mjs` — mirror of `packages/tools/fs-family/src/edit-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/edit-row.mjs` — mirror of `packages/tools/fs-family/src/edit-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/fs-family-contribution.mjs` — mirror of `packages/tools/fs-family/src/fs-family-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/fs-mechanics.mjs` — mirror of `packages/tools/fs-family/src/fs-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/fs-mutation-mechanics.mjs` — mirror of `packages/tools/fs-family/src/fs-mutation-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/fs-read-contribution.mjs` — mirror of `packages/tools/fs-family/src/fs-read-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/image-executor.mjs` — mirror of `packages/tools/fs-family/src/image-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/image-read-port.mjs` — mirror of `packages/tools/fs-family/src/image-read-port.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/image-row.mjs` — mirror of `packages/tools/fs-family/src/image-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/index.mjs` — mirror of `packages/tools/fs-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/read-executor.mjs` — mirror of `packages/tools/fs-family/src/read-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/read-normalizer.d.ts` — mirror of `packages/tools/fs-family/src/read-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/read-normalizer.d.ts.map` — mirror of `packages/tools/fs-family/src/read-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/read-normalizer.js` — mirror of `packages/tools/fs-family/src/read-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/read-normalizer.js.map` — mirror of `packages/tools/fs-family/src/read-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/read-presentation.mjs` — mirror of `packages/tools/fs-family/src/read-presentation.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/read-row.mjs` — mirror of `packages/tools/fs-family/src/read-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/write-executor.mjs` — mirror of `packages/tools/fs-family/src/write-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/fs-family/src/write-row.mjs` — mirror of `packages/tools/fs-family/src/write-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/index.mjs` — mirror of `packages/tools/inspect-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/inspect-executor.mjs` — mirror of `packages/tools/inspect-family/src/inspect-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/inspect-family-contribution.mjs` — mirror of `packages/tools/inspect-family/src/inspect-family-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/inspect-mechanics.mjs` — mirror of `packages/tools/inspect-family/src/inspect-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/inspect-rows.mjs` — mirror of `packages/tools/inspect-family/src/inspect-rows.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/row-names.mjs` — mirror of `packages/tools/inspect-family/src/row-names.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/skill-executor.mjs` — mirror of `packages/tools/inspect-family/src/skill-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/skill-mechanics.mjs` — mirror of `packages/tools/inspect-family/src/skill-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/inspect-family/src/skill-row.mjs` — mirror of `packages/tools/inspect-family/src/skill-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/bash-contribution.mjs` — mirror of `packages/tools/process-family/src/bash-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/bash-normalizer.d.ts` — mirror of `packages/tools/process-family/src/bash-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/bash-normalizer.d.ts.map` — mirror of `packages/tools/process-family/src/bash-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/bash-normalizer.js` — mirror of `packages/tools/process-family/src/bash-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/bash-normalizer.js.map` — mirror of `packages/tools/process-family/src/bash-normalizer.ts` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/bash-row.mjs` — mirror of `packages/tools/process-family/src/bash-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/confined-shell-executor.mjs` — mirror of `packages/tools/process-family/src/confined-shell-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/index.mjs` — mirror of `packages/tools/process-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/pwsh-confined.mjs` — mirror of `packages/tools/process-family/src/pwsh-confined.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/pwsh-executor.mjs` — mirror of `packages/tools/process-family/src/pwsh-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/pwsh-mechanics.mjs` — mirror of `packages/tools/process-family/src/pwsh-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/pwsh-row.mjs` — mirror of `packages/tools/process-family/src/pwsh-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/process-family/src/shell-mechanics.mjs` — mirror of `packages/tools/process-family/src/shell-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/cancel-leg.mjs` — mirror of `packages/tools/search-family/src/cancel-leg.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/glob-backend.mjs` — mirror of `packages/tools/search-family/src/glob-backend.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/index.mjs` — mirror of `packages/tools/search-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/search-backend.mjs` — mirror of `packages/tools/search-family/src/search-backend.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/search-contribution.mjs` — mirror of `packages/tools/search-family/src/search-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/search-mechanics.mjs` — mirror of `packages/tools/search-family/src/search-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/search-row.mjs` — mirror of `packages/tools/search-family/src/search-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/search-family/src/stream-drain.mjs` — mirror of `packages/tools/search-family/src/stream-drain.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/ask-executor.mjs` — mirror of `packages/tools/ui-family/src/ask-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/ask-row.mjs` — mirror of `packages/tools/ui-family/src/ask-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/index.mjs` — mirror of `packages/tools/ui-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/present-executor.mjs` — mirror of `packages/tools/ui-family/src/present-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/present-row.mjs` — mirror of `packages/tools/ui-family/src/present-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/ui-family-contribution.mjs` — mirror of `packages/tools/ui-family/src/ui-family-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/ui-interaction-port.mjs` — mirror of `packages/tools/ui-family/src/ui-interaction-port.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/ui-family/src/ui-mechanics.mjs` — mirror of `packages/tools/ui-family/src/ui-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/fetch-executor.mjs` — mirror of `packages/tools/web-family/src/fetch-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/fetch-row.mjs` — mirror of `packages/tools/web-family/src/fetch-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/index.mjs` — mirror of `packages/tools/web-family/src/index.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/search-executor.mjs` — mirror of `packages/tools/web-family/src/search-executor.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/search-row.mjs` — mirror of `packages/tools/web-family/src/search-row.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/web-family-contribution.mjs` — mirror of `packages/tools/web-family/src/web-family-contribution.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/web-mechanics.mjs` — mirror of `packages/tools/web-family/src/web-mechanics.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/web-search-provider.mjs` — mirror of `packages/tools/web-family/src/web-search-provider.mjs` (A1 delete/replace source); stale build output deleted with its source.
- `packages/runtime/dist/packages/tools/web-family/src/web-transport.mjs` — mirror of `packages/tools/web-family/src/web-transport.mjs` (A1 delete/replace source); stale build output deleted with its source.

## 3. Referrers repaired (not deleted)

These files only NAMED the row; the entry was removed, the file and every other assertion
kept.

- `packages/domain/test/a5p0-layer-audit.test.ts` — removed the shadow-row line and its
  comment from the pinned `verdict.consumers` list; the rest of the audit table is unchanged.
- `scripts/audit-a5-tool-governance-imports.mjs` — removed the matching
  `runtime/src/plugin/live/center-shadow-row.mjs` entry from `PR1_CONSUMERS` (the script is
  the table the a5p0 test runs and pins; leaving it would make the test's own lint arm report
  an `expected PR1 consumer never found` finding for a deleted file).
- `packages/runtime/test/u6-pr2-kernel-flow.test.ts` — comment only: dropped the PR1
  precedent citation of the deleted suite; no leg or assertion changed.
- `tests/world-factory/lib/world-factory.mjs` — removed `U6_CENTER_SHADOW_ROW_REL` and the
  `U6_CENTER_ROW_URL` env hand-down (the only place the world builder named the row); the
  `centerAssembly` plumbing, the mount row and the ledger path stay. A `'shadow'` World now
  records `center-error` ("row URL unset") instead of importing a deleted file — a visible,
  honest state rather than a silent fake mount. `pathToFileURL` became unused and was dropped
  from the import.
- `tests/world-factory/canary/u6-shadow-host.mjs` — comment only: header now records that the
  product row and its C1 suite retired at the A1 cut and that `U6_CENTER_ROW_URL` is never set
  (so the fixture records `center-error`); the mount-row code is untouched and never imports a
  deleted path.
- `packages/testkit/test/p4t6-bookings/u6pr1.json` — removed the row from `paths` (the
  fixture's historical booking delta is left as-is, matching the instruction to remove the
  row entry only; the whole p4t6 ledger is already red for the cut's 133 booked deletions).
- `packages/testkit/test/p4t6-bookings/fixk.json` — removed `center-shadow-row.mjs` from the
  historical `reason` prose only.

## 4. Gates (verbatim)

```
$ node scripts/ute-cut-closure.mjs --write
UTE-CUT-CLOSURE write deleted=148 references=163 distResiduals=0 cut=cut dupNames=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=163 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
```

`node --check` was run on every touched `.mjs`
(`scripts/audit-a5-tool-governance-imports.mjs`, `tests/world-factory/lib/world-factory.mjs`,
`tests/world-factory/canary/u6-shadow-host.mjs`) and on the unchanged gate script; all pass.
The full test suite was deliberately not run (§6 of the window plan: many suites are red in
this window by design).

## 5. Gate conflict: the requested allow.json registration cannot be green

The task asked for each retired suite to be registered in
`dev/agent-workflow/ledgers/ute-cut-closure.allow.json`. That was attempted and **rejected by
the frozen gate**, which treats an entry as stale unless a *surviving tracked file* still
refers into the delete set:

```
UTE_CLOSURE_STALE_EXEMPTION packages/runtime/test/u6-fixk-shadow-ledger.test.ts is registered but no longer refers to the delete set — remove it
UTE_CLOSURE_STALE_EXEMPTION packages/runtime/test/u6-pr1-shadow-inert.test.ts is registered but no longer refers to the delete set — remove it
```

A deleted file is not scanned, so it can never satisfy the exemption rule; the two goals
("register the deleted suites" and "findings=0") are mutually exclusive under the frozen
script. Per the constraint **no gate edits**, the entries were not kept: the registry stays
for *surviving* referrers, and the retirement of the two suites is recorded here (with the
requested reason text) plus the deletion diff. If the owner wants them in the machine ledger,
the gate needs a new "retired with subject" channel (a `retired` list or a
`retired-module`-aware stale rule) — a frozen-evidence change I did not make.

## 6. Residual referrers I refused to change (reported, not repaired)

- `scripts/ute-cut-closure.mjs` (and `ute-cut-closure.dispositions.json`) still carry the
  `center-shadow-row.mjs -> replace` disposition. Both are frozen evidence; the disposition is
  now historical (the file is gone). The gate has no stale-disposition rule, so it is green.
- `scripts/dist-placements/010-runtime-live-rows.json` still places the row (and, from the
  earlier cut, `agent-bindings.mjs`, `team-tool-plane.mjs`, `pa-mount-registry.mjs`). Placement
  manifests are tooling, tolerated by the closure gate, and the cut already left the same
  class of entry for its own deleted sources (030–110 all name deleted family lanes). Fixing
  one entry would be arbitrary; the whole manifest needs a placement-retirement pass.
- `scripts/diag-call-chain.mjs` still cites `center-shadow-row.mjs:203` in `SHADOW_CITE`; the
  diagnostic treats an unreadable file as "no citation", so it degrades quietly. Left as the
  diagnostic owner's call.
- `dev/ci/census-population-baseline.json` still lists the two deleted suites; it is generated
  and was already stale for the cut's 148 deletions (regeneration is a CI acceptance act).
- The p4t6 ledger remains red by design: 133 of its booked paths were deleted by the cut
  (including the two suites above); this change only removed the row's name, per instruction.

## 7. What this change does NOT claim

- It does not re-decide, add to, or remove from the frozen 148-file delete set.
- It does not delete any test whose subject survives, and does not weaken any remaining
  assertion; the only test edits are the row entry and the dead-precedent comment.
- It does not re-create `governance-center`, the row, or any compatibility shim.
- It does not touch `packages/runtime/src/plugin/vnext/`, the window ledger, or the two gate
  scripts.
