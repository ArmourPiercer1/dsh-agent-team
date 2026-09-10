# alpha.1 hardening — closure summary

Scope: third-party blind review of the alpha.1 capability wiring, four fixes
(P0-1 fail-closed template resolution, P0-2 restrict disposer saved+called,
P0-3 setup ordering, P1 allow([]) explicit value) + P2 diagnostics + the
P2.3 skill load-time fix found by the closure smoke, focused tests, a
targeted real-host closure smoke (create + cold-resume + legacy legs),
evidence, and the freeze of 0.1.1-alpha.1. Plan:
`docs/plans/active/0.1.1-alpha.1-hardening-fix-and-test-plan.md`.

## Gate status (H1–H12)

| Gate | Requirement | Status | Evidence |
|---|---|---|---|
| H1 | unresolved template must not fallback to legacy | PASS | t4a F1: member with unresolvable template -> typed error `capability-template-unresolved`, not `{mode:'legacy'}`; agent-bindings.mjs fail-closed paths |
| H2 | `tools.restrict` real disposer saved + called | PASS | builtin-deny.ts returns the seam's disposer; t2: lift 0->1, double-dispose stays 1, empty deny = 0 calls |
| H3 | builtin deny setup ordering correct | PASS | t4a F3: opLog shows restrict() idx < team-tool register idx (deny applied before Team tools register); agent-bindings.mjs moved the applyBuiltInToolDeny block ahead of the register loop |
| H4 | `allow([])` preserves explicit policy values | PASS | t1 11d/11e: allow([]) -> all three cells (tools/skills/mcp) explicitly present; mixed allow([])/deny preserves cells |
| H5 | targeted live built-in deny PASS | PASS (live no-op + fail-closed proof; effect at glue level) | live-builtins.json: live host global tool registry is EMPTY -> restrict() seam active + fail-closed (non-empty deny aborts row setup: setup-failure.json, hardening2); live kit boots deny [] (no-op); effect proven at t4a F1/F3 (real registry + real preset 10-tool catalog) + t2 19/19 |
| H6 | actual Team skill live PASS | PASS | live-skills.json: REAL skill `alpha1-real-skill` (row-config teamSkills, not just a skip observation) loads ONLY in member A scope through the model-facing `skill` tool; member B not visible (skill tool present, skill absent — the clean no-global-leak proof); leader not loadable (the root mounts no preset substrate by design — D1 v2); control unknown-skill not visible; wiring-active skip observations for 'base' (not in catalog); cold-resume RE-appearance verified live (cold-resume.json) |
| H7 | actual MCP mount/filter live PASS | PASS | live-mcp.json: cap-mcp fail-closed before the durable override (allowed=false, mounted=false for all three sessions); after the durable team-scope cap-mcp-allow override admitted by governance/mutate: allowed=true for leader + member A + member B (durable consumption view), mounted stays false (lazy mount; the template-level per-member mcp gate is enforced at filterMcpServers/mount level — proven at t4a glue) |
| H8 | cold resume PASS | PASS | cold-resume.json: the world patch bootPhase flipped create->resume; the resumed host re-derives ALL capability wiring from durable truth — N1 team tools 7/7, N3b real skill member A persists (re-appears) + member B still invisible, N4 durable MCP override record persists (allowed=true x3); blueprint persists; 16/16 checks |
| H9 | legacy Blueprint regression PASS | PASS | cap-legacy-boot + cap-legacy-r1-probe: the shipped bundle-layer default my-team-bp-1 (no capabilities field, NO user-layer override) boots CAPLEGACY-READY — toolCount=10, catalog.list carries my-team-bp-1, leader full selection set (team_delegate + team_send_message + team_list_members all registered); no capability wiring active |
| H10 | CORE PATCH BUDGET = 0 | PASS | test-use git status clean (porcelain 0 lines); all fixes in the dsh-agent-team plugin |
| H11 | test-use pristine | PASS | environment-cleanliness.txt: test-use HEAD a66e470204, clean; :3080 + D:\deepseek-harness untouched; all test worlds under references/ (gitignored) |
| H12 | build/typecheck/artifacts clean | PASS | build.txt + typecheck.txt (9/9 packages, exit 0) + [check-artifacts-committed] OK: 1056 files (byte-reproducible build, artifacts committed with the source) |

## P2.3 — the live-smoke skill source fix (this closure's new finding)

The hardening5 live smoke loaded the real team skill through the model-facing
`skill` tool and found the registry rejected the runtime registration at
LOAD time: `loaded skill "alpha1-real-skill" source must be a string`. Root
cause: the registry `register()` defaults invocation + provider but NOT
`source`, while `get()` runs `validateDefinition` which requires a source
string — a runtime-registered skill without one was storable yet unloadable
(the t4a glue double never materializes, so only the live seam caught it).
Fix (plugin-side, no upstream patch): the skill adapter now registers
`{...def, source: def.source ?? 'runtime'}` (team skills are runtime
contributions from the row config); `TeamSkillDefinition` gained an optional
`source` field. t4a P2.3 F1 pins the load-time completeness (27/27). Live
re-verification on hardening6: member A loads the skill (the tool payload
shows provider "runtime") — 27/27 cap-check.

## H5 caveat (live-host zero built-in tools)

The live DSH host registers ZERO global (built-in) tools in this test
profile. `tools.restrict()` requires every named tool to be a known GLOBAL
tool (inherited surface), and it throws `tools.restrict() names unknown
global tool "bash"; known global tools: (none)` otherwise. A non-empty
`builtinToolDeny` therefore aborts the live row setup (the hardening2 boot
abort, recorded in setup-failure.json — now part of the live-builtins.json
evidence as the fail-closed proof). The live kit therefore boots with
`builtinToolDeny: []` for all templates (the restrict seam is not called),
isolating N1 (team tools) / N3 (skills) / N4 (MCP) on the live host. The
built-in DENY PATH itself is fully covered at the glue and unit levels:

- t4a F1 (glue): a member with `builtinToolDeny: [write]` -> `restrict()`
  called with `deny: [write]`, the Team-managed tool (`team_delegate`) still
  registers, and the restrict happens BEFORE the team-tool register.
- t4a F3 (glue): opLog ordering — restrict idx < register idx (H3).
- t2 (unit): 19/19 — non-empty deny -> exactly one restrict call, the
  disposer lifts the captured upstream lift exactly once, double-dispose is
  idempotent, empty deny -> zero restrict calls.

This matches the alpha.1 live precedent (cap-live-summary.md: "The live host
has NO registered built-in tools ... builtinToolDeny (N2) is exercised at the
t4a glue level ... with builtinToolDeny=[] (no-op) on the live host").

## Focused test results (final state, re-verified 2026-09-10)

- t1 (domain, P1 allow([])): 11d + 11e PASS. (10 pre-existing t1 failures are
  unrelated: strict-YAML fixtures, a metadata:null contract, shim matcher
  gaps — present at base 2536f32.)
- t2 (tools, P0-2 disposer): 19/19 PASS.
- t3 (runtime, P2.1/P2.2 adapters): 11/11 PASS (MCP-mount blocks removed).
- t4a (runtime, P0-1 + P0-3 + P2.3): 27/27 PASS.
- targeted runner (t3+t4a): 38/38 PASS (run-focused-t3-t4a.mjs in this dir).

Pre-existing full-suite abort: d5-instance-contract.test.ts (async it()
unhandled rejection + toHaveLength) aborts run-tests.mjs before the
alphabetically-later t3/t4a files; the targeted runner works around it. Not
caused by the hardening.

## Live closure smoke (real host, plan §8)

- Worlds (all under references/, gitignored): capability worlds
  hardening/hardening2/hardening3/hardening4/hardening5/hardening6 + the
  legacy world hardening5-legacy. The FINAL capability evidence is
  hardening6 (create phase 27/27 cap-check, then the world patch bootPhase
  flipped create->resume, cold-resume phase 16/16 cap-resume-check); the
  FINAL legacy evidence is the hardening5-legacy world (CAPLEGACY-READY).
  hardening2's abort is the H5 fail-closed proof; hardening3/5 are
  diagnostic runs (stale-kit seedMembers gap; the P2.3 source defect) —
  both findings are fixed and re-verified.
- Plan §8.4 beyond skip-observations: the row-config `teamSkills` input
  carries the real skill `alpha1-real-skill`; it is registered into member
  A's agent scope (the calling context's scope layer), loadable ONLY there,
  invisible to member B / the leader / an unknown control name, absent after
  the skill deny path, and RE-APPEARS after a cold resume (the durable
  member rows drive the re-derivation).
- Close-dispose: the p6t6 harness exposes no member-close route, so the
  close() dispose leg is glue-level (t4a close block, real seam); the
  cold-resume re-appearance is the live complement.

## Scope lock honored

No dynamic permission mutation, no durable grants, no teamHardDeny, no async
approval, no permission admin UI, no remote protocol bump, no generic
policy resolver rewrite. All edits in the dsh-agent-team plugin
(packages/*) + the per-world user-layer patch (test kit). Upstream DSH
test-use source unmodified.

## Artifacts

All evidence in `dev/agent-workflow/evidence/alpha1-hardening/`:
summary.md, focused-tests.txt, typecheck.txt, build.txt, live-builtins.json,
live-skills.json, live-mcp.json, cold-resume.json, environment-cleanliness.txt
(the plan §11 set), plus the raw run artifacts (cap-check-run.json,
cap-resume-check-run.json, per-world setup/boot/dump-config/catalog/state
files, setup-failure.json, the cap-legacy R1 probe) and the test kit
(cap-setup.mjs, cap-boot.mjs, cap-check.mjs, cap-resume-check.mjs,
cap-legacy-setup.mjs, cap-legacy-boot.mjs, emit-live-evidence.mjs,
run-focused-t3-t4a.mjs).

Commits on task/alpha1-hardening: 7570073 (P0-1/P0-2/P0-3/P1 + P2.1/P2.2 +
tests + dist) and d55ddb2 (P2.3 skill source fix + t4a + dist); the evidence
commit closes this directory.

---

alpha.1 hardening completed
no dynamic permission features added
CORE PATCH BUDGET = 0
alpha.2 may start
