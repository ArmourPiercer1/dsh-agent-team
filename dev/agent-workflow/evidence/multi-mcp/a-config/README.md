# multi-mcp Task A — evidence (config contract + normalization)

Task card: `dev/agent-workflow/briefs/multi-mcp/a-config.md` (int worktree)
Shared contract: `dev/agent-workflow/briefs/multi-mcp/00-contract.md` — I1/I2/I3 (implementation-level, executed verbatim), I9–I12.

Worktree: `.worktrees/multi-mcp-a-config` (branch `task/multi-mcp-a-config`)
Base: `master` @ `b49f4239ff9378ac8041e5667402029b4dcd4ca4`

## Owned diff

```
packages/runtime/src/plugin/mcp-supply.ts          NEW (I1)
packages/runtime/src/plugin/types.ts               MOD (I2)
packages/runtime/src/plugin/host.ts                MOD (I3)
packages/runtime/test/mcp-supply-config.test.ts    NEW (Must-4)
dev/agent-workflow/evidence/multi-mcp/a-config/    NEW (this evidence)
```

No other files touched (p4t6 pin untouched — I11; agent-bindings.mjs / bridge /
domain / storage / contracts untouched — I9).

## Gates (final state, logs in this directory)

| # | Gate | Command | Result | Log |
|---|------|---------|--------|-----|
| 1 | focused | `pnpm vitest run packages/runtime/test/mcp-supply-config.test.ts` | PASS — 39/39 tests | `gate-1-focused-test.log` |
| 2 | regression (host-validation family) | `pnpm vitest run packages/runtime/test/t4a-capability-wiring.test.ts packages/runtime/test/team-skills.test.ts` | PASS — 36/36 tests (27 + 9) | `gate-2-regression-test.log` |
| 3 | typecheck | `pnpm --filter @dsh-agent-team/runtime typecheck` | PASS — exit 0 | `gate-3-typecheck.log` |

## Implementation notes

- **I1** `mcp-supply.ts` — pure module (no I/O, no `node:` builtins), exports
  exactly `configuredMcpServers` + `mcpSupplyValidationIssue`. JSDoc on both
  functions is verbatim from the frozen contract (check order 1→5 and the
  detail strings, including the byte-identical legacy message
  `'mcpServer must be { name, port: number|null } or null'`).
- **I2** `types.ts` — `TeamPluginMcpServer` interface + optional
  `TeamPluginConfig.mcpServers` adjacent to `mcpServer` (JSDoc: canonical 0..N
  input; legacy accepted during this alpha; new docs/tests use `mcpServers`).
  The `mcpServer` field body is unchanged; its comment carries the legacy mark.
- **I3** `host.ts` — the legacy single-value check (pre-base L388–396) is
  replaced in place by `mcpSupplyValidationIssue` + `fail(detail)`; the
  surrounding validation order is unchanged; the single
  `TeamPluginError(TEAM_PLUGIN_CONFIG_INVALID, 'dsh-agent-team row config:
  <detail>')` envelope is unchanged.

### One mechanical bridge (recorded, no semantic change)

The contract's I3 sketch `mcpSupplyValidationIssue(c)` does not typecheck
against I1's frozen parameter type
`Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>`: in `host.ts` the local
`c` is `Partial<TeamPluginConfig> & Record<string, unknown>` (optional
`mcpServer`), which is not assignable to the Pick (required `mcpServer`).
The call site therefore bridges with
`c as unknown as Pick<TeamPluginConfig, 'mcpServer' | 'mcpServers'>` — a
type-level cast only; the runtime value is identical and the validator's
checks are total over the raw JSON shape (fail-closed on every branch). Both
frozen surfaces (I1 signature, I3 in-place call) are otherwise kept as-is.

### Ambiguous-case semantics (check 4)

Per contract I1 / plan §2.1 ("mcpServers 与非 null mcpServer 同时存在 →
fail closed"; "不要建立谁覆盖谁的隐式 precedence"):

- `mcpServers` present (even `[]`) + a **non-null** `mcpServer` →
  `'ambiguous MCP configuration: both mcpServers and a non-null mcpServer are
  present'` (pinned: the empty-array + legacy case IS ambiguous — the
  canonical field wins the read path, so a leftover legacy value must not be
  silently dropped);
- `mcpServer: null` or an **absent** `mcpServer` key alongside
  `mcpServers` → NOT ambiguous (null/absent = not present);
- check order 1→2→3→4→5 is pinned by tests (malformed-entry, duplicate, and
  non-array details all beat the ambiguous detail).

## Legacy behavior pins (C7 — byte-identical to the pre-base host check)

- `mcpServer` key ABSENT (and `mcpServers` absent) → still fails closed with
  the legacy detail (the field is required on the legacy path);
- empty `name` on the legacy single value → still NOT rejected;
- legacy detail string is byte-identical
  (`'mcpServer must be { name, port: number|null } or null'`).

## Test family

`mcp-supply-config.test.ts` is pure unit (no bridge, no I/O), all synchronous
`it()` bodies (plain-node shim). The host-boundary section drives
`host.validateTeamPluginConfig` directly — the same family as
`pbf-default-artifact-urls.test.ts` / `p8s5a-host-loadability.test.ts`
(direct source-entry import, single fail() envelope, stable error code).
