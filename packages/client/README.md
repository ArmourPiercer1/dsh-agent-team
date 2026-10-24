# @dsh-agent-team/client

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on any
conflict `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, 状态与恢复). `CORE PATCH BUDGET = 0` is stated in this package's own words as a
construction rule, not just a repo rule (`AGENTS.md`, 红线).

In the frozen 9-package structure (TaskDoc §11): the browser half.

## Responsible for

Its own `src/index.ts`: *"Responsibility (TaskDoc §11 package boundary): the dsh-agent-team
Cordis client plugin (see ./plugin/client.ts) and the Team UI (slots / panels), built only on the
public client surface."*

- `src/plugin/client.ts` — the Cordis client plugin object (name / inject / Config / apply), and
  *"the ONLY module in the package that value-imports a `.tsx` component … Browser-safe by
  construction: no Node.js builtins, no DOM assumptions, no DSH internal API (CORE PATCH BUDGET =
  0)"*. `src/plugin/team-mount-core.ts` carries the mount logic.
- `src/ui/` — 12 `.tsx` panels (`NewTeamEntry`, `TeamActivity`, `TeamCreationPanel`, `TeamDock`,
  `TeamGovernance`, `TeamInterventions`, `TeamLedger`, `TeamMemberDialogs`, `TeamMembers`,
  `TeamSettingsSection`, `TeamTimeline`, `TeamView`), 12 `.module.css`, and `locales.ts`.
- `src/model/` (17 files) — projection and ledger adapters, the dock/timeline/members/ledger/
  governance/intent/interventions/legacy/handoff/create-flow/member-command surfaces,
  `control-surface`, `control-corruption`, `permission-administration`.
- `src/state/` (5 files) — `team-projection-store`, `team-ledger-store`, `team-read-state`,
  `team-refresh-coordinator`, `team-session-resolution`.
- `src/transport/` (2 files) — `host-seams.ts`, `team-remote-client.ts`: the client talks to the
  host through its seams, not through its own network code.
- Read-only legacy inspection UI: `src/model/team-legacy.ts` — *"the inspection is READ-ONLY by
  construction (the legacy reader never writes)"* — with the `TeamView` banner and the forbidden
  executable list. Legacy surfaces are shown for inspection, never presented as the vNext model.

## NOT responsible for

- **Browser network calls of its own.** `fetch(` 0, `WebSocket` 0, `XMLHttpRequest` 0 across the
  package; transport is host seams plus the typed remote client.
- Node.js: **0 `node:` imports in `src/`**; they appear only in `vitest.config.ts` (4 lines) and
  tests (12 lines: `node:crypto`, `node:fs`, `node:path`, `node:timers`). `node:http` /
  `node:net` 0; `child_process` only a comment in `vitest.config.ts`.
- Owning any shape: it defines no schema files (no JSON Schema, YAML or zod) and imports wire
  shapes from `remote` and contract shapes from `contracts`.
- Its own build: composition is a root responsibility (see below).

**Not established**: no test, build or browser run for this document. React usage was counted by
grep (16 lines across 12 src files, all in `ui/*.tsx` and the plugin), and the jsdom suites were
not executed.

## Two layout facts, recorded not fixed

1. `tsconfig.build.json` sets `rootDir: "../.."`, so the build emits
   `dist/packages/client/src/**`, while `main` and the `"."` export point at `./dist/index.js` —
   nothing ever lands there. The entry the product actually wires is spelled out in
   `scripts/build-client-composition.mjs:95-98`:
   `const entry = join(distRoot, 'packages', 'client', 'src', 'plugin', 'client.js')`, and the
   build **fails** if that path is missing.
2. The committed artefact is not `dist/` but **`packages/client/composition-shim/`** (3 tracked
   files: `index.js`, `client-bundle.js`, `package.json`), produced by the root script
   `build:composition` = `place-dist-glue.mjs` → `build-client-composition.mjs` →
   `check-artifacts-committed.mjs`, which turns plain `tsc` ESM output into a single
   `window.__ModuleLoader__` bundle — deliberately *"no bundler … in the product build"*.
   `dist/` itself is gitignored and absent here.

Also stale, and outside this line's write grant: `package.json` still says *"(skeleton)"*,
`src/index.ts` still carries *"Skeleton status (P1-T4)"*, and `package.json` declares
`@dsh-agent-team/contracts` and `@dsh-agent-team/remote` as `workspace:*` dependencies that the
code **never imports by name** (the only two `from '@dsh-agent-team/` hits in the package are
string literals inside `test/client-architecture-negatives.test.ts:157-158`, which are
forbidden-import samples). Consumers use relative source paths instead.

## Source, contract and test entry points

| what | where |
| --- | --- |
| product entry (source) | `src/plugin/client.ts` → emitted `dist/packages/client/src/plugin/client.js` |
| committed composition artefact | `packages/client/composition-shim/` (built by `pnpm build:composition`) |
| UI | `src/ui/*.tsx` + `.module.css` + `locales.ts` |
| view models | `src/model/`; state stores in `src/state/`; host bridge in `src/transport/` |
| tests | `test/` — 61 files: 29 `*.test.ts`, 26 `*.client.spec.tsx`, 5 `*.client.spec.ts`, `setup-jsdom.ts`; vitest runs two projects (node + jsdom) |
| cross-package imports | `../../remote/src/index.js` (~69 lines, 14 src files + tests) and `../../contracts/src/index.js` (~26 lines, 7 src files + tests); 5 lines in `test/s3-client-generation-spike.test.ts` reach pristine sources under `tests/deepseek-harness-test-use/…` and are excluded from the tsc program (*"evidence, not product code"*) |

Commands in `package.json` — **entry points, none run for this document**: `build`
(`tsc -p tsconfig.build.json`), `typecheck` (`tsc -p tsconfig.json`), `test` (`vitest run`); the
composition chain lives in the **root** `package.json`. Browser-side world rules (pristine host
checkout, `DSH_HOME` inside the workspace, port family) belong to `docs/TEST_METHODS.md` and
`tests/paths.mjs`; no browser or Host run was performed here.

## Owner

**No owner is recorded for this package.** `dev/engineering/registry.yaml` and
`docs/contracts/engineering-baseline/ids.yaml` never mention `client` (grep: 0 hits); the role
strings in those files are work-package roles, not package ownership, and none is appointed here.
