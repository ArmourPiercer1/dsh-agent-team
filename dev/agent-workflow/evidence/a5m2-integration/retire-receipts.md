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
| .worktrees/a5m2-g2fix | feat/a5m2-g2fix @ c80ec68e06d0796d3b1cadefcff8f8833d7548c0 — e78dee2a (G2 wire lane) REAL-NAMED refusal: NOT their tree (git fact-check attached: dc9c4a252 is a shared early ancestor on their branch; 4afa70063 + g2fix tip NOT on it); no receipt issued; tree untouched by them. TRUE ORIGINAL OWNER STILL UNIDENTIFIED — no cleanup, no dispatch, awaiting root routing. |
| .worktrees/a5m2-g1fix | feat/a5m2-g1fix @ 18f181d6a87af34bc3e834908a1fe127afde4510 — coordination 20:5x: locate true owner by ID (原a067); identity question sent to a0670fa8-4274-4700-8c40-e0edbc481131 ("Card G1-WIRE query wiring") with strict no-proxy/no-guess wording; receipt PENDING. |

## Peripheral declarations (context, NOT owner receipts)

- f86d5406 (pack verify): zero references of theirs to all four trees (own view only).
- 8e62e20c (current G3 wire): wire-g3 has no path/symlink/dependency references to
  g3a/g3b; content固化 via cherry-picks 7a223d24e/a9d7454c7/d30dc52f8 (content-consumer
  view, not owner receipt).
- Center never deletes; empty diagnostic .git under pack-int surface-bf4e89e1-… stays
  as-scene per root 20:46 (root never authorized its removal; center's mis-sent relay
  authorization was withdrawn before any rm; f86 executed read-only checks only).
