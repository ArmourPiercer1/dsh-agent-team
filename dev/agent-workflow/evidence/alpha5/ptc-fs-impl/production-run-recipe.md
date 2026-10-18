# PTC fs half-arm — production-entry 真跑配方 (live leg)

Status: RECIPE ONLY this round (per the work order: 合成腿+装配腿必绿本轮; the live 真跑 may
wait for the int-r3 merged face — search/glob lane files are that owner's, and the governed
fs effect face they carry is what the positive control writes through). Every step below was
WRITTEN against measured anchors in this tree; nothing here is speculative API.

Ports: pick a FREE range before any run (`ss -ltn` census first); NEVER :3080 (the stable
dev instance — read-only status probe at most, a 401/unreachable is an acceptable receipt),
never ranges listed busy in SESSION_ROUTER_LOG. DSH_HOME stays INSIDE the workspace
(`tests/homes/<world>`), per TEST_METHODS §7. Token-bearing run dirs: sanitize BEFORE any
commit (`token=REDACTED-<sha256[0:8]>`).

## 0. Host (pinned pristine baseline)

```
git clone --local --no-hardlinks /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness tests/deepseek-harness-test-use
git -C tests/deepseek-harness-test-use checkout 639ed015397290b3745d163aafe02ffee4aa3f84
pnpm -C tests/deepseek-harness-test-use install --ignore-scripts --store-dir <workspace store>
pnpm -C tests/deepseek-harness-test-use run build        # must go through pnpm run
HOST_BIN=tests/deepseek-harness-test-use/apps/cli/lib/bin.js
```

## 1. Plugin artifact (the round's own dist)

`node scripts/place-dist-glue.mjs` (already booked green at HEAD in this branch) → the
plugin row loads the dist mirror; `node scripts/check-artifacts-at-head.mjs` must read
drift=0 at the final HEAD.

## 2. Worlds

- **T** (Team, governed): blueprint with LeaderTemplate + one governed member template,
  plugin config carries `teamToolPlane` (realmId + confinedProvider trio when the OS floor
  is pinned — the Landlock workspace-write OS floor from the demo line is REQUIRED for the
  positive control: escalation to `workspace-write` must be a REAL strict widening, not a
  no-op; on a floorless host `approveEscalation` mode===effective returns no-approval and
  the positive control MUST be reported as environment-blocked, never faked).
- **N** (non-Team control): same plugin installed, plain sessions only — NO
  permissionPolicy/teamToolPlane ⇒ the :2412 gate never runs ⇒ router empty.

## 3. Positive control (正反控主链)

1. Member runs a governed tool call whose operation is a strict widening (write under the
   forbidden zone / escalation to `workspace-write` from `read-only`).
2. Observe (row receipts, `[dsh-agent-team] a5ptc:` console line + observations ledger):
   `member-registered` at install, `request-created`-equivalent durable control row with
   kind `leader-approval` (member ask) — leader resolves allow via the normal approvals UI
   / team_resolve_control.
3. Row answers `allowed-once`; the effect lands ONCE (禁区真落盘; hash the written artifact).
4. Census lines: `census-boot` at boot (selectedRunner/enforcement CONFIG-DECLARED values —
   cross-check against the row config, NOT an OS claim), `allowed-once` event per ask.

## 4. Negative controls (zero-write assertions)

| leg | drive | expected |
| --- | --- | --- |
| 重放 | re-drive the SAME (member, callId) ask after allowed-once (host retry of the ask, or scripted re-ask through the waterfall) | `rejected`, NO second durable control request, ZERO extra bytes in 禁区 (hash before/after) |
| 过期 | set the assembly ttl short (test override), resolve, let the window pass, re-ask | `rejected` (expiry precedes consumption), zero writes |
| 他队 | second team world T2, no shared state; present nothing | T2 mints NOTHING for T's grant (closed-world ledgers); T2 census asks=0 |
| 撤销先于用 | leader DENIES (or abandons) the pending control before the ask completes | `rejected`, `mint NOTHING` — grantsState empty |
| mode 绑定不符 | after allowed-once, re-ask same callId with reason mode `read-only` | `rejected` on the fingerprint; no second control request |
| non-team 零差 | world N: run the SAME plain-session flows as a pre-round baseline build | approval flows byte-identical (the ONE installed listener hits an empty router; compare approval/asked + approval/decided event streams against the baseline capture) |
| unload 对称 | tear the governed member down (archive/close), then re-drive an escalation ask | row never sees it (router unregistered; toolDisposers drained); ask rides the pre-round host answerer — and a re-mount re-registers cleanly (one face per session) |

## 5. Receipts

Run dir `dev/agent-workflow/evidence/alpha5/ptc-fs-impl/runs/<UTC>/` with: host version
(`git -C tests/deepseek-harness-test-use rev-parse HEAD` — REAL output pasted), plugin HEAD
(`git rev-parse HEAD` — REAL output), port census output, both world logs, the observation
lines, before/after hashes of the 禁区 artifact, sanitized (token=REDACTED-<sha8>).
