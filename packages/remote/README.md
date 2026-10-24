# @dsh-agent-team/remote

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on any
conflict `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, 状态与恢复). `CORE PATCH BUDGET = 0`: everything here is reached through public
seams (`AGENTS.md`, 红线).

In the frozen 9-package structure (TaskDoc §11): the wire contract and its handlers.

## Responsible for

Its own `src/index.ts` — a real 508-line barrel, not a marker — describes *"the closed method
catalog, the lossless-JSON wire envelope (request/response with provenance), the frozen-ID and
boundary-code error vocabulary"* and states the central invariant: *"The remote never writes team
state: handlers are read/projection and typed-effect surfaces over TeamDomain … (promise never
rejects)"*.

- `src/contracts/` (10 files) — the version ladder (v1…v9 constants), the closed method catalog
  (`REMOTE_METHOD_CATALOG` plus per-version method sets), per-method closed parameter parsers and
  `REMOTE_*_FIELDS` field sets, wire DTO types, ids, errors, remote-safe values, semantic rules.
- `src/handlers/` (13 files) — one factory per category (catalog, intent, team, member,
  override, intervention, policy-state, compatibility, handoff, legacy, dispatch), plus
  `createRemoteDispatcher`, `registerRemoteHandlers` / `REMOTE_RPC_CHANNEL`, and the structural
  ports a host must supply.
- `src/push/` (7 files) — backoff and reconnect, generation verdicts, pull sync (v1 and v6),
  ledger-page anchor tracking.
- Read-only legacy inspection as a **vNext feature**: `src/handlers/legacy.ts` implements
  *"read-only legacy Team inspection (DevPlan §20.6 degradation)"* and is *"Read-only by
  construction: the legacy reader never writes"*. This is the opposite of the red line: legacy
  surfaces are exposed for inspection, never used as the vNext object model.

## NOT responsible for

- **Writing state.** Stated above and visible in the code shape: handlers reach ports and
  projections, never repositories. It imports no other workspace package from `src/` at all.
- Transport and I/O: `fetch(` 0, `WebSocket` 0, `XMLHttpRequest` 0, `node:http` 0, `node:net` 0.
  The two real `node:` imports in the package are in a test
  (`test/a4p6-remote-v8.test.ts`); every other `node:` occurrence in `src/` is the per-file
  declaration *"Pure module: no I/O, no node: builtins"*. `child_process` appears only as a
  comment in `vitest.config.ts`.
- Owning persisted shapes: it defines wire shapes as TS constant sets and parse functions, and
  **no** JSON Schema, YAML or zod files exist here.
- Legacy vocabulary as authority: 2 occurrences of `SessionEvent` in the package, both comments
  in the negative scanners (`test/p8t3-negative-scan.mjs`, `test/p8t4-negative-scan.mjs`, rule
  R5). The 57 `legacy` hits in `src/` are the `legacy.inspect` feature, its field set
  (`REMOTE_LEGACY_INSPECT_FIELDS`), its port (`RemoteLegacyPort`) and catalog/version entries.
- Cross-package coupling: the only imports of another workspace package are **4 lines in 4 test
  files**, all pulling `testkit/fault-injection/session-event-scan.mjs` to run the committed
  scanner. Zero `src/` cross-package imports; zero imports by package name. One file notes the
  reason: *"(deviation D-1: self-contained, no cross-package .ts imports)"*.

**Not established**: nothing executed. Reconnect/pull behaviour and the never-rejects promise
were read, not exercised.

## Source, contract and test entry points

| what | where |
| --- | --- |
| public entry (real) | `src/index.ts` — also keeps the `PACKAGE_ID` marker additively |
| version ladder + method catalog | `src/contracts/version.ts`, `src/contracts/catalog.ts` |
| parameter parsers + field sets | `src/contracts/params.ts`, `src/contracts/types.ts` |
| dispatcher + channel | `src/handlers/dispatch.ts`, `src/handlers/register.ts` |
| read-only legacy inspection | `src/handlers/legacy.ts` |
| push / pull / generation | `src/push/` |
| tests | `test/` — 16 `*.test.ts` across 23 files, plus harness **files** (`p8t3-helpers.ts`, `p8t4-server.ts`, `p8t4-test-client.ts`) and the two `*-negative-scan.mjs` scanners |

Commands in `package.json` — **entry points, none run for this document**: `build`
(`tsc -p tsconfig.build.json`, `rootDir: src`, so `dist/index.js` is consistent), `typecheck`
(`tsc -p tsconfig.json`, whose `rootDir` is `.` — different from the other packages), `test`
(`vitest run`). Host/pin/world rules come from `docs/TEST_METHODS.md` and `tests/paths.mjs`. No
`dist/` exists or is tracked for this package.

## Owner

**No owner is recorded for this package.** `dev/engineering/registry.yaml` and
`docs/contracts/engineering-baseline/ids.yaml` never mention `remote` (grep: 0 hits), so no role
is claimed here. Changing the method catalog, a version rung, or a closed parameter shape is a
wire-contract change: it moves `src/contracts/` and the `contracts` package together, and the
`Tool Inventory Owner` / `Contract/Security Owner` strings in those files are the roles attached
to the surrounding invariants, not appointments for this package.
