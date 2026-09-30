# series-closure gates summary (merged master @ 533dfcbb, 2026-09-30)

**gate input**: merged tree = pre-e tip 401e8a12 字节一致 (packages/ 零 diff; 唯一 delta = SESSION_ROUTER_LOG 双历史 union 节, 披露在案)。

## static gates (all on merged tree)
- pnpm build: 9/9 Done
- pnpm run build:composition: client-bundle.js 1146091 B + place-dist-glue 1 placement
- check:artifacts: **OK 1372 files** (committed install-surface artifacts == fresh build, 零漂移)
- pnpm run typecheck: 9/9 Done (exit 0)
- p4t6 scanner: **10/10 @ pin 896** (收口树 scanner 复验 — 禁手算; pin 未动 = 收口树 scannable 文件集 == pre-e 线)
- p6t6 bypass scan (p6t6-guard.test.ts): 9/9 passed
- git diff --check e44ebbbd..533dfcbb (merge range) = exit 0
- git diff --check 46929e6d..533dfcbb (series range) = exit 0

## full root suite x2 (canonical zero-new gate)
- **run 1**: 10F|21F|4698P(4719) — raw log = **tail-25 ONLY (disclosed, run1-tail25.md)** — 同构于 run 2
- **run 2 (raw-verifiable, run2.log)**: 10F|21F|4698P(4719) — 失败集逐测试名枚举:
  - 精确基线 9F|19F 全部在案: t1-capability-schema 9 / t2-blueprint-hash 1 / d3-member-identity-context 1 / p6t3-mediation 5 / p6t3-restart 2 / p6t6-actions 1 [messaging worker->leader = 已知失败, pre-e 线同签名独立复验在案] + file-level p8s3b-result-effects / t12a-b2-child-identity / t12a-glue-handoff-ports
  - + p6t1-parallel 1F|2T = **P1 家族** ("P6-T1 P1: N=2 same-template parallel activations both succeed" describe 内双测试 — 已知债定义块本身)
  - **= 零新增签名**
- p6t6-actions 单测独立复验: 合并树 1F|13P = pre-e worktree (401e8a12) 同测同签名 1F|13P (基线已知失败, 非回归)

## p6t1 隔离重跑 (KNOWN-DEBT FINAL 规则: 同族 = 记录, 新签名 = STOP)
- 24 次隔离重跑 (reruns 1-24; rerun 1-5 仅捕获 summary, 6-24 全量捕获 — 3 个未捕获 red 已披露, 其后 18 次捕获中 8 red 全部家族归属):
  - 16 GREEN / 8 RED runs; RED 测试全归属: P1 pair ×4 runs (8 test-reds) / P2 N=5 ×1 run / P3 quota-race ×3 runs (3 test-reds)
  - **零 P4-invariant red, 零非 P1/P2/P3 家族 red → guard clause 未触发**
- 记录: p6t1-isolated-reruns.log (per-run 在案)

## hygiene / red lines
- test-use pristine @ 46a7f68b0922371ce7144b668b90e377d8e799f4 (pre 自证; 本轮零实宿主 kit 跑 = 零触碰 by construction)
- :3080/:3180 零触碰 (本轮未起任何实例)
- 零 force-push (本地 merge commit + plain push); CORE PATCH BUDGET = 0
- 既有 untracked 空 scratch .tmp-t12a-b2-home/.../session.jsonl.zstd (0 B, 与 46929e6d 提交的证据占位符 hash 一致) 移出至 .tmp-scratch-backup-20260930/ 以解除 merge 阻塞 (未删除)
