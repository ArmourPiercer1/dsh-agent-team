# alpha5/pr6 — PoC6a (PTC seam) + PoC6b (LSP pool/lifecycle seam) evidence

- `p6-hook.mjs` — ESM resolve hook (same pattern as alpha5-adapter-p0); T = pristine 0.2.0-rc.2 @ 639ed01539, read-only.
- `p6a-runner.mjs` → `p6a-result.json` — 9 legs, EXIT=0 (2026-10-16). `node p6a-runner.mjs` (~2s).
- `p6b-runner.mjs` → `p6b-result.json` — 10 legs, EXIT=0 (2026-10-16). `node p6b-runner.mjs` (~10s; spawns fictional stdio servers only).
- `SEAM-VERDICTS.md` — three-state records (PoC-1 format) per seam + PoC 分叉判定.
- `probe-scratch/` — regenerated per run (fabricated data + fictional server script only).
- No ports bound, no DSH_HOME worlds created (reserved 3183 / tests/homes/a5p6-* unused, recorded); :3080 untouched; DORMANT (nothing wired).
- Revision (fold 轮 2026-10-17, 按 review-LaneE @ 1e0bbb67 MINOR-1/2 的文档性补充): 记录日 10-19→2026-10-16 (= result json `recorded_at_utc` 与 commit 日期); `ptc.ts:525-536`→`545-553` (pinned src `639ed01539` 逐行复核, 与 durable append `:611-618` 之间无重叠). 纯文本/引注级修正, 三态判定与证据数值未动; 仍 DORMANT, 未接线。
