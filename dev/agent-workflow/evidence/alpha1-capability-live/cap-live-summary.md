# 0.1.1-alpha.1 Capability-Wiring — Live-Host Playwright/Smoke Evidence

Run: 2026-09-10 (UTC). World: int/alpha1-capability-wiring @ fee2660, installed
as 0.1.1-alpha.1 into a fresh in-workspace DSH_HOME, booted on the real
production DSH host (test-use @ a66e470204, built artifact) at :3180 with an
in-process mock DeepSeek endpoint (:3493) and a minimal in-process MCP server
(cap-mcp, :3494).

Scope: the approved TARGETED checklist (NOT the full capability matrix) —
Table 1 N1-N6 + key Table 2 R items. CORE PATCH BUDGET = 0 (no upstream
changes; all capability via external plugin + public seams).

## Results

### Table 1 (capability world, blueprint cap-bp-1)

| Check | Result | Evidence |
| --- | --- | --- |
| N1 per-teammate team-tool selection | PASS 9/9 | cap-check-run.json (cap-check.mjs) |
| N3 team-skills wiring active | PASS 1/1 | cap-check-run.json (alpha1 skip observations) |
| N4 MCP durable-side + fail-closed baseline | PASS 8/8 | cap-check-run.json (before fail-closed, after durable-allow) |
| N5 cold-resume survival (create -> resume) | PASS 14/14 | cap-resume-check-run.json (cap-resume-check.mjs) |
| N6 unknown-item skip (skill 'base' not-in-catalog) | PASS | observations: "alpha1: team skill 'base' skipped (not-in-catalog)" |

N1 detail (per-agent team-tool selection, via POST /__p6t6/tool):
- leader (cap-root): team_list_members + team_send_message REGISTERED;
  team_delegate NOT-REGISTERED (UNKNOWN_TOOL).
- member A (session-capa-a): team_delegate REGISTERED; team_list_members +
  team_send_message NOT-REGISTERED.
- member B (session-capb-b): all three NOT-REGISTERED (empty allow).

N4 detail: before the durable override all three sessions fail-closed
(mcp.allowed=false, deniedBy team/unspecifiedFailClosed). After a team-scope
durable MCP-allow override (recordId cap-mcp-allow, via POST
/__p6t6/governance/mutate) all three show mcp.allowed=true (the durable side).
The template's per-member mcp-deny (member A) applies at the filterMcpServers
(mount) level and is covered by t4a at the glue level; the mount is lazy
(false here, the model cell is fail-closed so no model turn fires).

N5 detail: stopped the host, re-boot the SAME world with
bootPhase=resume (p6t6 directive phase=resume), adopted the durable
team_domain. Re-checked: blueprint cap-bp-1 still in the catalog, seed
members live, N1 team-tool selection unchanged, MCP durable override persists
(allowed=true for all three + the override record survives).

### Table 2 (regression / environment)

| Check | Result | Evidence |
| --- | --- | --- |
| R1 legacy full-catalog (shipped default my-team-bp-1, no override) | PASS | cap-legacy-boot log + catalog-list-caplegacy + tool probe |
| R6 test-use pristine | PASS | git status --porcelain empty after the run |
| R7 :3080 stable instance untouched | PASS | :3080 still running after the run |
| 3180-family ports free after teardown | PASS | 3180/3493/3494 free |

R1 detail: a SEPARATE legacy world (.dsh-test-caplegacy-*) installed the same
int branch with a MINIMAL user-layer patch (NO dsh-agent-team override) so the
BUNDLE layer's shipped my-team-bp-1 blueprint (the legacy default, NO
capabilities field) stands. Booted: toolCount=10 (full 10-tool factory
output), catalog.list carries my-team-bp-1, per-agent selection = the legacy
default set (team_send_message, team_list_members, team_delegate,
team_report_progress, team_create_member) — no per-teammate capability
selection. No regression from the alpha.1 changes.

## Notes / findings (no integration leak found)

- The live host has NO registered built-in tools (known global tools: none),
  so builtinToolDeny (N2) is exercised at the t4a glue level (24/24) with
  builtinToolDeny=[] (no-op) on the live host to isolate N1/N3/N4.
- MCP view semantics (verified against the harness plugin.mjs): allowed =
  mcpView.allowed = the DURABLE-side consumption view (team scope), NOT the
  AND with the template's per-member entry; mounted = mcpFiber !== undefined
  = the LAZY mount. The template's per-member mcp-deny applies at the
  filterMcpServers (mount) level (t4a glue-level coverage).
- Cordis user-layer override = DIRECT row (same id, no insert) — an - insert:
  with the same id collides with the bundle row (duplicate loader entry id).
- The create boot phase is strict (a fresh world); a stale team_domain or a
  persisted session log from a prior boot blocks it. The resume phase
  (bootPhase=resume + p6t6 directive phase=resume) adopts the durable
  team_domain for a cold resume.

## Artifacts

- cap-setup.mjs / cap-legacy-setup.mjs — world builders.
- cap-boot.mjs / cap-legacy-boot.mjs — booters (boot/status/stop).
- cap-check.mjs / cap-resume-check.mjs — capability checks.
- cap-check-run.json — N1/N3/N4 report (23/23).
- cap-resume-check-run.json — N5 cold-resume report (14/14).
- cap-assertions-*.json / cap-legacy-assertions-*.json — install assertions.
- cap-state-*.json / cap-legacy-state-*.json — boot state.
- cap-boot-*.log / cap-legacy-boot-*.log / cap-setup-*.log — run logs.
- catalog-list-cap-*.json / catalog-list-caplegacy-*.json — catalog evidence.
- dump-config-cap-*.txt / dump-config-caplegacy-*.txt — row dumps.
- mock-model-*.log — mock DeepSeek request logs.
- instances/ / instances-legacy/ — DSH instance logs.
