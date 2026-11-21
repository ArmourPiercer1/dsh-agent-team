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

## 7. The closure gate has a measured blind spot — escalation, not a local fix

`ute-cut-closure.mjs`'s `distCounterpartsOf` maps a source only to the **same-package** dist path
and only for `.js`/`.d.ts`/`.map`. The aggregated `packages/runtime/dist/packages/<other-pkg>/*.mjs`
byte-copies are therefore invisible: all eight retired family lanes, `a5p5-tools`,
`families/manifest.json` and the live-row mirrors survived the A0 "52 dist artifacts" measurement
and reported `distResiduals=0` both before and after. The real count was **150 frozen-source
mirrors plus the row mirror**; they are all deleted in `82deae159`, so the four zeros are true
*today*, but they were true *by accident* at A0: a future cut could leave a full stale dist tree
in place and still print `distResiduals=0`.

This is an evidence/tooling defect, not a keep-delete verdict — no frozen module verdict changes —
so it is recorded here rather than fixed unilaterally: `ute-cut-closure.mjs` is frozen A0 evidence.
The owner decision requested is narrow: teach `distCounterpartsOf` the cross-package aggregated
layout (`dist/packages/<pkg>/...` for every tracked package, any extension), then re-run `--write`
so the frozen report can no longer undercount. Until then every claim about dist residuals in this
window carries the correction "the gate undercounts aggregated mirrors; the cut deleted them by
hand and the tree is verified empty by `find tmp -name '*.mjs'` against the deleted set", not the
gate's zero alone.

A second, smaller correction: the instruction to "register the two retired suites in
`ute-cut-closure.allow.json`" was wrong and was refused correctly. A deleted file is never
scanned, so an exemption for it is `UTE_CLOSURE_STALE_EXEMPTION`; the existing 85
`retired-module` entries are for files that SURVIVE and refer to the delete set. Retirement of the
two suites is complete by deletion alone, and their reason is recorded in §5.

## 8. Withdrawal: the centre does not get a second I/O algebra

`vnext/effective-io.ts` was written in this window before `packages/runtime/member-io-policy/`
was read. That package is the product's compiler — 2,524 lines, `compileMemberPolicy`,
`compileEffectiveIo`, `coversLocator`, `matchLocator`, `bindInvocation`/`consumeInvocation`, the
approval-takeover codes — and it is what the realm compiler consumes. A second algebra in
`vnext/` would have been exactly the fork this plan exists to prevent: two answers to "may this
call touch this path", with the weaker one deciding whenever it was reached first.

It is withdrawn in the same window it was written. The two arms that were genuinely worth keeping
were re-checked against the product implementation before dropping them, not merely assumed:
`coversLocator('/w/a', '/w/ab') === false` (a subtree boundary is a PATH boundary, not a string
prefix), `('/w/a','/w/a/b') === true`, `('/w/a','/w') === false`, and `toLocatorKey('/w/../etc')`
preserves the `..` segment instead of normalizing it away, so a dot-dot path cannot match an
ancestor rule.

The centre's rule from here: **it calls `member-io-policy`; it never re-derives it.**

## 9. A1 acceptance slice: measured, not argued

`packages/runtime/test/vnext-fs-slice.test.mjs` — four arms on the pinned baseline's own code (the
real `@deepseek-ai/dsh-tools` registry, the real `@deepseek-ai/dsh-tool-fs` module from the pinned
built tree, the real `LocalFileSystem`, Cordis scopes) and no Team-authored tool body:

| arm | measured |
| --- | --- |
| SLICE-1 | the member resolves a **different definition object** than its preset installed, while `execute` is the **same function source** — the mount took effect and the body is still the host's |
| SLICE-2 | an in-ceiling `read` succeeds and exactly one call reaches the member provider |
| SLICE-3 | an out-of-ceiling `read` is refused by the member's own lane (`outside every allow subtree`), the bytes never appear in the result, and the real filesystem is **not touched at all** (zero stat/lstat/read calls) |
| SLICE-4 | negative control — the same world without the realm mount reads the outside file successfully, so the three arms above are falsifiable |

**Owner risk #1 is closed at the mechanism level:** a native tool on a Member scope does resolve
that member's controlled provider, through public seams only, with no Shadow Definition and no
host patch. The remaining question for D is not "is this possible" but "does the product assembly
wiring reach it on a real host boot", which is a B/D item.

Two lane defects the slice found and fixed: the mount takes **descriptors**, not module
namespaces; and **deferred registration** means "unchanged at mount-return" is not a fact — the
lane now re-reads until every declared name changed or a bounded settle budget is spent, then
judges. `read_image` is deliberately undeclared in this world: the pinned tool-fs registers it
from a deferred child that injects `attachments`, which the minimal world does not mount, so it is
an absent optional capability (the mount seam's own settle rule), not a missing mount.

## 10. OPEN OBLIGATION: the three new suites are not yet collected by CI

`packages/runtime/test/vnext-{realm-lane,fs-slice,admission}.test.mjs` run and pass locally, but
`scripts/test-catalog.mjs` refuses them:

```
REFUSED UNCOLLECTED_NEW packages/runtime/test/vnext-admission.test.mjs
REFUSED UNCOLLECTED_NEW packages/runtime/test/vnext-fs-slice.test.mjs
REFUSED UNCOLLECTED_NEW packages/runtime/test/vnext-realm-lane.test.mjs
```

That is the gate working: a suite nothing collects is a suite that never runs, and the baseline
count ratchet is 41. Two ways out exist and only one of them is honest:

- `--write-uncollected-baseline` and raising `--max-uncollected` to 44 — **rejected**, this is
  exactly the "widen the skip budget to stay green" move the plan forbids; the suites would be
  recorded as permanently uncollected.
- declare a **ci-census leg** with `env.A5SF_REQUIRE_PINNED_HOST='1'` naming all three suites,
  plus the workflow step that runs `node scripts/dispatch-tests.mjs --run --leg <id>` —
  **the intended fix, not attempted in haste**: the fs-slice and realm-lane suites load the pinned
  baseline's built `lib/` entries, so a leg without that env would fail rather than refuse, and a
  leg declared in the manifest without its workflow step is the "declared but never run" shape the
  same gate refuses (`CI_LAYER_LEG_MISSING`, `CI_HOST_REFUSAL_UNGUARDED`). It needs one careful
  edit across `dev/ci/eb3-ci-manifest.json` and `.github/workflows/ci-census.yml`, validated by
  `node scripts/eb3-ci-required.mjs`, which is the first task of the next round.

**RESOLVED in the same window.** A new `ci-census` leg
(`ute vnext A1 (node:test, pinned host REQUIRED; realm mount + real FS slice + admission)`) declares
the three suites in `suites[]` with `env.A5SF_REQUIRE_PINNED_HOST='1'`, and `census-runtime.yml`
runs it through `scripts/dispatch-tests.mjs --run --leg ute-vnext-a1`. Two things had to be right,
and both are the gate's own reasons:

- the leg's argv is **distinct** (`dispatch-tests.mjs --run --leg …`) rather than the shared
  `node --test --test-force-exit …` prefix, because a shared prefix makes the whole-trailing-argv
  reader attribute the B4 steps' files to this leg (`CI_LAYER_LEG_EXTRA_ARGUMENT`, measured);
- `A5SF_REQUIRE_PINNED_HOST=1` makes an absent pinned host a **RED** here, not a declared refusal,
  since these suites load the pinned built `lib/` entries.

Measured after the change: `EB3-CI-REQUIRED pass workflows=10 findings=0` and
`DSH-TEST-CATALOG tests=885 refused=0 findings=0` at the unchanged `--max-uncollected 41`. Nothing
was added to the uncollected baseline and no ratchet was raised.

## 11. B's first three guarantees, and what "migrated" can and cannot mean here

**Durable admission + no replay (SLICE-12/13/14).** An in-memory fact array cannot answer after a
crash, so the ledger is an append-only JSONL file and a *second* world on the same file stands in
for the resumed process (nothing carried in memory between them). Both decisions read back — the
allow and, importantly, the refusal (`has()` is true for a callId that was denied: it was decided).
A replay after that restart is refused `ADMISSION_REPLAY`, the first decision is not overwritten,
and the attempt is recorded as its own `replay-refusal` line. The ledger refuses its own corruption
by name: `LEDGER_TRUNCATED`, `LEDGER_DUPLICATE_AUTHORITY`, `LEDGER_EXECUTION_UNBOUND`.

Two defects the arms found, both real: the host consults a guard **more than once per execution**
(prepare and commit both ask) — the port now memoizes the verdict per callId, so consulting twice
cannot append a second authority record or change its mind; and `readAll()` registered records into
the live map before `has()` re-read the same lines into it, reporting a corrupt ledger on a good
file.

**One native registration per name (SLICE-15).** The static `dupNames=0` from the closure gate is
not where the model reads. `tools.schemas(agentKey)` has no name twice, `read`/`write`/`edit` each
appear exactly once, and the single visible entry **is** the member-mounted definition — a name
present once while dispatch resolved the inherited body would be the old defect wearing one entry.

**The 16 kept-capability tests.** They were re-pointed at `vnext/agent-bindings.mjs` /
`vnext/root.js`; a static check over all 16 (`migrated-entry-imports.json`) finds **every imported
symbol exported by the new entry, 0 missing**. That is the strongest claim available in this
environment and it is deliberately weaker than "the tests pass": they are `vitest` suites and
vitest cannot run here (recorded env limitation), so their execution is a CI obligation, not a
measured fact. Calling this "migration verified" on the strength of an import check would be
exactly the kind of unproven claim the plan forbids.

## 12. Two states of the observation policy, measured on the vnext assembly

In this host the policy has **no config switch**: it is mounted or absent, so absence IS the off
state and the arms differ by exactly one plugin.

| arm | state | measured |
| --- | --- | --- |
| SLICE-17 | OFF (product default for A1/B) | an overwrite of an existing file needs no prior read and lands |
| SLICE-18 | ON | the same overwrite is refused with the policy's own sentence (`file has not been read — read the file, then retry`), the file stays byte-identical, and the SAME write lands after one observation read |
| SLICE-19 | ON | read → another writer changes the file → write is refused as stale and the external bytes survive |

Two things this settles that the plan left implicit: the refusal is matched on the policy's own
wording rather than `isError`, so no unrelated failure can satisfy the arm; and a policy mounted on
the ROOT scope still governs a member's write through its own realm, because the observed state is
keyed by the calling session, not by the provider instance.

## 13. CLOSED (same window): lifecycle close was a fail-open, now a refusing tombstone

> **Status: fixed.** The measurement below is kept because the shape of the fix follows from it.
> After the fix SLICE-23 asserts the inverted behaviour: the agent no longer resolves the preset
> definition, an outside locator is refused with `MEMBER_CLOSED`, and the closed name REMAINS
> declared (as closed) so the model's catalogue does not silently change shape.

### The measurement that started it: a disposed member's native tools still execute

Measured while adding the lifecycle arm. In the slice world the member realm is disposed and the
mounted module fibers are released, yet a `read` dispatched after disposal **still returns the
file**, through the member's confined provider. The centre's own guarantees do hold (no new
decision, no new fact after close), so SLICE-23 asserts exactly that and records this as an open
defect rather than encoding the leak as expected behaviour.

Why it matters: "lifecycle close" is a B requirement, and a retired member whose native tools keep
executing for whoever still holds the scope is the retired route's failure mode with the roles
swapped. **Sharper, measured afterwards:** what happens after close is not a stale mount but a FAIL-OPEN. The
agent's `read` reverts to the PRESET definition, and the preset body is served by the UNCONFINED
base provider - a locator outside the member's ceiling becomes readable again. So closing a member
by disposing its realm, while the agent scope is still alive, WIDENS the surface instead of removing
it. SLICE-23 now pins that measured state explicitly (a characterization of a defect, not an
expectation of correct behaviour); when close is implemented the assertion must be inverted, never
deleted.

The shape of the fix is therefore not "dispose harder": a member that is closed must either take its
agent scope with it (product teardown) or leave a refusing tombstone on its own tool layer, because
removing an own registration only exposes the inherited one. Two candidate causes for why the
removal happens at all, neither yet confirmed:

1. the row's `mountMemberA5sfRealm` returns a HANDLE (`{realm, installation}`), so
   `realm.disposeNativeToolModules` is not the mounted realm's disposer and the lane's fallback
   disposes fibers that had already been superseded;
2. the tool-fs module registers on its FIRST `apply()` and later applies reuse the registration,
   so the fiber disposed is not the one that owns the live registration (the same C1
   ownership-probe hazard `a5sf-realm-row.mjs:1237` documents for the shadow lane).

Not fixed in this round on purpose: the fix belongs in the row's dispose path, it needs its own
arm proving the definition is GONE (not merely that the call fails), and a rushed patch here would
hide the defect behind a passing test.

### The fix, and the one window it accepts

`mountHostModules` now returns a `dispose` that releases the mounted fibers and then registers a
refusing tombstone per mounted name on the member's own tool layer. The order is forced: the
tombstone cannot be registered while the live definition occupies the name (`tool "read" is already
registered in this scope`, measured), so release comes first and the refusal takes its place
immediately after, inside the same call. The window between the two is the body of `dispose` - no
dispatch can interleave inside it - and it is the smallest window that exists, because removal alone
leaves the unconfined inherited body in place permanently.

This is also why "dispose harder" was the wrong instinct: an own registration that is removed exposes
its ancestor, and the ancestor here is the composition provider with no confinement at all.

## 14. Probe-ladder status (honest table)

| rung | tool | mounted in the slice? | what is proven | what is NOT |
| --- | --- | --- | --- | --- |
| 1 | `read` | yes | identity, in/out ceiling, refusal, facts, replay, Stop, close | — |
| 2 | `write` | yes | same, on the write lane | — |
| 3 | `edit` | yes (mounted) | — | no arm yet; the definition is mounted but untested |
| 4 | `grep`/`glob` | no | the ADMISSION gate: outside path denied, inside allowed, an omitted `path` means the workspace root and is judged, not waved through | no positive control (no spawn). The module needs `subprocess`, `spill` and `systemPrompt` providers this world does not mount |
| 5 | `web_fetch` | no | the NETWORK axis: unset is not allow, deny is deny, allow is allow, and the fs lanes say nothing about it | no positive control (no `web` provider) |
| 6 | `bash` / `run_code` | no | EXPLICIT `ADMISSION_AXIS_UNSUPPORTED`: the compiled policy has no subprocess lane, so the call is refused rather than admitted | no positive control, and no subprocess lane to enforce |

`@vscode/ripgrep` IS present in the pinned runtime (pnpm store, 1.18.0), so rung 4 is not blocked by a
missing binary. It is blocked by the three providers the search module injects. That is a wiring
task, not an ENV_BLOCK, and it is not counted as either a pass or a block here.

The subprocess refusal is the contract, not a TODO that will quietly become an allow: when C wires
the family, it must arrive with a compiled subprocess lane, otherwise the refusal stays.
