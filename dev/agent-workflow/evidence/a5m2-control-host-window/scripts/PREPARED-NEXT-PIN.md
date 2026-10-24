# PREPARED next-product pin material (NOT applied — no root release ruling yet)

Received 2026-10-24 from f86 (main relay). ALL values recomputed read-only by B:

- source SHA `694b0c0eb8d38511ba3322e786c4daefcc378628` (int branch, parent a27f1a46, descendant of 4a26ac9a)
- tgz `.worktrees/pack-int/out-694b0c0e-20261024T130252Z/dsh-agent-team-0.1.1-alpha.2.tgz`
  sha256 `d703affb60f4945373ca9a2a2605bf646e3989375a3eb28b5cb16976157832e7` — **measured equal** ✓, 4,346,804 B ✓
- INSTALL_DIR `.worktrees/pack-int/install-d703affb` present ✓, exports['./host'] resolves ✓
- lock: letter listed two variants; **measured** `b76e19639f3f9d39a031502c14e80dc47240dd6db95445a9c84427e1f5529c25`
  (= the f86 "精确值"; the letter's first variant `…dc4720dd…` is a typo — measurement decides)
- fixture pkg `38a5d47d01a7b67f53273286f503f12ae987530b3089d7185debcbdd20a989bd` — **measured equal** ✓
- released surface: exactly 4 dist .mjs (agent-bindings / team-tool-plane / subagent-spawn-adapters /
  subagent-spawn-wiring) — the governed-spawn-mount breakpoint family of window 20261024T12-13-10Z
- disclosed observation (not full-green claim): host.js:2365 optional dynamic import of
  `@deepseek-ai/dsh-sandbox` undeclared in deps/peers, resolved via hoisted虚仓; RC=0 unaffected

LAW HOLD: runner pins stay 4a26ac9a / e3e845f0 / install-e3e845f0 until the root's release
ruling; swap = COMPOSED_SHA/EXPECTED_PACK_SHA/EXPECTED_LOCK_SHA/EXPECTED_TGZ_DIR_PREFIX(→
`out-694b0c0e-`)/default INSTALL_DIR in ONE change with the GO; no Host start before root GO.
