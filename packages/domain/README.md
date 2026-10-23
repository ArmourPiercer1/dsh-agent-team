# @dsh-agent-team/domain

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on any
conflict `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, 状态与恢复). Capabilities reach the host only as an external plugin over public
seams — `CORE PATCH BUDGET = 0` (`AGENTS.md`, 红线).

In the frozen 9-package structure (TaskDoc §11): the closed domain layer.

## Responsible for

Its own `src/index.ts`: *"Responsibility (TaskDoc §11 package boundary): Blueprint completeness
validation (a valid blueprint carries exactly one complete LeaderTemplate), policy / quota /
compatibility / admission rules. The domain is closed and deterministic: no I/O, no DSH imports,
no ambient state."*

Eight lanes, each with its own barrel and its own `tsconfig.json`:

| lane | what it holds |
| --- | --- |
| `blueprint/src` | parse, schema, validate, hash, snapshot, catalog, inspect, migration-report, model-preference, blueprint-v4, types; fixtures in `blueprint/src/testdata/fixtures.ts` |
| `policy/src` | two-stage resolution, `contracts-mirror`, `static-capability-source`, validate |
| `compatibility/src` | engine, requirement, environment-facts, fingerprint, acknowledgement, result; PASS / WARNING / FATAL |
| `lifecycle/src` | transitions, operations, errors — the five-state MemberInstance FSM, over the contract's `MEMBER_LIFECYCLE_STATES` |
| `member/src` | instance, roster, context-policy, workspace |
| `authority-envelope/src` | declared-AST / runtime / matcher families; one-way dependency direction |
| `tool-governance/src` | grant, lease, placement, planes, effects, assurance, binding — **DORMANT** |
| `vnext-field-mapping/src` | field-mapping, v4-authoring-map — **DORMANT** |

Dormant is a contract, not an oversight: `tool-governance/src/index.ts` says *"DORMANT BY
CONTRACT: no shipped source anywhere in `packages` imports this barrel — the lane is wired by
PR1+ as a reviewed change"*.

## NOT responsible for

Grep evidence, package-wide:

- `fetch(` 0, `WebSocket` 0, `XMLHttpRequest` 0, `node:http` 0, `node:net` 0, `child_process`
  only a comment in `vitest.config.ts`. `react` 0, no `.tsx`.
- **`SessionEvent`: 0 occurrences in the entire package.** No legacy Team event vocabulary is
  referenced at all, let alone treated as authority (the object model is
  `TeamBlueprint → TeamSession + TeamDomain → MemberInstance`, per the Architecture document).
- `node:` imports exist only in tests — 5 lines in `test/a5p0-layer-audit.test.ts` and
  `test/a5sr5-migration-negative-cases.test.ts`. The sources are I/O-free as stated.
- It defines no schema *language* artefacts: no JSON Schema, no YAML schema, **no zod** (0
  imports). The blueprint schema is a TS module — `blueprint/src/schema.ts` calls itself *"the
  closed vNext blueprint document schema … pins the TARGET shape a vNext blueprint source
  document must have"*. The only `.json` files are `package.json` and the two tsconfigs.
- The only workspace package it imports is **`contracts`** (14 files, specifiers like
  `'../../contracts/src/index.js'`, `'../../../contracts/src/dto/common.js'`). Nothing from
  `storage`, `runtime`, `tools`, `remote`, `client` or `legacy`. Imports by package name: **0**.

**Not established**: nothing was executed — no typecheck, build or test run for this file.

## Stale markers, recorded not edited

`package.json` still describes the package as *"(skeleton)"* and `src/index.ts` still carries
*"Skeleton status (P1-T4): this entrypoint exports the package identity"*, while the eight
lanes ship full implementations. Both are outside this line's write grant (product source), so
they are reported here; read the lanes, not the marker. Same applies to the entry point itself:
`src/index.ts` exports **only** `PACKAGE_ID`, so the declared `"."` export is not the real
surface — consumers import lane barrels by relative source path.

## Source, contract and test entry points

| what | where |
| --- | --- |
| real surfaces | the eight `<lane>/src/index.ts` barrels |
| blueprint schema | `blueprint/src/schema.ts` |
| lifecycle states | `lifecycle/src/*` over `MEMBER_LIFECYCLE_STATES` from contracts |
| tests | `test/` (40 `*.test.ts`) + `compatibility/test/` (7) = **47** |
| why the typecheck config lists lanes | `tsconfig.json` carries the rationale inline: *"A4-PR1 (ADR A3-9) … without this entry the new module is typechecked by nothing at all"* |

Commands in `package.json` — **entry points, none run for this document**: `build`
(`tsc -p tsconfig.build.json`, `rootDir: src`, so `dist/index.js` is consistent), `typecheck`
(`tsc -p tsconfig.json`, which deliberately widens `rootDir` to `../..`), `test`
(`vitest run`). Test-host constraints come from `docs/TEST_METHODS.md` and `tests/paths.mjs`,
not from here. No `dist/` exists or is tracked for this package.

## Owner

**No owner is recorded for this package.** `dev/engineering/registry.yaml` and
`docs/contracts/engineering-baseline/ids.yaml` contain no mention of `domain` at all (grep: 0
hits, even for the bare word), and the role strings those files do carry are work-package roles,
not package owners. This file does not appoint one. Behaviour here is constrained by
`docs/plans/active/alpha5-tool-io-governance/` (M0 lifecycle contract, effective backlog) for
permission and lifecycle semantics.
