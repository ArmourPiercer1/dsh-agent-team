# u7r3-shomev2 — C2 lane: V2 production DEFAULT-Home live leg (2/2 starts) — **PASS**

Real-UTC dated 2026-10-30T12:27Z (R-CLOCK-1). Lane branch `task/u7r3-shomev2-20261030`
(worktree `.worktrees/u7r3-shomev2`), subject under test = **origin/master tip
`1d884efdb8839b0d6efedd969793c8ca3ef15c5b`** (post-#483 production Home law).
Host runtime = pristine `tests/deepseek-harness-test-use` @ `639ed01539…`
(built; porcelain 0 pre/post both boots). Pre-registration: commit `215362c844`
(push-confirmed 2026-10-30T11:20Z, branch `task/u7r3-shomev2-reg-20261030`),
pool **C2, exactly 2 starts**. This branch carries the used-count row
(2/8 C2) with evidence pointers.

## What was proven (V2 spec, PRODUCTION-HOME-DESIGN (e) — the leg C1 could not substitute)

**start#1 — write arm** (12:22:33Z, run `u7r3v2-shv2-1-…`, budget line 1):
real Host spawned with **DSH_HOME UNSET** and `HOME=<opshome>` (workspace-
internal, retained at `.worktrees/u7r3-shomev2/opshome`), row config
`agentStateEnabled: true` with the **`testHomeGuard` key ABSENT**
(profile-patch-boot1.yml — production arm), one full governed agent-state
flow driven through the real plane (team.create → leader create_goal →
get_goal → update_goal → team_create_member → member **todo_write** typed-OK):

- files landed **exactly** under `<opshome>/.dsh/team-state/agent-state/u7as-realm-20261030t12-22-33z/`
  (2 scopes + `ledger/{writes,attempts}.jsonl` + 3 `applied/*.mark`) — the
  HOME-derived default resolved by the upstream `resolveDshHome` law;
- host log: `agent-state store=fs realm=…` + placement-feed rows=… (store
  mounted, production arm answered);
- typed-OK witness runner-side: a refused apply NEVER persists, so the
  committed scope records + writes.jsonl lines (`goal/apply` ×2,
  `todos/apply` ×1) ARE the typed-OK proof (`shv2:member-write-leg-typed-ok`
  PASS, `shv2:leader-write-legs` PASS with rev2 edit applied);
- real `~/.dsh`: no `team-state/` ever, 0 lane-namespace paths among all
  paths touched since baseline (`home-mtime-receipt.txt`);
- negative legs as SECOND CONSUMERS, zero boot: relative/nonexistent DSH_HOME
  refused `AGENT_STATE_STORE_HOME_INVALID` in the production arm, unset+guard-true
  refused `HOME_MISSING`, all 4 probes match law (`shv2:negative-probes` PASS).

**start#2 — restart arm** (12:26:11Z, run `u7r3v2-shv2-2-…`, budget line 2,
FINAL slot spent): clean respawn, SAME env builder / SAME operator home /
SAME realm (row phase `create-or-open` → reopened the persisted unit per the
root-binding seam law):

- `/proc/<pid>/environ` persisted: **`dshHomeAbsent: true`**, only DSH_* key
  present = `DSH_CLIENT_COMMIT_HASH` (build pin, disclosed), `HOME=<opshome>`;
- production store mounted again same realm; second governed write leg
  (`create_goal` claim2 on a reopened-domain team session) typed-OK;
- **boot-1 realm byte-identical** after restart: all 7 captured files sha256
  match, append-only ledgers prefix-intact (`readback-byte-identical` PASS);
- **fresh production store instance** over the same root reads boot-1 goal +
  member todos equal, claim2 read back (`readback-fresh-store-instance` PASS);
- **replay law**: re-presenting boot-1's consumed applyId →
  `STATE_APPLY_REPLAY` "a consumed grant never applies twice", writes.jsonl
  byte-unchanged (`replay-refusal` PASS; the attempt is audit-logged in
  attempts.jsonl — state zero-write);
- boot-2 log: 0 ALIAS violations, 0 mount/placement refusals; clean SIGTERM
  exit 0 + port free; `homeSource` = `<opshome>/.dsh` witnessed by file
  location + child-probe re-derivation under the exact manifest;
  :3080 401 pre/post unchanged.

## Honest limits & disclosed deviations

1. **Driver crash, not product**: boot-1's drive fully succeeded but the
   driver crashed on a ReferenceError (`state.realm` census line) AFTER
   capturing all artifacts and BEFORE persisting run-shv2-1.json. Budget law
   respected: start #1 was NOT re-spawned; `recover-boot1.mjs` reconstructed
   the record OFFLINE (crash-window disk identity = IDENTICAL). Bug fixed in
   `drive-shv2.mjs`.
2. Consequence: boot-1's `/proc` environ proof ran in-memory (spawn-gate +
   immediate read) but was never persisted → boot-1 cases that rest on it
   alone are recorded **NOT_CAPTURED_PERSISTED_JOINT_WITNESS**, not laundered
   to PASS. Joint witnesses: the spawn-time throw-gate on any DSH_HOME key;
   the DISK LAW itself (files under HOME/.dsh prove `$DSH_HOME` was absent —
   `resolveDshHome` prefers `$DSH_HOME`); boot-2 `/proc` proof of the
   byte-identical `buildChildEnv` output. Boot-2 itself is fully captured.
3. Boot-1's host was reaped by sandbox PID-namespace teardown when the
   crashed driver shell exited (port 3181 verified free; disclosed deviation
   from the SIGTERM path; boot-2 exercised SIGTERM + port-free cleanly).
4. **No p6t6 observer row** on the production arm — `packages/tools/harness/
   plugin.mjs` itself refuses to set up without DSH_HOME (it would contradict
   the arm under test). Readiness used boot marker + `/team-remote`
   team.getLedgerPage poll + mock witnesses instead.
5. EXT contributors (session-log / plugin-package-inventory) disabled via the
   public config flag on the fresh unauthenticated home (kit precedent,
   disclosed in the patch header).
6. Boot-2's anchor `getLedgerPage` returned an empty page (the anchor team
   session's own ledger had no facts; the governed flow's ledger lives on the
   main team session) — the reopen witness is the 200 answer + the byte
   identity + read-back, all runner-side.
7. `:3080` and real `~/.dsh` read-only throughout; no product/Host code modified
(host tree porcelain 0 pre/post both runs; plugin dist built unmodified from
the lane branch); `git clean -fdx`/rebase/push-master never used.

## Files

| file | what |
| --- | --- |
| `run-shv2-1.json` | start#1 RUN record (`recovered: true` + RCA; verdicts incl. joint-witness cases) |
| `run-shv2-2.json` | start#2 RUN record (10/10 PASS verdicts) |
| `host-start-budget.jsonl` | exactly 2 lines (per-spawn, written immediately pre-spawn) |
| `preflight.json` / `census.json` | no-boot phases (rerunnable) |
| `capture-boot1/` + manifests inside run-shv2-1 | frozen boot-1 realm bytes |
| `logs/<stamp>/instance-port3181.log` | host logs (launch tokens redacted) |
| `profile-patch-boot1.yml` / `-boot2.yml` | exact production row bytes (no testHomeGuard in YAML body) |
| `opshome-tree.txt`, `home-mtime-receipt.txt` | operator-home tree; real-home pre/post receipts |
| `drive-shv2.mjs` | the driver (boot phases NOT rerunnable — budget spent) |
| `recover-boot1.mjs` | offline reconstruction (rerunnable) |
| `boot-state.json` | stamp/realm/root binding |

Retained world (TEST_METHODS §7 registration): `.worktrees/u7r3-shomev2/opshome/`
(operator home incl. the derived `.dsh` realm — evidence, not auto-deleted;
deliberately NOT committed — it carries live auth state; contents summarized
in `opshome-tree.txt`, realm bytes captured under `capture-boot1/`).

## Verdict

**PASS** — V2 production-default-Home live leg established on both arms
(write + restart/replay) within the registered 2-start budget; the two
boot-1 `/proc`-only cases stand as joint-witnessed (disclosed above), all
other cases runner-side PASS.

## 更正（dated ，append-only，原文照留）
两条 RUN 记录缺 EB3 终结字段（手写 boot 脚本只写 verdict map），托管 ci-integration 正确点红（RUN_INCOMPLETE=新记录未终结不算结果）。协调者按闭集阶梯机械补 cases/overall（映射表全文在记录 formatNormalization 字段）；**run-shv2-1 overall=NOT_REACHED**（两条 environ 联合见证 NOT_CAPTURED 的本就是未断言披露项，归一后 worst-of 如实落非绿，与 lane 披露一致）；run-shv2-2 overall=PASS。verdict map 一字未动。
同一更正另补 `bindings.authority`（canonical readAuthorityBinding() 实时指针=as20261026r1 代际，与 12:2xZ 两次 boot 同一指针，当日未换代）。补后 EB3-RUN-MANIFEST --new-since 本地 findings=0。
