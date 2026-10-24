# Retire-receipt ledger (center registration, append-only)

Root 20:30 program: old fix trees are marked RETIRED only by REAL-NAMED original-owner
receipts ("完成不复用"); nothing is cleaned by the center; removal is exclusively a356's
ordinary per-tree path after root's immediate pre-admission checks (no force/prune/gc).

## Registered receipts (original owners, verbatim substance)

| tree | branch @ tip | receipt | status |
| --- | --- | --- | --- |
| .worktrees/a5m2-g3a | feat/a5m2-g3-cancel-close @ c270e0e85d11b7546b1b5cd2dcee0bf63656e3b0 | owner cf8e0202-6d03-4dd2-b43f-435b4d9f7318 (G3-A): in-flight NONE; porcelain/untracked/stash EMPTY; ls-remote = same SHA (rebuildable); objects missing=0 (transient fsck lines during git's own auto-repack re-checked = 0); no future need; "MAY BE MARKED RETIRED; I do NOT remove it" | **RETIRED** (coordination 20:42 confirmed; center never re-dispatches this path; a356 removal per per-tree conditions only) |
| .worktrees/a5m2-g3b | feat/a5m2-g3-pty-spawn @ 15b76a8aa8f7005e1b395505e9547c750626825e | original G3b owner (real-named via coordination 20:5x, read-only): HEAD/remote both = 15b76a8aa; porcelain 0, stash 0, job_list empty; production continues independently in wire-g3 (8e62); confirms 完成不复用 | **RETIRED** (registered per coordination instruction; center performs NO cleanup) |

## Non-receipts and open items

| tree | state |
| --- | --- |
| .worktrees/a5m2-g2fix | feat/a5m2-g2fix @ c80ec68e06d0796d3b1cadefcff8f8833d7548c0 — e78dee2a (G2 wire lane) REAL-NAMED refusal: NOT their tree (git fact-check attached: dc9c4a252 is a shared early ancestor on their branch; 4afa70063 + g2fix tip NOT on it); no receipt issued by them, tree untouched. **RESOLVED 20:49 via root routing**: original owner = the G2 connector web/MCP/browser owner (M2 production-wiring era; session id recorded on the coordination side) real-named, read-only: HEAD/ls-remote both c80ec68e0…, ahead/behind 0/0, porcelain/stash 0, job_list empty; 完成不再复用; e78 independently continues in wire-g2. **RETIRED** (registered as ORIGINAL-owner receipt routed by root, explicitly NOT an e78 proxy-signature; no further owner search/dispatch; center performs no cleanup - a356 immediate per-tree pre-admission check governs removal). |
| .worktrees/a5m2-g1fix | feat/a5m2-g1fix @ 18f181d6a87af34bc3e834908a1fe127afde4510 — **RECEIVED AND REGISTERED (20:5x)**: owner a0670fa8-4274-4700-8c40-e0edbc481131 real-named: did NOT create (tree pre-existed at b57ff559d under root's 8b4 isolation ruling) but IS last-write owner (three owned files, tip commit 18f181d6a, pushed remote); (2) COMPLETE + will-not-reuse — verified read-only: lineage landed on integration as 430ec1b6e and g1-query-wiring.mjs at 53ee0f28c hashes byte-identical to the owner's blob 7c820565…; tree holds nothing unlanded; zero touches (read-only log/show/hash-object only). **RETIRED** (完成不复用, registered verbatim against 18f181d6a87af34bc3e834908a1fe127afde4510; center performs no cleanup). |

## Peripheral declarations (context, NOT owner receipts)

- f86d5406 (pack verify): zero references of theirs to all four trees (own view only).
- 8e62e20c (current G3 wire): wire-g3 has no path/symlink/dependency references to
  g3a/g3b; content固化 via cherry-picks 7a223d24e/a9d7454c7/d30dc52f8 (content-consumer
  view, not owner receipt).
- Center never deletes; empty diagnostic .git under pack-int surface-bf4e89e1-… stays
  as-scene per root 20:46 (root never authorized its removal; center's mis-sent relay
  authorization was withdrawn before any rm; f86 executed read-only checks only).

## Closure (root-routed a356 execution, 21:1x)

All four owner-receipted trees were removed by the dedicated patrol with ordinary,
RC-guarded per-tree removal (root 21:12: all four remove RC=0; branch refs AND remotes
retained and rebuildable; final df 13,586,227,200 B). g6fix was NOT part of the removal
surface. Center registrations stand verbatim above; dispatch to g1fix/g2fix/g3a/g3b paths
is prohibited (trees gone, receipts archived here). ACTIVE protected during current work:
.pnr18-home / .pnpmm-r18-store / bf4fixture / the 307c Host kit pack.

## 根01:21 退役登记（中心逐树核实事实；remove 由 a356 按真 RC 条件执行，中心不删）

| tree | branch | HEAD | remote 等值 | tracked/WIP | 独有物 | 任务/owner 释放 | 裁 |
|---|---|---|---|---|---|---|---|
| a5m2-joint-cand | feat/a5m2-joint-cand | 6e2279286a | YES | 0/0 stash | 无 | joint-cand 验证轮已闭并入，无待续 | **RETIRE-READY** |
| a5m2-joint-cand2 | feat/a5m2-joint-cand2 | 9b5c9f4b29 | YES | 0/0 stash | 无 | 同上轮次，已闭 | **RETIRE-READY** |
| a5m2-family-rules | feat/a5m2-family-rules | 4e96decc6b | YES | 0/0 stash | 无 | census spec 全量入 int（flip 已吸收），rules lane 可另树接管 | **RETIRE-READY** |
| a5m2-wire-merge | feat/a5m2-wire-merge | fd555c117d | YES | 0/0 stash | 无 | 前代中心合流树，被 a5-m2-int 取代 | **RETIRE-READY** |
| a5m2-pinbuild | (detached) | 2188f15ce9 | commit 可达 origin/int | 0/0 stash | **`dsh-agent-team-0.1.1-alpha.2.tgz`（ignored 未推独件）** | pin 轮已闭，但 tgz 未证与他 pack 同字节 | **PROTECT 本轮**（a356 若先证 tgz 同字节母本或先迁走，可转 RETIRE-READY） |
| eb-e0-e1 | — | — | — | — | — | 原 owner 在跑（CI 修复等待 + E0/迁移 handover） | **排除**（根令；porcelain0≠退役） |

注意：joint-cand/joint-cand2 同时在 a356 的 7 文件小组内——**整树 remove 与文件级 dedupe 同路径不得并写**，a356 协调先后（先 remove 则该组在这两树自然消失，母本在他树存续）。
