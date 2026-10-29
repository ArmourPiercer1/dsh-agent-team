# U4-B SUMMARY — ExpectedToolObligations + static per-tool feasibility (G1-F input)

Pins: team `master@3288567d`; host `tests/deepseek-harness-test-use@639ed01539` (read-only, no boot);
WIP asset `origin/feat/a5-m2-integration@bef38934f` (PR #360 OPEN/DRAFT, evaluated by source only — its
`governed-families/*` tree and write-slice are **unmerged, un-mounted, C2 pending**; the PR body's 5-commit face
is stale vs the local head which carries the full WIP family-adapter tree); census `../u1-closure-20261025/u1c/`;
seed `../s1-m0-closure-v3-seeds/` (93 records = historical seed, not a whitelist). Static classification only —
no real-Host PASS claim in this package (execution-plan.md U4).

## Rule ("required" per the task)
Matrix main rows (TOOL-CAPABILITY-MATRIX-9b2.md L21–L46, incl. team_15/team-alias expansions) → REQUIRED.
Appendix-A names mounted in a shipped bundle/preset → REQUIRED (per-name matrix status stays UNKNOWN).
Names flagged disabled / default-disabled / experimental / opt-in-unmounted → OUT_OF_SCOPE with that reason
(obligation re-attaches if mounted/enabled — seed PB15 rule). Not in matrix → OUT_OF_SCOPE. Dynamic sources =
classes, never enumerated; the Domain family obligation (M-13) is REQUIRED with its enumeration gap recorded.

## Counts (generated — see build-outputs.py)
- Entries **91** = REQUIRED **58** (55 names + mcp__ class + client-plugin class + domain obligation) + OUT_OF_SCOPE **33**.
- Feasibility (58 required): **CONDITIONAL 33 · UNKNOWN 22 · ENV-BLOCKED 3 (pwsh, web_fetch, web_search) ·
  READY-PUBLIC 0 · CORE_SEAM_BLOCKER 0 asserted** — READY-PUBLIC is reserved for H0+PoC evidence, never static.
- Routes (required): ordinary-family 31 · team-native 15 · bridge:MCP 4 (3 static trio + mcp__ class) ·
  bridge:Jobs 3 · bridge:PTC 1 · bridge:LSP 1 · other:plugin-manager 1 · other:client-plugin-registration 1 · UNKNOWN 1 (domain obligation).
- Mechanism groups: **12**, **all 12 blocked_by_H0** — Host dispatch re-resolves the body by **name** after the
  pre/guard gate (`host core/tools/src/index.ts:1578` → `resolveExecution :1247-1252`, guards at `:768-770`,
  public `tools.guard :1136` / `tools.register :1063` / `tools.restrict :1121`); every group admits on that seam.

## Minimal PoC list beyond H0 (6 total; H0 itself is run by the separate H0 agent)
1. **PoC-1** MG-FS-WRITE: governed `write` row as a Family Contribution with pre-Body deny (proves the class of
   write/edit/str_replace/read_image; doubles as ARC-A minimal). Master has no write arm (native-name claim
   refused `team-tool-plane.mjs:492-494`); #360 `governed-families/write.mjs`+`write-slice.ts` is the extract candidate.
2. **PoC-2** MG-FS-READ+MG-SEARCH+MG-PROCESS single-ledger lifecycle: `read` + `grep/glob` + `bash/team_bash`
   allow/ask/deny, one Grant, revoke, non-Team control (CA-02); must re-run on current SHA — matrix LIVE-CONFIRMED
   rows are historical, and team_bash R2 (backlog BL-01, `ALPHA5-EFFECTIVE-BACKLOG.md` L13) must be re-tested in the same harness.
3. **PoC-3** one named Bridge representative (recommend **Jobs** via `plane-effect-backends.mjs:1579`, closed
   `jobsEnabled` key; PTC escalation row `ptc-escalation-row.mjs` is the alternate) — ARC-C minimal.
4. **PoC-4** MG-WEB deny-side + MG-MCP-DYNAMIC: refused fetch = zero socket; late-binding / same-name override /
   new-server-no-auto-authorize for `mcp__*` (mount gates `agent-bindings.mjs:2927,3003-3027`; trust exclusion `:723-725`).
5. **PoC-5** MG-CLIENT-PLUGIN-DYNAMIC (NEG-4): client-plugin late registration refused unless bound; no Grant
   inheritance at the ABSTAIN layer (matrix L46; host `cordis-host-runner/src/guard.ts:495,:628`).
6. **PoC-6** MG-AGENT-CONTROL negatives + MG-TEAM-NATIVE per-name spot-check: cross-agent `send_message`/
   `interrupt_agent` refused; spawn-class effects (`subagent`/`workflow`) mapped to an admitted effect kind;
   `plugin_manager` deny = zero process/profile write (15 team_* ride the same harness).
ENV-BLOCKED (pwsh, web_fetch, web_search positive legs) get no PoC here (no win32, no authorized outbound).

## CORE_SEAM_BLOCKER candidates (precise missing public behavior; none asserted as proven)
- **H0 (only true CSB candidate):** no observed public behavior pins the Guard-validated Definition identity for
  the body invocation — dispatch re-resolves by name (`host …/core/tools/src/index.ts:1578,1807,1876` after
  `:768-770`). If H0 shows an unverified-Body window, every name-based group flips to CORE_SEAM_BLOCKER. PENDING (H0 agent).
- `mcp__` guard binding-completeness: UNVERIFIED (not proven missing) — matrix L41/L42; PoC-4 decides; scope = MCP class only.
- `plugin_manager` is the highest-risk un-governed mounted name (executes build scripts, profile-global change —
  host `plugin-manager/src/tools.ts:19-21`; matrix A-6 has no acceptance row); the `tools.restrict` mask seam
  exists, so it is UNKNOWN + PoC-6, not a CSB.

## Notable classifications / unknowns
- Same-name dual routes: `send_message`/`interrupt_agent`/`list_agents` = REQUIRED via mounted subagent-control
  route; the experimental tool-agent-team route stays OUT_OF_SCOPE (unmounted).
- `structured_output` (host internal child tool, `structured.ts:74`) is OUT_OF_SCOPE and absent from
  `PLANE_RESERVED_NATIVE` — U1-C flagged for reviewer judgement; carried into the U7 dynamic-census queue.
- `surface:domain_family` cannot be satisfied per-name in G1-F (no names on any side) — named gap, not covered.
- master governance cited: plane takeover table `team-tool-plane.mjs:465-477`, jobs rows `:1684-1722`,
  read row `:1726-1780`, plane mount `agent-bindings.mjs:2553/:2697`, install order `tool-dispatch/install.ts:1-12`,
  PA facts `pa-mount-registry.mjs:1-15`, sandbox `provider.ts:146,731`, LSP `lsp-assembly.ts:174-191`.
- Files: expected-tool-obligations.json (91 entries) · mechanism-groups.json (12 groups) · feasibility.json (58) ·
  build-outputs.py (generator) · refs/ (branch docs extracted via `git show` for citation stability).
