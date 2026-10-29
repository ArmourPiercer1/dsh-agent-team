# U3-A — Evidence inventory & reader impact (origin/master @ 95fbe95cf, read-only git plumbing)

**Totals.** Evidence = 21,141 files / 534,944,430 B (91.4% of the 585,098,626 B repo).
**Keep-set (must stay tracked): 92 files / 1,349,896 B (~1.3 MiB).**
**Relocate-set: 21,049 files / 533,594,534 B (~508.9 MiB).**
Top relocation dirs (bytes): pre-alpha3-refactor/pr-e 66.2 MB (910 f) · a4-pr7/ci-gate 52.4 MB (98) · a4-pr6/gates 17.0 MB · alpha5/w-ptc-outerfs 16.4 MB (874) · a4-pr7/7-6-closure 16.1 MB — full top-30 in `relocate-set-stats.json`.

## Why these 92 stay (hard RUNTIME-READ; details + file:line in runtime-readers.json)
- ci-pr-gate BASELINES (scripts/ci-pr-gate.mjs:105-107): `a4-lint-baseline/lint-identities-0237d487.txt`, `a4-pr7/population-baseline/nine-root-2b1099d7.md`, `a4-pr7/ci-gate/blueprint-fence-baseline-606a0be7.txt` (legs + `--self-test` read them).
- Fence ledger `a4-pr7/scan-scope/unknown-adjudications.json` — verify-blueprint-version-clean.mjs:1169-1183 **refuses an untracked ledger**; + scan-scope/fixtures (35 f, test readdir+read), g2-summary-parser/fixtures (8 f, a4p7-merge-gate g2Fixture).
- Executed/imported evidence code: alpha5/int-r3/a5intr3-plane-mount-kit.mjs (imported by a vitest-root test), alpha5-adapter-p0/00-baseline/p00-fixture.mjs (4 kits), wiring/bind-diag/a5bd-diag-row.mjs, wiring/w5/{run-w5-live,build-lane-esm,a5w5-assembly-row,a5w5-fixtures}.mjs (spawned chain), natexe receipts (a5int-r3:297, a5b2:286).
- gen-current-state.mjs:215-220 ARTIFACT_MISSING (blocking) → 7× `evidence/EB-E0-E1/*.log` per dev/engineering/registry.yaml:71-151.
- Characterization probe (probes/remote-client/index.mjs:517-521) → 21 seam-manifest paths (P2-T1..T6 reports/logs).
- ci-pr-gate Q5 (ci-pr-gate.mjs:430-433) existence-checks evidence paths cited in the matrix doc (graph.yaml:95): ≥1 file must remain in each of alpha5/{jobs-isolation,live,natexe,ptc-fs-impl,srgp,w-ptc-c2,w-ptc-outerfs,wiring/real-lsp}/ + evidence/alpha5/ root — README witnesses chosen in keep-set.json.

## Counting / pinning checks (the asked-for list)
| check | effect of relocation |
|---|---|
| p4t6 total pin **1228** (p4t6-session-event-scan.test.ts:243/311) | **unaffected** — scanner walks packages/** only (session-event-scan.mjs:202,262-268); evidence never counted |
| census nine-root corpus (ci-pr-gate:1308; vitest.config.ts:24-27) | corpus unaffected; keep-set keeps a5int-r3/kit-runner/a5b2 green — no new red identities |
| blueprint-fence universe "N tracked files" (ci-pr-gate:1212) | context print only; identity diff gates; evidence out of fence scope (bvc.test.ts:870) → **unaffected** |
| lint-visibility census (a4p7-merge-gate.test.ts:588-694) | denominator live-derived, no pin; dev/** ratified-invisible → **unaffected** (candidate count merely shrinks) |
| lint-identities baseline | eslint ignores dev/** (eslint.config.mjs:102); 0 evidence identities in baseline → **unaffected** |
| check:artifacts OK-count (INSTALL_SURFACES, client-composition-surface.mjs:98) | evidence not an install surface → **unaffected** |
| ci-pr-gate **Q5** matrix existence | **affected** → kept dir witnesses (else `cites evidence path(s) … do not resolve in-repo`) |
| gen-current-state **ARTIFACT_MISSING/FAKE_VERIFICATION** | **affected** → kept EB-E0-E1 logs |
| seam-manifest evidence-exists | **affected** → kept 21 P2-* paths |
| docs:sync --check **LINK_DANGLING** | **affected** → see below |

## Doc-link impact
101 tracked md/yaml files outside evidence mention evidence paths (538 occurrences) — historical text (SESSION_ROUTER_LOG, finished/paused plans) is never link-checked (doc-checks.mjs:53-66).
Real markdown links (checker regex doc-checks.mjs:111-131) from **full-scope** docs into evidence: **54 links / 30 distinct targets (481,627 B)** from 4 files — S0-SELECTION-MATRIX.md 47, alpha5-s0-pr0-pr8-implementation-plan.md 3, post-poc-technical-design.md 3, docs/contracts/engineering-baseline/plan-citation-interface.md 1. If those targets vanish, `pnpm docs:sync --check` fails (blocking LINK_DANGLING); `docs:probe` (diff-scoped, docs-probe.mjs:117) stays green for a deletion-only PR. YAML is not link-checked. **CLAIM_WITHOUT_EVIDENCE: 0 new** (simulated over all 16 current-state docs). No `eb-plan` blocks exist, so PLAN_CITATION is not triggered.

## Recommended minimal reader change
Make the link checker **manifest-aware**: in `doc-checks.mjs checkLinks`, a relative link whose target is listed (or whose parent dir is covered) in the tracked relocation manifest (`evidence/u3-manifest`, the small tracked index) resolves as `LINK_STORED` instead of dangling — one function, keeps docs verbatim and the store invisible to CI. Alternative: keep the 30 targets (0.47 MB) tracked, or rewrite the 54 links; manifest-awareness is the durable fix the U3 plan asks for ("所有链接…引用影响需明确列出和改写").

## Caveats
- `.github/workflows/candidate-protection.yml` grades branch a5-candidate-pkg@090b87b5 (own evidence copy; master git rm cannot touch a pinned SHA) — re-pinning at a post-relocation head would need materialization.
- Kit writers (smoke kits, ci-pr-gate scratch at :1613-1614, prepare-blueprint-v4-flip) all mkdir-p → deletion-safe; gitignore scratch writes post-move.
- sweep-worlds --scrub-raw (tests/kits/a5p1*/sweep-worlds.mjs:82-92) will no longer see relocated raw logs (0 tracked host-stdout.raw today; 5 instance.raw.log move with the store).
- Regenerate `dev/engineering/current-state.json` only if registry entries change; unchanged keep ⇒ no view churn.
