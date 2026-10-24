# @dsh-agent-team/contracts

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on any
conflict, `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, "状态与恢复"). Nothing here restates a contract — pointers only, by design.

Place in the frozen 9-package structure (`contracts`/`domain`/`storage`/`runtime`/`tools`/
`remote`/`client`/`legacy`/`testkit`, TaskDoc §11): this is the shared contract vocabulary at
the bottom of the graph.

## Responsible for

- The serializable contract vocabulary every other vNext package consumes: IDs, DTOs, error
  codes, schema version, remote-safe values. `src/index.ts` says of itself: *"The single source
  for the stable, serializable contract vocabulary every other vNext package consumes
  (Development Plan §9.1) … This package contains NO business state mutation, NO Cordis
  service, NO storage, NO React, and NO live Agent dependency (TaskDoc §11.4 P3-T1)."*
- **Closed vocabularies**, with the change rule attached. `src/errors.ts`:
  *"`TeamContractErrorCode` is a CLOSED vocabulary as of contract v1. Adding or renaming a code
  is a contract change: it requires a new version (see CHANGELOG.md freeze rule), never a
  silent v1 edit."* The freeze rule itself lives in `CHANGELOG.md`; it is not copied here.
- The runtime half of each frozen shape: **27** exported `*_FIELDS` arrays (24 plain plus 3
  carrying a `_V2` suffix), defined across 14 files — 16 files mention them — alongside the
  matching `*_OPTIONAL_FIELDS` sets, plus the closed-record pipeline in `src/dto/common.ts`
  that validates against them.
- Version tracks: `src/schema-version.ts` (`TEAM_CONTRACT_SCHEMA_VERSION`,
  `SUPPORTED_SCHEMA_VERSIONS`, `LEADER_INSTANCE_RECORD_SCHEMA_VERSION`) and a separate
  projection track in `src/projection/schema.ts`.
- Quarantine of legacy vocabulary rather than reuse of it: `src/legacy-vocabulary.ts` carries
  `LEGACY_FORBIDDEN_FIELDS` (`['memberId']`). vNext has no Team SessionEvents; the object model
  is `TeamBlueprint → TeamSession + TeamDomain → MemberInstance` per the Architecture document.
- The read model: `src/projection/` (activity, member, model-state, effective-config, ledger,
  disposed-history, compatibility, states, template, root, projection).

## NOT responsible for

Established by grep over `src/` **and** `test/`, and this is what makes the claim checkable:

- `fetch(`, `WebSocket`, `XMLHttpRequest`, `child_process`, `node:http`, `node:net`,
  `node:fs`, `require(` — **zero matches each**. No `node:` import appears anywhere in `src/`.
- Non-relative imports in `src/`: **none**. Tests import only `vitest` (which is not even
  declared here — it resolves from the workspace root).
- Upstream DSH/`@deepseek-ai` imports: **zero**. This package does not touch the host, and
  nothing here may ever patch it (`CORE PATCH BUDGET = 0`, `AGENTS.md`).
- No other workspace package is imported — `contracts` sits below everything, including
  `legacy` and `client`.
- No `*.e2e.*` file exists in this package.

**Not established**: behaviour beyond static imports. No build, typecheck or test was executed
while writing this file.

## Source, contract and test entry points

| what | where |
| --- | --- |
| public entry | `src/index.ts` (~50 exports; matches the `"."` export in `package.json`) |
| ID types | `src/ids/` (`blueprint-id`, `session-id`, `instance-id`, `template-id`, `brand`, `common`) |
| DTOs | `src/dto/` (`blueprint-snapshot`, `member-instance-record`, `session-binding`, `team-session-record`, `common`) |
| projection read model | `src/projection/` |
| error vocabulary | `src/errors.ts` |
| version constants | `src/schema-version.ts`, `src/projection/schema.ts` |
| contract tests | `test/*.test.ts` (13 files + `helpers.ts` + `p8t1-projection-fixtures.ts`) |
| freeze rule | `CHANGELOG.md` |

There is **no JSON Schema file in this package** (`*.json` here is `package.json`,
`tsconfig.json`, `tsconfig.build.json`). The machine-readable layer is the `*_FIELDS` arrays
plus the parse functions. A repo-level check exists outside the package:
`scripts/contracts-field-agreement.mjs` (registry entry **EB1-G**) compares each declared
`interface` with its `*_FIELDS` array for 21 hand-written pairings — names only, 20 compared
for equality plus 2 additive-v1 subset checks, 1 shape reported `NOT_CHECKED` (an index
signature), 13 interfaces and 1 array unpaired. It does not cover types, `minItems`, length,
uniqueness or cross-field rules: those live in the parse functions and cannot be derived from
a declaration.

Commands defined in `package.json` — **entry points, not verified here**: `build`
(`tsc -p tsconfig.build.json`), `typecheck` (`tsc -p tsconfig.json`), `test`
(`vitest run`). None was run for this document. `vitest.config.ts` runs in-process threads
rather than `child_process` forks, for sandboxed hosts.

## Owner

**No owner is recorded for this package.** Neither `dev/engineering/registry.yaml` nor
`docs/contracts/engineering-baseline/ids.yaml` names `@dsh-agent-team/contracts` as an owner
target; the only recorded involvement is `EB1-G` (`Tooling Owner`), which owns the *checker*,
not the contract. Editing a closed vocabulary or a frozen shape is a contract change and needs
the Contract Owner's decision — which role that is for this package is not stated anywhere in
this repository, and this file does not invent one.
