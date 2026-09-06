# G5 — Final acceptance matrix (plan §15.1) — owner assembly

Assembled at the G5 gate, head `2602d73` (master), over base `700f510`-era P0-v2 baseline.
Every row below maps the plan §15.1 必测断言 to concrete, re-runnable evidence. Host runs use the
real test host (port 3180, DSH_HOME `references/.dsh-test`, test source `references/deepseek-harness-test-use`
pristine @ `76fda729799fe9b3848dbe2c211d4b231032b81e`); :3080 was never touched.

## Row 1 — D1 member tools (file read, pwd/shell, Team tool, 普通会话不回归)

- LIVE (real host): `packages/tools/harness/g5-member-e2e.mjs` (G5A) — green run
  `evidence/team-d1-d6-repair-v2/G5/run-20260907-065856/` (68/68, owner re-run
  `G5/g5a-rerun-owner/` pass=true): member tool table in the REAL member model request =
  ordinary base tools (19, incl. `read` + `pwsh`) AND exactly the ten `team_*` tools (S3);
  real member executions: control-file read with sentinel round-trip, `pwd` output
  exact-equal to member workspace, `team_report_progress` with owning root + fresh unique
  requestToken + own instanceId (S4); ordinary session: NO `team_*` tools, base tools
  present, turn completes (S7).
- UNIT (re-runnable): `packages/runtime/test/d1-member-base-tools.test.ts` (6 tests:
  mount-once, root-never-mounts, fail-closed absent service, cold-resume once, ten tools intact),
  `packages/runtime/test/t12a-m2-persona.test.ts`.

## Row 2 — D3 identity (fresh/cold/cross-root rootSessionId, instanceId, role, requestToken 规则)

- LIVE: G5A S6 — the exact B2 `[team-member-context rootSessionId=... instanceId=... role=member]`
  block verbatim in the member model request system text (mock capture seq=4, durable
  request/header seq=12), no `[team-root-context]` block on the member.
- UNIT: `packages/runtime/test/d3-member-identity-context.test.ts` (D3-1..D3-5: fresh create,
  cold resume, cross-root attribution, wrong-root fail-closed, repeated setup no duplication).

## Row 3 — D2 result (success body, failure, unavailable, replay, token correlation, settled 分离)

- LIVE: G5A S5 — Leader-facing action result carries the frozen structured result
  `{requestToken, status:"succeeded", body:<member business body>}` on
  `effect.kind:"work-admitted"` (real Leader model request mock capture seq=13 + durable
  ROOT_B pair seq 48/49).
- UNIT: `packages/runtime/test/p8s3-work-chain.test.ts` (contract: status mapping, replay
  idempotent x3, token correlation, settled/succeeded separation) +
  `packages/runtime/test/p8s3b-result-effects.test.ts` (16 pins: glue per-case mapping
  succeeded/failed/unavailable/WORK_TURN_UNREADABLE, effect carriers, token echo, replay no
  double delivery).

## Row 4 — D4-A1 (UI mutation 无 F5 更新; stale/single-flight 保持)

- UNIT: `packages/client/test/team-creation-panel.client.spec.tsx` +
  `packages/client/test/team-members-projection.client.spec.tsx` (pull-after-mutation,
  single-flight, stale guard, 14-callback audit pinned). D4-A2 boundary (Agent/tool
  mutations) is explicitly NOT COVERED by v2 — design frozen in
  `evidence/team-d1-d6-repair-v2/E1/E1-design.md` (future task).
- Host-run corroboration: the Team UI zero-state persisted-rows + open entries exercised in
  the D4/G4 host runs render from the same projection pull path.

## Row 5 — D5 (deterministic allocation 5/5)

- UNIT: `packages/runtime/test/d5-instance-contract.test.ts` (9 tests; allocation algorithm
  byte-untouched by the v2 range; custom field never enters the legal schema; same-token
  replay, different-token parallel, `inst-leader` retention).

## Row 6 — D6 Team mode (动态 root 重启后 Team UI 入口恢复、十工具注册、真实 Team tool call)

- LIVE (real host, restart): `packages/tools/harness/d4-restart-reopen.mjs` — green run
  `evidence/team-d1-d6-repair-v2/D4/run-20260907-053257/` (36/36) + owner re-run
  `G4/d4-rerun-owner/` (pass=true) + 3 independent reviewer re-runs at G4 (55/55 each,
  S0-S8 + CLEANUP): dynamic root created, durable rows + native artifacts, clean stop,
  restart same DSH_HOME, `team.ensureRootLive` v3 cold revive via the Team UI dedicated
  entry, history renders, Leader prompt, ten `team_*` tools on the LIVE root agent, real
  `team_list_members` execution, switch-back without double registration.
- UNIT: `packages/runtime/test/d1-team-ownership-index.test.ts` (16: fixed/dynamic/multi-root,
  attribution, fail-closed binding errors, rebuild-identical), `test/d1-s6-remote-v3.test.ts`
  (14), `test/d2-s6-ensure-root-live.test.ts` (17), client `test/d2-open-team-mode.test.ts`
  (6), `test/d2-team-mode-entry.client.spec.tsx` (7).

## Row 7 — D6 ordinary mode (显式普通入口可用，且不错误声称 Team tools)

- LIVE: D4 runner S7 — explicit ordinary open performs ZERO team.* remote calls (call
  ledger), mode shown as ordinary; follow-up turn rides the already-live agent (documented
  A3 caveat: no team_* guarantee, no removal claim — recorded as evidence, not promise).
- UNIT: `packages/client/test/d3-open-ordinary-mode.test.ts` (11) +
  `packages/client/test/d3-ordinary-mode-entry.client.spec.tsx` (11: zero team.* remote calls,
  mode state, TeamDomain rows byte-identical across switching, idempotent, zh+en copy).

## Row 8 — negative (wrong root, missing token, unknown root, 普通列表入口边界均 fail/明确提示)

- UNIT: wrong/unknown root -> `TEAM_REMOTE_FOREIGN_TEAM` (d1-s6-remote-v3,
  d2-s6-ensure-root-live); ensureRootLive typed fail-closed set: port absent
  (`TEAM_REMOTE_TEAM_ROOT_LIVE_START_UNAVAILABLE`), already-live-outside-Team
  (`TEAM_ROOT_LIVE_OUTSIDE_TEAM`), no durable artifact (`NO_DURABLE_ARTIFACT`), start
  failure (`START_FAILED`) — no silent success, no adoption; ownership-index fail-closed
  codes (ROOT/MEMBER_BINDING_MISMATCH, CONFLICT) on corrupt/missing bindings; requestToken
  mismatch -> explicit failure in the D2 chain tests (token correlation pins).
- BOUNDARY (explicit, plan 12 D4 + 16): the ordinary session LIST open does NOT
  auto-provision Team tools — asserted in the D4 runner boundary record and the D3 copy;
  the dedicated Team UI entry is the guaranteed path (user-confirmed v2 semantics,
  plan §1.1).

## Environment invariants (whole range 700f510..2602d73)

- Upstream `references/deepseek-harness-test-use`: pristine @ `76fda729` verified at every
  gate (P0-v2, G2, G3, G4, G5A before/after; porcelain empty).
- Install-surface artifacts: `check-artifacts-committed.mjs` OK on the fresh full-build chain
  (1032 files) at the G4 head; Wave D/E ranges ship rebuilt artifacts in-commit.
- `git diff --check` clean per gate range; typechecks (runtime/remote/client/testkit) green at
  each gate.
- :3080 / `D:\deepseek-harness`: never touched (read-only 401 probe only, recorded in host runs).
- Known pre-existing (NOT in scope, ledgered): `team-creation-panel.client.spec.tsx`
  "create happy path (TCM M4 two-stage v2)" timing race fails at every base;
  `p6t1-parallel.test.ts` Windows scratch-fixture/teardown flake (solo-green after cleanup).

## Verdict input for the G5 reviewers

Each G5 reviewer must independently: re-run the TWO host runners (port-poll coordinated),
re-run the unit suites named above, verify the invariant list, and audit this matrix against
the plan §15.1 text line-by-line.
