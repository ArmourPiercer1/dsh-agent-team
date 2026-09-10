# V1 dispatch brief — verification matrix + freeze (alpha.2, FINAL task)

You are executing V1 (the verification matrix) of the 0.1.1-alpha.2 plan — the LAST task before 0.1.1-alpha.2 is frozen on master.
Read first (mandatory, in this order):
1. docs/ROUTER_RULES.md
2. docs/TEST_METHODS.md
3. docs/plans/active/0.1.1-alpha.2-detailed-development-plan.md — sections 12 (LIVE VERIFICATION — your matrix), 13 (test layers), 17 (Definition of Done — your exit checklist, ALL 22 items).
4. v1-kit-plan.md (same directory — the live-kit design: world/ports/blueprint/scripted turns/assertions/artifacts; the blueprint is ALREADY VALIDATED against the A1 parser, see its VALIDATED block).
5. A1–A6 task reports (all ON INT): dev/agent-workflow/evidence/alpha2-permission/{a1,a2,a3,a4,a5,a6}/.

## Prerequisites (verify before starting)

- int/alpha2-permission contains A1+A2+A3+A4+A5+A6, all merged and int-gated (runtime parity, testkit pin, artifacts, typecheck — check the int log in the router log + the A6 report).
- A6 report: the wiring map (which lifecycle installs what), the cwd/rule-canonicalization ruling, the control-service ref design. FILLED (main agent 2026-09-11, from a6-report.md + wiring-map.md on int 802cea5): the glue installs the A5 listener per agent inside agentSetup AFTER applyBoundaryRecords — fresh root / fresh member / cold root / cold member all re-run agentSetup, so install + reinstall-on-resume + disposer-drain-on-close are one code path; permissions ABSENT -> zero listeners (alpha.1 unchanged, pinned by a6a zero-listener legs); permissions PRESENT -> installParameterPermissionListener(agentCtx, {policy: template.capabilities?.permissions (read DIRECTLY via the glue-local locateTemplate, NOT through staticCapabilitiesOf), resolveTarget: (path) => ctx.fs.resolve(path, {cwd: LAZY agentCtx.agent?.session?.header?.cwd at call time}) unbranding targetKey -> {key, display}, controlService: controlServiceRef.current (fail-closed typed error alpha2-permission-control-unavailable if unfilled), rootSessionId: teamRoot, caller: {kind: instance, instanceId: state.instanceId} (leader position resolves to inst-leader), targetInstanceId: same, isLeader: sessionId === teamRoot, onObserve: module observations array}); the ref is created by host.ts as one plain {current: undefined} object, filled synchronously by root.ts right after createControlService, read lazily by the glue (teamToolsRef pattern); rule canonicalization stays A5 R2 (install-owned cache, exact rules only, bash inert) — the lazy-cwd DEVIATION from A5 R1 is documented and pinned by a6a (header rewritten between drives of the same listener -> resolver cwd tracks, distinct fingerprints) — the V1 live leg must prove lazy cwd against the REAL SessionHeader.cwd.
- Worktree: .worktrees/alpha2-v1 (branch task/alpha2-v1-verification), based on the FINAL int tip. You are the single writer.
- Environment (re-verify at start; the main agent swept 2026-09-11): :3080 = stable dev instance (ZERO-TOUCH), :3180 = user tsx (pid may change — do NOT kill), :3181 = your live host (must be free), :3493 = mock DeepSeek (must be free).

## Part 1 — Focused test matrix (on the int tree, your worktree)

- node scripts/run-tests.mjs runtime — full package: assert the documented pre-existing failure set ONLY (d1-member-base-tools 3/6, d1-s6-remote-v3 6/14, d1-team-ownership-index 5/16, d2-s6-ensure-root-live 5/10, d3-member-identity-context 1/5, d5-instance-contract 2/9 + d5 process abort) plus ALL alpha.2 suites PASS (a1 fixtures in domain t1/t2 suites, a2 30, a3 28, a4a 28, a5a scenarios, a6 t4a-style wiring).
- node scripts/run-tests.mjs domain — the 10 pre-existing t1-capability-schema + 1 t2-blueprint-hash failures are the ONLY failures (baseline debt, not regressions); the A1 permission fixtures PASS.
- node scripts/run-tests.mjs testkit — p4t6 pin at its current int value (verify with the scanner; do NOT change it).
- node scripts/run-tests.mjs remote — d1-remote-v3 5/33 pre-existing; f9-remote-v4 + f9 suite PASS.
- pnpm typecheck; pnpm build + pnpm build:composition; node scripts/check-artifacts-committed.mjs — all clean.
- Record every suite number in focused-tests.txt (the artifact).

## Part 2 — Live host smoke (the live kit, plan §12)

World + ports + mock + plugin install: per v1-kit-plan.md (world home references/.dsh-test-a2perm-<stamp>, host on 3181, mock DeepSeek 3493, plugin git+file from the int worktree). The alpha1-hardening kit scripts (cap-setup.mjs / cap-boot.mjs / cap-check.mjs / cap-resume-check.mjs / cap-legacy-setup.mjs / cap-legacy-boot.mjs) are the STRUCTURAL REFERENCE in dev/agent-workflow/evidence/alpha1-hardening/ — write a2perm-setup.mjs / a2perm-boot.mjs / a2perm-check.mjs / a2perm-legacy.mjs in the same pattern.

Blueprint: a2perm-blueprint.yml (validated; hash sha256:b8bdcf7197e… — if you must edit it, re-validate with parseBlueprint first and record the new hash). Team workspace files perm-a..e.txt pre-created per v1-kit-plan.md.

Scripted turns + assertions: exactly the v1-kit-plan.md matrix (LEADER 6 steps incl. the leader-self-approval NEGATIVE + allow-once re-ask; MEMBER A 5 steps incl. leader-approval routing + member-self-approval negative; MEMBER B 2 default-deny steps with zero control rows). Resolve requests via remote team.resolveControl (human caller, v4) and via the leader's team_resolve_control tool; FIND pending requestIds via remote team.getLedgerPage (category 'control' — raw pass-through entries; a control-request-recorded payload carries requestId + scope; a request is PENDING while no control-decision-recorded entry carries its requestId; the projection's pendingControlCount mirrors this derivation — see v1-kit-plan.md). Emit live-perm.json (every assertion: static decisions, routing kinds, allow-once, consumption, negatives).

Safety negatives (v1-kit-plan.md list): malformed args deny, canonicalization failure deny, ask-without-decision no-execution, double-consumption blocked, fingerprint mismatch unusable, unsupported-tool pass-through with zero control rows.

Cold resume (plan §12.4): kill the host (port-free), boot the SAME world home again — assert: policy rebuilt (write perm-c asks AGAIN), a still-pending request survives (visible in the projection), consumed decision + consumption rows preserved, a call awaiting at process death terminated without hang. Emit cold-resume.json.

Legacy regression (plan §12.5): the cap-legacy-style probe on the NEW int build (shipped legacy blueprint, NO capabilities) — zero permission listeners, toolCount/legacy behavior unchanged. Plus the focused t4a legacy-suite leg from Part 1. Emit legacy-probe.json.

## Part 3 — Version bump + freeze prep (on int, via your worktree commits)

- Bump "version" 0.1.1-alpha.1 -> 0.1.1-alpha.2 in the 10 package.json files (root + packages/{client,contracts,domain,legacy,remote,runtime,storage,testkit,tools}). Verify no OTHER version references need updating (grep for 0.1.1-alpha.1 in committed sources/README/CHANGELOG — if a CHANGELOG exists, add the alpha.2 entry per its format).
- Re-run the Part 1 gates after the bump (build + artifacts + typecheck).
- Commit: the version bump + the V1 evidence (dev/agent-workflow/evidence/alpha2-permission/v1/: summary.md with the §17 DoD table gate-by-gate, focused-tests.txt, live-perm.json, cold-resume.json, legacy-probe.json, environment-cleanliness.txt, the kit scripts).

## §17 Definition of Done — 22 items, evidence per item (summary.md must map every checkbox to its evidence artifact + line/field)

1 Blueprint permissions schema parseable (A1 domain suite + the validated live blueprint)
2 legacy/alpha.1 blueprint fully compatible (legacy-probe.json + t4a legacy leg)
3 canonical operation public seam only (A2 report + code review citation)
4 read/read_image/write/edit parameter-aware (a2/a5 suites + live legs)
5 default only ask|deny (A1 negative fixtures: allow rejected)
6 deny > ask > allow (a3 priority battery)
7 allow executes (live leg 1 + a5 scenario 1)
8 deny zero execution (live legs 2 + a5 scenario 2)
9 ask creates durable ControlRequest (live + a5 scenario 3)
10 Member ask -> Leader (live member A + a5 scenario 7)
11 Leader ask -> Human (live leader + a5 scenario 7)
12 allow authorizes only the current exact operation (a5 scenario 6)
13 operationFingerprint in scope (a4a scope suite + live fingerprint mismatch)
14 allow exactly once (live leg 5-6 + a5 scenario 5)
15 payload/resource mismatch unusable (live + a5 scenario 6)
16 cancellation no waiter leak (a5 scenario 10 + cold-resume death leg)
17 cold resume rebuilds static permission (cold-resume.json)
18 existing Control rows compatible (a4a W-suite + cold resume pending-survival)
19 alpha.1 tools/skills/MCP/builtin-deny no regression (legacy-probe.json + Part 1 parity)
20 CORE PATCH BUDGET = 0 (test-use porcelain 0 @ a66e470204; references/ untouched — environment-cleanliness.txt)
21 build/typecheck/artifacts clean (Part 1 + Part 3)
22 targeted real-host smoke PASS (live-perm.json)

## Red lines

- CORE PATCH BUDGET = 0: no references/** edits (test-use must END porcelain-clean @ a66e470204 — check at the end!), no upstream edits, no new deps.
- :3080 and D:\deepseek-harness ZERO-TOUCH; do NOT kill the :3180 user process.
- No push (the main agent pushes master after your freeze evidence — verify then push).
- Kill your host + mock processes when done; ports 3181/3493 must be FREE at the end; your world home stays on disk (evidence).
- Evidence in dev/agent-workflow/evidence/alpha2-permission/v1/; working tree ends clean (or only your committed files).

## Report format (final message)

Structured: commits, the §17 DoD table (22/22 with evidence pointers), Part 1 suite numbers (baseline-vs-after), Part 2 assertion counts (live/cold-resume/legacy), the version-bump file list, environment cleanliness (ports, homes, test-use porcelain, :3080 zero-touch), any deviations, red-line status. FINAL VERDICT: GO / NO-GO for freezing 0.1.1-alpha.2.
