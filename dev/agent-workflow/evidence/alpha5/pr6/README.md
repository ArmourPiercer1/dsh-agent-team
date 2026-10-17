# alpha5/pr6 — PoC6a (PTC seam) + PoC6b (LSP pool/lifecycle seam) evidence

- `p6-hook.mjs` — ESM resolve hook (same pattern as alpha5-adapter-p0); T = pristine 0.2.0-rc.2 @ 639ed01539, read-only.
- `p6a-runner.mjs` → `p6a-result.json` — 9 legs, EXIT=0 (2026-10-19). `node p6a-runner.mjs` (~2s).
- `p6b-runner.mjs` → `p6b-result.json` — 10 legs, EXIT=0 (2026-10-19). `node p6b-runner.mjs` (~10s; spawns fictional stdio servers only).
- `SEAM-VERDICTS.md` — three-state records (PoC-1 format) per seam + PoC 分叉判定.
- `probe-scratch/` — regenerated per run (fabricated data + fictional server script only).
- No ports bound, no DSH_HOME worlds created (reserved 3183 / tests/homes/a5p6-* unused, recorded); :3080 untouched; DORMANT (nothing wired).
