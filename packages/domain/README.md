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

Eight lanes, each with its own barrel and its own `tsconfig.json`. Paths in the table are
inside `packages/domain/`; anything reaching another package is written from the
repository root, and quoted import specifiers stay verbatim as the code writes them:

| lane | what it holds |
| --- | --- |
| `blueprint/src` | parse, schema, validate, hash, snapshot, catalog, inspect, migration-report, model-preference, blueprint-v4, types; fixtures in `blueprint/src/testdata/fixtures.ts` |
| `policy/src` | two-stage resolution, `contracts-mirror`, `static-capability-source`, validate |
| `compatibility/src` | engine, requirement, environment-facts, fingerprint, acknowledgement, result; PASS / WARNING / FATAL |
| `lifecycle/src` | transitions, operations, errors — the five-state MemberInstance FSM, over the contract's `MEMBER_LIFECYCLE_STATES` |
| `member/src` | instance, roster, context-policy, workspace |
| `authority-envelope/src` | declared-AST / runtime / matcher families; one-way dependency direction |
| `tool-governance/src` | grant, lease, placement, planes, effects, assurance, binding — **consumed by production code**, see the note below |
| `vnext-field-mapping/src` | field-mapping, v4-authoring-map — **dormant** (2 importers, both tests) |

**The "DORMANT" label on `tool-governance` was stale, and the numbers around it need their
measurement stated.** PR0 froze the lane with *"DORMANT BY CONTRACT: no shipped source anywhere in
`packages` imports this barrel"*; that sentence outlived the code. Three different counts are all
true, which is exactly why the lane names an authority instead of a number:

| question | answer in this checkout | how it is measured |
| --- | --- | --- |
| who imports this **barrel** | 22 production files | grep for `domain/tool-governance/src/index.js`, excluding `dist/` and tests |
| who imports **any lane file** | 25 production files, in `packages/runtime/control`, `packages/runtime/tool-dispatch`, `packages/runtime/tool-admission`, `packages/runtime/operation-permission`, `packages/runtime/controlled-fs/src`, `packages/runtime/src/plugin/live`, `packages/tools/a5p5-tools/src` | grep for `domain/tool-governance/src/` |
| who the **law books** as consumers | 26 files, each booked with the symbol it consumes | `scripts/audit-a5-tool-governance-imports.mjs`, pinned by `test/a5p0-layer-audit.test.ts` |

The last is the authority, and it is deliberately broader than a grep: its Law 3 counts edges into
`tool-dispatch` as well, because *"the assembly point imports only the latter, and it is the caller
that matters"* -- which is why `packages/runtime/src/plugin/live/agent-bindings.mjs` is booked while
importing no lane file directly. The law is now a **named set**, not emptiness: a consumer that
appears is a design change that must be booked there, and one that disappears is a broken wire.

The barrel's own header said otherwise until 2026-10-23, when it was corrected -- comment lines
only, no behaviour touched -- after the coordinating session confirmed the lane had no writer in
this tree; `packages/domain/README.md` and that header now agree, and both point at the ledger
rather than at themselves. By contrast `vnext-field-mapping`'s dormancy is genuine: its only two
importers, `packages/runtime/test/a5p7-lane-hygiene.test.ts` and
`packages/testkit/test/p4t6-session-event-scan.test.ts`, are both tests.

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
