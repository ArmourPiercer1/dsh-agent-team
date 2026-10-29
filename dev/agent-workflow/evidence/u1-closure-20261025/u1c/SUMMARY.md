# U1-C SUMMARY — EB0-3: historical 93-record tool seed vs current authoritative sources

Pins: host = `tests/deepseek-harness-test-use` @ `639ed015…` (git describe `dsh-v0.2.0-rc.2`, porcelain clean before+after);
team = `.worktrees/u1-audit-master` @ `4aaaa7b2…` (clean); seed = `../s1-m0-closure-v3-seeds/route-records-v3c.json`.
Every file:line in `host-tools.json` / `team-tools.json` / `seed-diff.json` was re-asserted against source text at build time
(`build-outputs.mjs`, 0 assertion failures).

## Seed counts (self-verified, match MANIFEST/index claims)
- records = **93**; unique names = **90**; `surface:*` obligations = **4**; unique non-surface names = **86**;
  double-recorded names = **3** (`interrupt_agent`, `list_agents`, `send_message` ×2 each).

## Current-source totals
- Host: **75** registration-site rows → **69** unique static names (incl. `structured_output` internal + `subagent_codex`/`subagent_claude_code`
  default-disabled preset routes); host's own generated authority `docs/tool-catalog.md` harvests **66** names.
- Team (master@4aaaa7b2): **18** declared names — 13 literal `team_*` ToolSpecs (`packages/tools/src/tools.ts:498-1197`) +
  `team_grant_permission`/`team_revoke_permission` (name selected at tools.ts:1373) + `team_grep`/`team_glob`/`team_bash`
  (`team-tool-plane.mjs:84` DEFAULT_PLANE_NAMES). a5p5 lane (`grep/glob/bash`, register.ts:275/281/287) is **DORMANT** (index.ts:13), not counted.
- Dynamic source classes (recorded, NOT enumerated): host `mcp__<server>__<tool>` (mcp-client/src/tools.ts:81,150);
  `cua_driver_native__<tool>` (experimental computer-use, :97); client-plugin registrations (cordis-host-runner guard.ts:628).

## Diff (90 unique seed names)
- **PRESENT_HOST = 68**, **PRESENT_TEAM = 18**, **PRESENT_HOST_AND_TEAM = 0**, **RENAMED = 0**, **NEW = 1**.
- **ABSENT = 1** — `surface:domain_family` (obligation marker, no tool name on any side); the other 3 `surface:*` map to dynamic classes.
- All 86 non-surface seed names resolve exactly; zero absent non-surface names.
- NEW: `structured_output` (host `subagent/subagent-in-process-driver/src/structured.ts:74`, child-internal capture tool;
  classified **UNKNOWN/NOT_VERIFIED — never authorized**).

## Reserved-name table vs host (task 3)
- `PLANE_RESERVED_NATIVE` (`team-tool-plane.mjs:403`, pin `0.2.0-rc.2@639ed01539`) = **68** names.
- vs host generated catalog (66): **missing = []**, extra = `subagent_codex`, `subagent_claude_code` — documented preventive reservations
  (host `standard.patch.yml:105/:113` shipped `disabled: true`).
- vs host static source (69): only **`structured_output` missing** — child-internal, outside the catalog harvest the drift law uses;
  flagged for reviewer judgement, NOT asserted as drift. Prefix rule `mcp__` matches host mcp-client (team-tool-plane.mjs:464).

## Top discrepancies
1. Seed double-records 3 names, each mapping to exactly one current registration family (subagent-control default vs experimental tool-agent-team co-mount).
2. Host experimental `tool-agent-team` (9 names incl. `wait_agent`, `team_task_*`) is NOT mounted in any shipped host bundle — seed treated it as reachable surface.
3. Team `team_*` governance set (18) has no host counterpart; host `team_task_*`/`spawn_teammate` remain the only host-side "team" names.
4. `ralph` shipped `disabled: true` (base yml:449); several seed names (`terminal_*`, `lsp`, `schedule_*`, `session_*`, `str_replace_editor`, stagehand_*) are opt-in/unmounted packages in default compositions.
