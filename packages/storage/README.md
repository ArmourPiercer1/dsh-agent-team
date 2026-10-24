# @dsh-agent-team/storage

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on any
conflict `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, 状态与恢复). `CORE PATCH BUDGET = 0`: the host stays untouched, and this package
reaches it only through the **public** DSH StorageDomain seam (`AGENTS.md`, 红线).

In the frozen 9-package structure (TaskDoc §11): the durable side.

## Responsible for

Its own `src/index.ts`: *"TeamDomain — the Team-owned durable sidecar store and the **sole
persistent control-plane authority**, built over the public DSH StorageDomain seam. TeamSession /
MemberInstance records and the Team ledger live here, never in DSH SessionEvents (zero-core: no
Team event vocabulary enters the host)."*

- `schema/` (13 files) — **the authority for storage-level persisted shapes**: `seam`, `stores`,
  `version-policy` (levels L1–L3), `schema-meta`, `field-rules`, `errors`, plus the record
  shapes `override`, `compatibility`, `ledger`, `operation`, `blueprint-registry`,
  `permission-overlay`. `schema/stores.ts`: *"TeamDomain is a SINGLE public StorageDomain
  (`team_domain`) carrying the logical records of Development Plan §17.2 as declared tables"* —
  ten stores, including `blueprint_registry` @v2 and the additive `permission_overlays`
  (Alpha.3 PR1). Rules here cover *"the NEW storage-level vocabulary that has no frozen
  contracts v1 DTO"*, while **identity rules stay with the contracts parsers**.
- `repositories/` (13 files) — `createTeamDomain` / `openTeamDomain` facade plus per-record
  repositories; record types and validators are reached **only** through `../schema/index.js`.
- `operations/` — `journal.ts`: *"crash-safe PREPARED → effects → ledger → COMMITTED journal with
  generation CAS, duplicate-ledger prevention and roll-forward recovery"*.
- `provisioning/` — adapter, coordinator, stages, identity, fake-adapter; the stage ladder
  `ALLOCATED → CHILD_SESSION_CREATED → CHILD_BOUND → INSTANCE_COMMITTED`.
- `bindings/` — `SessionBindingService`, reconciler, and the closed binding-integrity
  diagnostics.

## NOT responsible for

- **Any Team SessionEvent vocabulary, by design.** 15 occurrences of the string exist in the
  package and every one is a denial or a negative-scan artefact: the `src/index.ts` zero-core
  statement above, `repositories/session-bindings.ts:8`, and the independence negatives
  (`test/p4-08-independence-negative.test.ts`, which proves the sidecar works with *"no
  SessionEvent names anywhere in the closure"*, and `test/p4-helpers.ts`, which *imports* the
  frozen legacy names from contracts as detection vocabulary — *"imported — never re-typed"*).
  Legacy names are detection material here, never the model.
- Network and process code: `fetch(` 0, `WebSocket` 0, `XMLHttpRequest` 0, `node:http` 0,
  `node:net` 0; **zero `node:` imports package-wide** (three text hits in `provisioning` sources
  are comments); `child_process` only a comment in `vitest.config.ts`. No `react`, no `.tsx`.
- Schema languages: no JSON Schema, no YAML, no zod. Persisted shapes are closed `FIELD_*`
  constant sets with `parse*` / `serialize*` functions in TypeScript.
- Its own identity semantics: the only workspace package it imports is **`contracts`** (~65
  import lines, e.g. `schema/field-rules.ts` importing `'../../contracts/src/ids/common.js'`).
  No `domain`, `runtime`, `tools`, `remote` or `client` import exists; imports by package
  name: **0**. It has **no dependencies at all** in `package.json`.

**Not established**: crash/recovery behaviour was read in `journal.ts`, not exercised; no test or
build was run for this file.

## Stale marker, recorded not edited

`package.json` still says *"(skeleton)"* and `src/index.ts` carries *"Skeleton status (P1-T4)"*,
while the five lanes ship implementations and the package is described in its own text as the
sole persistent authority. Both are product source and outside this line's write grant, so they
are reported rather than corrected. `src/index.ts` exports **only** `PACKAGE_ID`, so the declared
`"."` export is not the surface: consumers import the lane files by relative source path.

## Source, contract and test entry points

| what | where |
| --- | --- |
| persisted-shape authority | `schema/` — start at `schema/stores.ts`, `schema/version-policy.ts`, `schema/field-rules.ts` |
| open/close a store | `repositories/` (`createTeamDomain`, `openTeamDomain`) |
| durability journal | `operations/journal.ts` |
| provisioning ladder | `provisioning/` |
| session bindings | `bindings/` |
| tests | `test/` — 23 `*.test.ts` across 27 files (4 helpers); no lane-local or harness dirs |

Commands in `package.json` — **entry points, none run for this document**: `build`
(`tsc -p tsconfig.build.json`, `rootDir: src`, consistent with `main`), `typecheck`
(`tsc -p tsconfig.json`), `test` (`vitest run`). World/host/pin rules belong to
`docs/TEST_METHODS.md` and `tests/paths.mjs`. No `dist/` exists or is tracked for this package.

## Owner

**No owner is recorded for this package.** Neither `dev/engineering/registry.yaml` nor
`docs/contracts/engineering-baseline/ids.yaml` mentions `storage` (grep: 0 hits). The single
persistent control-plane authority is a strong claim to change lightly: a persisted-shape change
touches `schema/version-policy.ts` levels and the frozen contract vocabulary in `contracts`, and
neither is owned by this line.
