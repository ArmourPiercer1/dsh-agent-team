# PREFLIGHT — root package @19d54bd72 (write PA hand-off producer; root Source PASS @19d54+4acfa)

Date: 2026-10-23T14:13-14:16Z. Lane: CENTER packaging + entry-import preflight (NOT a C2 run: no server, no port bound, world confined to its own directory). Host639 untouched beyond its pinned clean checkout; the C2 owner (307c) stays the ONLY Host runner.

## Package identity
- pin dir (FROZEN read-only, 0 writable files): `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-m2-int/packages-pins/19d54bd7241a3666e1a595b805ac50693a3b7c2d/`
- tgz: `dsh-agent-team-0.1.1-alpha.2.tgz` — sha256 `bc638eb44ab7343b4d949609e79f214bd4072c52b842cf837fbc3b178e4f192c`, 3249070 bytes, 1813 entries.
- source SHA (git archive of this commit ONLY — owner WIP cannot ride by construction): `19d54bd7241a3666e1a595b805ac50693a3b7c2d` (origin tip, pushed).
- kit MUST read the full entry/hash lists from the pin dir: `manifest-tgz-entries-C.txt` (1813 paths, sha256 of the list `0d4471c3ed4ad5ffed344629393e12dade9e1585139517cd1283b6305ff25230`), `manifest-tgz-dist-hashes.txt` (all 1813 per-file, `d8269843d0164396fa049970311066b616e346bfc5bea78dcbf7df54242dd8fa`), `manifest-installsurface-hashes.txt` (473 js/mjs/json, `3768830833ecf0aa27593472a3a34d38345b3212e8c80bef4eb6b437699d2d7d`), header `MANIFEST-19d54.txt`.
- normal build law verified BEFORE pack: `check-artifacts-at-head` at 19d54 → `verdict=ok compared=1788 drift=0` (incl. 17 glue placements) — the committed surface IS a fresh build of itself; NO live dist, NO worktree bytes.
- pathset EQUALS the 8b9462059 pin (1813, LC_ALL=C diff EMPTY); content delta by path EXACTLY SIX files: dist pre-execute-adapter .js/.d.ts/+2 maps (step 1 @4acfa) + dist live/team-tool-plane.mjs + dist live/agent-bindings.mjs (steps 2-3 @19d54). src↔in-package mirrors cmp-clean (`68e04a6a…` plane, `36ce025f…` glue).
- identity from the TARBALL's own package.json: dsh-agent-team@0.1.1-alpha.2, exports [".","./host","./spill-local","./client","./package.json"], peers = NINE × EXACT 0.2.0-rc.2 (identity unchanged from the 8b94 pin).

## Install layout (fixed-639 normal, dual root, no shortcuts)
world `tests/homes/a5m2-root-preflight-19d54-14-15-00Z/`: `pnpm install --ignore-workspace --ignore-scripts --prefer-offline --store-dir <main .pnpm-store>` → INSTALL_RC=0 (14.6s), tgz via file: spec, 9 peers at exact 0.2.0-rc.2. Host root: `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`, porcelain CLEAN (verified this session). NO NODE_PATH, NO allow-version, NO tgz edits, nothing written into the pin.

## Probe (`preflight.mjs`, log `preflight.log`, REAL_RC=0 direct status)
- `0-integrity`: nearest manifest dsh-agent-team@0.1.1-alpha.2; ALL 473 js/mjs/json install-surface files RE-HASHED against `manifest-installsurface-hashes.txt` → **checked=473 bad=0 MATCHES-PIN**.
- `1-host` (`import 'dsh-agent-team/host'` — the export-map face the Host mounts): IMPORT-OK [apply, inject, defaultGlueUrl, defaultSeamUrlCandidates, buildGovernanceWarning*, …].
- `2-glue` (PHYSICAL dist `agent-bindings.mjs`, the glueUrl face, FULL static graph plane → governed-families todo/write → post-consume closure, web/jobs/ptc rows): IMPORT-OK [createAgentBindings, createPtcEscalationRouter, GUARD_NATIVE_TRUST_EXCLUDED_MCP_PREFIX, …].
- `2b-plane` (this package's substance): dist plane face IMPORT-OK and carries the `paWriteHandoff` port law — PRESENT.
- `3-seam` (`root-binding/harness/seam.mjs`, default seam): IMPORT-OK [createRealStorageDomainSeam].
- **VERDICT PASS (4/4), REAL_RC=0.**

## Honest record
- First probe run printed `bad=473 UNPINNED` + `1-host MISSING inject`: BOTH were bugs in the PROBE (pinMap keyed by hash instead of path; an over-strict typeof assert on a face the prior law checks by presence). The package was NEVER touched between runs — same installed tree, probe fixed, second run 473/473 MATCHES-PIN + PASS. Recorded per the no-green-from-failure law.
- The 11 plane-direct spec legs are C1 evidence ONLY; they do NOT substitute for the Host proof. The C2 on the original 307c Host must EMPIRICALLY show: old parameter-permission rows = 0, PA PENDING untouched, public allow ONE consumption write lands 1, deny/abandon zero writes, with the ORIGINAL relative synthetic fixture / default ask / fsroot / 15-Team exclusion / 19 global deny KEPT, FIRST-ERROR-STOP, NO 3-runs, NO live dist.
- Usage line for the run is in `MANIFEST-19d54.txt`; prior pins (31f7/8b94/…) stay KEPT UNRENAMED.
