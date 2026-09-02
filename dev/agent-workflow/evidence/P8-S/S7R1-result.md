# P8-S7 (S7-R1) Result — Creation/preflight surface (UI-B07 + UI-B05/UI-C08 ND-02)

Branch `task/P8-S7-R1-creation-preflight` @ base `15da6b5`. Sole writer of own worktree; no push; :3080 / `D:\deepseek-harness` untouched; no sandbox escalation. C1–C5 all green.

## R1-A — `team.create` optional `initialWork` (UI-B07; plan BC-03 L1720)

**Contract (additive, exactly 1 field)** — `packages/remote/src/contracts/params.ts:176,349-352,1054-1071`:
`RemoteTeamCreateParams` gains `initialWork?: RemoteLosslessRecord`; `REMOTE_TEAM_CREATE_FIELDS` = pre-set + `initialWork`; absent ⇒ field ABSENT from the parsed record (W1b keys exactly `[blueprintId, rootSessionId]`); non-record ⇒ existing `malformed-params`, field `initialWork`, reason `invalid-value` (W2); unknown-field reason unchanged (W3a). No new error codes (closed 11-code set untouched).

**Remote handler** — `packages/remote/src/handlers/team.ts:54-59,168-173`: private 4-arg view `TeamCreatePortWithInitialWork`; plain assignment (no cast); frozen 3-arg `RemoteTeamCreatePort` untouched ⇒ 3-arg fakes byte-identical (W4c receives exactly `[root, bp, 2]`).

**Runtime admission** — `packages/runtime/src/plugin/s6-remote.ts`:
- `S6RemoteTeamCreatePort` 4th param optional (:252-267); prod handler passes `createParams.initialWork` (:1224).
- Token `team-create:initial-work:sha256:<sha256(canonicalJsonStringify(initialWork))>` (`initialWorkRequestToken` :423-424) — retry-idempotent via the existing work-chain SETTLED/REPLAY/RESUME protocol.
- Caller derived through the A32 seam with the reconstructed parsed envelope; `targetInstanceId = leaderInstanceId`; `payload = {...initialWork}`.
- Step-0 `validateActionRequest` runs BEFORE the durable bind (:759-780); admission runs AFTER bind through the EXISTING work-admission path — `performAction('follow-up')` (:809-810). No new architecture, no new remote method. Absent `initialWork` ⇒ byte-identical behavior.

**Tests (13 new `it`s)**: `packages/runtime/test/p8s7r1-create-params.test.ts` (W1a/W1b/W2/W3a/W3b/W4a/W4b/W4c — 8) + `p8s7r1-initial-work.test.ts` (C1a absent / C1b present / C1c retry-replay / C1d fresh / C1e malformed — 5, over REAL P6T2 worlds). Fresh worlds remove the pre-seeded TeamSession AND 'team-root' session-binding rows: a binding without its record is `ROOT_BINDING_TEAM_SESSION_CONFLICT` (integrity violation), not a fresh-create input (root cause: `s7r1-node-debug.log`).

## R1-B — UI-B05 + UI-C08 (ND-02) verdict: **NATIVE_PROVEN**

The browser client reaches the AgentPreset list/detail through the PUBLIC `remote.agentPresets` seam — no private imports ⇒ **NO adapter, NO projection change**; closed catalog (9 categories / 23 methods) unchanged. Citations (pristine `references/deepseek-harness-test-use` @ `cd5ef81`):
- `packages/preset/agent-presets/package.json:16,33` — public `exports["./remote"]` subpath.
- `packages/preset/agent-presets/lib/typert.remote-client.d.ts:9-30` — `agentPresets` namespace: `list/read/copy/deletePreset/select`.
- `packages/api/remotes/src/client/index.ts:4,142,147,158,162` — public `.../remote` import; `remote` augmentation; `inject = ['remote']`; `agentPresetsRemote` in the mount list; `ctx.remote.$mount`.
- `packages/client/ui-agent-preset/src/client/index.ts:52-53` — first-party client plugin injects `'remote.agentPresets'` publicly; `settings-store.ts:90` (`list`), `section-store.ts:205/:272/:331` (`read/copy/deletePreset`), `seat-store.ts:159` (`select`).

UI-C08 read-only identity rides the native surfaces (roster + document; `content` = raw cordis.yml ⇒ `complete` persona flag visible).

## Verification (C4 battery — plain-node chain; vitest cannot execFile under this sandbox, `s7r1-vitest-p8s7r1.log`)

- **C1 named tests**: 13/13 (8 wire + 5 runtime) — `s7r1-node-p8s7r1.log`.
- **C2 contract diff**: additive 1 field; reasons/codes untouched; scan pin 525→527 in the owned testkit pin file (its 10 tests green in both chains).
- **C3 chains**: fresh `node scripts/run-tests.mjs` **1998/1998** (`s7r1-fresh-chain.log`); dist chain — sanctioned emit (legacy tsc → runtime tsc → yaml junction, all exit 0) — **1998/1998** (`s7r1-dist-chain.log`, `s7r1-dist-build-summary.log`); tsc 8-set exit 0 ×8, 0 errors (`s7r1-tsc8-*.log`).
- **C4 live E2E**: 17/17 frozen scenarios @3181 (`s7r1-live-17-scenarios.log`, `S7R1-live/summary.json` — `pass=true`, `failures` empty, ports released); fresh DSH homes `.dsh-test-p8s7r1(-e)` under main-worktree `references/` (in-workspace); lock acquire/release own-marker; preflight+postflight test-use pristine @`cd5ef81` (porcelain empty); stable :3080 = 200 before+after; postflight port probe ALL-FREE (`s7r1-ports-postflight.log`, probe `s7r1-ports-free.mjs`).

## Residuals
None blocking. Sandbox note: vitest unusable here (vite `windowsSafeRealPathSync` EPERM) — the sanctioned plain-node chain is the executed battery, per repo design (`scripts/run-tests.mjs`).
