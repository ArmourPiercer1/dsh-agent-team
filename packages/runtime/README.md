# @dsh-agent-team/runtime

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on
conflict, `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, "状态与恢复"). Capabilities here are delivered as an external plugin over public
seams — `CORE PATCH BUDGET = 0`: nothing in this package may patch upstream DSH, use upstream
private APIs, or carry a vendored modified upstream (`AGENTS.md`, 红线).

In the frozen 9-package structure (TaskDoc §11), this is the host-side assembly package.

## Responsible for

Per its own `src/index.ts`: *"Binder / Activation / Projection over the public DSH seams, the
MemberInstance lifecycle (CREATED / RUNNING / SETTLED / ARCHIVED / DISPOSED; Restore = ARCHIVED
→ SETTLED — durable availability only, no Agent resume), and the host half of the
dsh-agent-team Cordis plugin (see ./plugin/host.ts)."*

- `src/plugin/` — the Cordis plugin surface: `host.ts` (the mounted entry), `root.ts`,
  `permission-plane.ts`, `blueprint-*`, `team-session-*`, `effective-config-view.ts`,
  `seams.ts`, `upstream-resolver.mjs`, and `src/plugin/live/` (agent bindings, tool plane,
  effect backends, jobs gateway assembly, PA mount registry).
- 30 **lane** directories at the package root, each listed in `tsconfig.build.json` and each
  typically fronted by an `index.ts` facade. Named after the phase that produced them, e.g.
  `activation` (ActivationProvider facade), `admission` (authority/envelope/quota/compat
  admission), `control` (durable control/approval plane), `action-router` (unified authority
  router), `activity` (activity ledger), `projection`, `mutation`, `lifecycle`
  (Archive/Restore), `handoff`, `fork-reconciliation`, `requirements`, `readiness`,
  `effective-policy`, `governance`, `coordination`, `messaging`, `member-residency`,
  `root-binding`, `tool-dispatch`, `tool-admission`, `controlled-fs`, `sandbox-provider`,
  `jobs-gateway`, `permission-governance` / `permission-lifecycle` / `permission-notification` /
  `permission-overlay*`, `operation-permission`, `governance-warning`, `intervention`,
  `compatibility`, `requirement-facts`, `work-completion-notification`, `artifact-read`,
  `activation`, `agent-setup`, `mutation/$internal`.
- Launching confined processes is a genuine responsibility, not an accident: `child_process`
  appears in production-lane code — `sandbox-provider/provider.ts`,
  `sandbox-provider/probe-abi.ts`, `src/plugin/live/plane-effect-backends.mjs`. **Do not**
  describe this package as process-free.

## NOT responsible for

Grep over the whole package excluding `dist/`:

- `WebSocket` → 0, `node:net` → 0, `XMLHttpRequest` → 0.
- `node:http` and `fetch(` appear **only** in test harnesses
  (`member-residency/harness/*`, `root-binding/harness/*`); `src/` contains no `fetch`.
- No `.tsx` files and no `react` import in `src/` → no UI here.
- It does not read the legacy package: no imports of `../../legacy` or `../../client`.
- It does not define the frozen shapes: it imports them from `../../contracts/src/index.js`
  and from `storage/schema`. No JSON Schema or schema YAML lives here (the only `.yml` is a
  test fixture, `test/issue2-fixtures/**/agent.cordis.yml`).
- `zod` is declared as a dependency but is **not used in `src/`** (only in harness `.mjs` files
  and `test/u6-mcp-017-regression.test.ts`); `yaml` is used in exactly one file,
  `src/plugin/team-skills.ts`.

**Not established**: whether every lane is wired into the running composition — the lane
barrels were read, `composition-smoke` was not executed. Sibling packages are addressed by
**relative path** (`../../contracts/src/index.js`), never by package name; a grep for
`from '@dsh-agent-team/` returns zero across the repository.

## Two layout facts that will mislead a reader, recorded rather than fixed

1. `package.json` declares `main`/`"."` → `./dist/index.js`, but `tsconfig.build.json` uses
   `rootDir: "../.."`, so the emitted file is `dist/packages/runtime/src/index.js`. The
   declared entry does not match the emitted layout, and `packages/runtime/dist/index.js` does
   not exist. The entry the harness actually mounts is
   **`dist/packages/runtime/src/plugin/host.js`**, wired by the repo-root `cordis.patch.yml`
   row `name: dsh-agent-team/host`. `src/index.ts` itself exports only a `PACKAGE_ID` marker.
2. `packages/runtime/dist` is **committed to git** (1752 tracked files) and contains emitted
   trees for contracts/domain/legacy/remote/runtime/storage/tools. It is a build artifact under
   version control, managed by `scripts/check-artifacts-committed.mjs` and
   `scripts/place-dist-glue.mjs` — so a diff touching `dist/` is a regenerated artifact, not
   source. Neither fact is changed by this document; both are named here because both have
   bitten readers.

## Source, contract and test entry points

| what | where |
| --- | --- |
| production entry (mounted) | `src/plugin/host.ts` → `dist/packages/runtime/src/plugin/host.js` |
| declared package entry | `src/index.ts` (marker only — see layout fact 1) |
| plugin surface | `src/plugin/`, `src/plugin/live/` |
| lane facades | `<lane>/index.ts` for each of the 30 lanes |
| tests | `test/` — 422 `*.test.ts` plus ~40 helpers, flat; families `a2*`, `a3*`, `a4*`, `a5*`, `p5t*`…`p8t*`, `t12*`, `control-*`, `permission-overlay*`, `recovery-*`, `s6t*` |
| bounded harnesses | `member-residency/harness/`, `root-binding/harness/` (`bounded-run.mjs`, `mini-mcp.mjs`, `*.regression.test.mjs`) |
| lane-local tests / docs | `controlled-fs/test/` (+ its own README), `member-residency/README.md` |
| upstream packages consumed | `@deepseek-ai/dsh-{agent,llm,mcp-client,spill,spill-local,storage-domain,tool-fs-search,session}` and Cordis plugin packages, all pinned to the version in `tests/paths.mjs` terms at the root, never re-pinned here |
| cross-package imports | `contracts` (338 lines), `domain/*` (507), `storage/*` (284), `remote` (104), `testkit` (78 — **every one inside `test/`**, which is what the "no production package may depend on testkit" rule governs), `tools` (40) |

Commands in `package.json` — **entry points, none run for this document**: `build`
(`tsc -p tsconfig.build.json`), `typecheck` (`tsc -p tsconfig.json`), `test` (`vitest run`).
Test-host and world constraints (pristine host checkout, `DSH_HOME` inside the workspace, port
family) are **not** this package's to state — the single source is `docs/TEST_METHODS.md` and
`tests/paths.mjs`. No Host run was performed here.

## Owner

**No owner is recorded for this package.** Neither `dev/engineering/registry.yaml` nor
`docs/contracts/engineering-baseline/ids.yaml` names it; the roles those files do declare
(`Contract/Security Owner` for `INV-EB-0001…0008`, `Tooling Owner`, `Doc/Contract Owner`, …)
cover invariants and the EB line's own tooling, not this package. Before changing a lane that
implements an `INV-EB-*` invariant, read its `source_anchor` in
`docs/contracts/engineering-baseline/ids.yaml` — for tool/permission governance that resolves
into `docs/plans/active/alpha5-tool-io-governance/` (M0 lifecycle contract, effective backlog,
tool capability matrix), which remain authoritative for that behaviour.
