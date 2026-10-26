# @dsh-agent-team/tools

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on
conflict, `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, "状态与恢复"). Delivery is external-plugin-over-public-seam; `CORE PATCH BUDGET = 0`
applies here as everywhere (`AGENTS.md`, 红线).

In the frozen 9-package structure (TaskDoc §11), this is the model-facing tool layer.

## Responsible for

- **The closed set of thirteen model-callable team tools**, exactly these `name:` values in
  `src/tools.ts`: `team_list_members`, `team_list_templates`, `team_inspect_config`,
  `team_create_member`, `team_delegate`, `team_follow_up`, `team_send_message`,
  `team_report_progress`, `team_request_control`, `team_resolve_control`,
  `team_list_pending_control`, `team_collect`, `team_archive_member`.
- Guard consultation before a tool acts (`consultGuard`), tool selection
  (`selectTeamTools`), and the built-in deny adapter (`applyBuiltInToolDeny`).
- Request-token discipline for tool arguments: `validateRequestToken`, `requireStringField`,
  `TeamToolArgsError`, `TEAM_TOOL_BAD_ARGUMENTS`, `TEAM_TOOL_CALLER_UNRESOLVED`,
  `TEAM_TOOL_REQUEST_TOKEN_MAX_LENGTH`.
- The `a5p5-tools/` lane: strict argument parsing and the Search/Shell backend contract,
  direct and stub backends, effects schema, render and spill (grep/glob/bash surface).
- Delegating everything else. Its own `src/index.ts`: *"EVERY tool delegates to the TeamRuntime
  public surface … The package holds no team state, performs no durable write of its own, and
  registers through the host's public tool registration only (the P2-T4 characterized seam)."*
  And `src/types.ts`: *"this package deliberately imports NO upstream types, only its own
  sibling packages."*

## NOT responsible for

- **State and durable writes.** Not a claim of intent but of code shape: the tools reach
  runtime lanes and nothing below them. Cross-package imports are `runtime/*` lanes
  (`control`, `admission`, `activity`, `messaging`, `governance`, `mutation`,
  `permission-lifecycle`, `action-router`, `coordination`, `lifecycle`, `operation-permission`,
  `permission-governance`), `domain/tool-governance`, `domain/policy`, and `contracts`.
  **No** `storage/`, `remote/`, `client/` or `legacy/` import exists in this package.
- Its own governance laws. Two files, and the distinction matters when an effect rule is the
  thing changing: `domain/tool-governance/src/parse-util.js` holds the **generic** parse
  discipline (*"THE PARSE LAW IS IMPORTED, NOT RESTATED"*), while the **effect** laws live in
  `domain/tool-governance/src/effects.ts` — header *"THE LAWS ENCODED HERE (plan §3)"*, with the
  closed `EFFECT_KINDS` at line 43 and `parseRequestedEffectSet` at line 163 (dedup, fingerprint,
  effect-to-resource coupling). `a5p5-tools/src/effects-schema.ts` imports from both. Changing an
  effect rule means changing that domain lane, not this layer.
- Node built-ins and network in the tool layer: grep over `src/*.ts` for `node:` and `fetch(`
  returns **empty**; `child_process` appears in **no** file under `src/`, `a5p5-tools/src/` or
  `harness/`. `fetch(` and `node:http` occur only in `harness/*.mjs` (including a mock DeepSeek
  endpoint), and `node:fs` only in `a5p5-tools/src/spill.ts` and the harness scripts.
- No `*.e2e.*` file exists (the e2e drivers are named `harness/g5-member-e2e.mjs` etc.).

**Not established**: the three boundary rules were read as enforced by a static scan, not
executed here — `test/p6t6-bypass-scan.test.ts` (+ its `.mjs`) forbids direct durable-domain
access, agent creation, and legacy SessionEvent vocabulary; the string `'../storage/index.js'`
inside it is a forbidden-pattern literal, not an import. vNext has no Team SessionEvents; the
object model is `TeamBlueprint → TeamSession + TeamDomain → MemberInstance` per the
Architecture document, and legacy Team event vocabulary must not be presented as vNext
(`AGENTS.md`, 红线).

## Source, contract and test entry points

| what | where |
| --- | --- |
| public entry | `src/index.ts` (`createTeamTools`, `TeamToolSet`, guard/selector/deny, token helpers, types) |
| the tool set | `src/tools.ts` (the 13 `name:` entries) |
| guard / selection / deny | `src/guard.ts`, `src/tool-selector.ts`, `src/builtin-deny.ts` |
| argument tokens | `src/tokens.ts`, `src/types.ts` |
| governed family descriptors (u7-w0b) | `families/` — one `FamilyAssembly` descriptor module per ordinary governed family (`fs.mjs`, `process.mjs`, `search.mjs`), the REVIEWED list `manifest.json` (sha256 per module + the kernel capability backings), and the GENERATED `index.mjs` (`node scripts/gen-family-index.mjs [--check]`). Adding a family = its lane + one descriptor module + one manifest entry; see `dev/agent-workflow/evidence/u7-w0b-20261026/DESIGN.md` |
| Alpha.5 search/shell lane | `a5p5-tools/src/` (`backend-contract.ts` is the closed execution shape a provider must speak; `effects-schema.ts` imports the domain parse law) |
| tests | `test/` (13 `*.test.ts`, incl. `p6t6-bypass-scan.test.ts`, `h3-hostile-seam.test.ts`, `rc2-team-deny-least-privilege.test.ts`, `issue2-builtin-deny-focused.test.ts`) + `a5p5-tools/test/` (8) |
| real-instance drivers | `harness/*.mjs` (`g5-member-e2e.mjs`, `d4-restart-reopen.mjs`, `t12-vertical.mjs`, `mock-deepseek.mjs`) — **manual drivers, not part of `test`** |
| cross-package imports | `runtime/*` lanes (~66 lines), `domain/tool-governance` (16), `domain/policy`, `contracts` |

Commands in `package.json` — **entry points, none run for this document**: `build`
(`tsc -p tsconfig.build.json`), `typecheck` (`tsc -p tsconfig.json`), `test` (`vitest run`).
Also recorded so a reader is not misled: this package has **no `dist/`** in the tree (its
`a5p5-tools/src` compiles into `packages/runtime/dist`), and its declared `main`
(`./dist/index.js`) does not match the `rootDir: "../.."` emit layout. Test-host constraints
come from `docs/TEST_METHODS.md` and `tests/paths.mjs`, not from this file.

## Owner

**No owner is recorded for this package.** It is not named in `dev/engineering/registry.yaml`
or `docs/contracts/engineering-baseline/ids.yaml`. The tool plane it exposes is governed by
Alpha.5 invariants whose authoritative text sits in
`docs/plans/active/alpha5-tool-io-governance/` (M0 lifecycle contract, effective backlog, tool
capability matrix) — reach for those, and for `ids.yaml`'s `source_anchor` values, before
changing admission, guard or effect behaviour. Adding or removing one of the thirteen tools is a
public-surface change, not a local edit.
