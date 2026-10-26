# U6-PR4-REVIEW-R1 — independent review (verbatim)

> Provenance: qiyuan-inter/gpt-6.1-sol independent session; source `dev/agent-workflow/evidence/u6-pr4-review-r1/REVIEW.md`; copied verbatim.

# U6 PR4 / PR #377 — Security/Code Review R1

## Verdict

**补充内容**

Production bridge/kernel wiring is materially sound and the C1/C2 offline evidence is honest, but ARC-C has not reached the required positive real-Host effect. One additional C2 boot is required, with no product-code changes, after the already-recorded fixture fix. Separately, the disclosed `corded:false` ghost-id pass-through needs an explicit CI-05 scope ruling or a fail-closed product fix before it can be treated as a secure governed-agent contract.

## Findings and minimal additions

1. **ARC-C positive effect is still unverified (needs a 7th boot).** The receipts prove mount/leak and boot 4 proves real governed trio traffic (`trioUses:7`, control rows `0`), but every birth/management/fence/cancel effect leg is FAIL. Boot 6's cause is the fixture mismatch `description` required, and fix `cc2ea7b8d` was not run because the 6/6 budget was exhausted (`dev/agent-workflow/evidence/u6-pr4-20261026/README.md:137-166`). Run exactly one fresh C2 boot from this tree with that fix, expecting background job birth with a server-side ring marker; governed list/output; owner-mismatch host non-reach; kill request plus measured post-kill honesty; native control untouched; no second ledger; leak check. Do not change product code to obtain it.

2. **CI-05/native-fallback boundary is unresolved.** `checkManagementAccess` returns `{ ok:true, corded:false }` for any job absent from the Team attribution ledger (`packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs:152-170`), and the bridge then calls `jobsService` (`packages/runtime/src/plugin/live/jobs-family-bridge.mjs:309-318,326-343`). D3 deliberately proves this reaches Host for a governed Team row (`packages/runtime/test/u6-pr4-jobs-bridge.test.ts:474-485`). The architecture requires unsupported/unattributed/provider-unable paths to refuse before Body and forbids native fallback (`docs/plans/memo/unified-baseline-alpha5-20261025/u6/center-assembly-architecture.md:46-53`). The “no production creation-lane producer” disclosure explains occurrence but does not contain it. Required: either refuse unknown/unattributed IDs before `jobsService` on governed mounts, preserving native parity only outside, or obtain an explicit contract ruling allowing this exact scoped pass-through with owner guarantee. Until then this remains a carried security risk.

3. **The six-boot cause chain is credible but not sufficient for PASS.** Receipts consistently identify missing substrate, sandbox disk law, transcript lane contamination, wrong bash/ask envelope, provider duplication, and required `description`. Ring-first Host-buffered output, ARGS/result pairing, foreground spacer/post-settle read, and twelve mutations strengthen test teeth. The offline judge is non-vacuous and 28/28 passes (`tests/world-factory/world-factory.test.mjs:557-605`). The final fix remains unverified, so this is test-completeness evidence, not product success.

4. **HTU/raw-log disclosures qualify claims.** `cp -a` was necessary because the documented baseline path was a stub, and install used `--ignore-scripts` (`dev/agent-workflow/evidence/u6-pr4-20261026/README.md:187-210`). Detached HEAD/porcelain guards make receipts useful, but they are not an independently cloned pristine baseline or complete raw-log retention. Keep “pristine Host” qualified.

## Positive verification

- Recomputed moved-region hash: `sed -n '76,347p' packages/runtime/src/plugin/live/jobs-family-bridge.mjs | sha256sum` = `71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f`; master extracts at `8337e52cf:595-866` and `3288567d3:1579-1850` match. No semantic edit in the moved body; center face begins at line 349.
- Frozen hashes match: `jobs-gateway-assembly.mjs` = `c99ecaadf2d34f8c313e539aee6ab9e247aad6e32b6087d29f12edaa08158b53`; `pa-mount-registry.mjs` = `fa1d831d559d1016f6ee99e43436d3155b3f0c493a76fda021cc228f4c14510d`. E2 stale-disposer and E3 naive-delete counterfactual are substantive.
- Closed schema covers `NAMED_BRIDGE_REQUIRED`, `CAPABILITY_UNBACKED`, host-pin digest drift, and bridge identity/name-set checks (`packages/runtime/test/u6-pr4-jobs-bridge.test.ts:170-247`). Descriptor is provider-backed (`dsh.host/job-registry`) with `execution.via: 'named-bridge'`; it is not family self-attestation (`packages/runtime/src/plugin/live/jobs-family-bridge.mjs:412-520`).
- Same ledger path is structurally demonstrated: one `centerKernel`, same `guard.owns`/`identityFor`, same lazy approval-entry path and `consumeForExecution`; jobs is a third candidate, not a second approval table (`packages/runtime/src/plugin/live/team-tool-plane.mjs:1864-2014`). Test D observes unchanged approval table/registry/control-leg counters and owner-fence zero Host reach (`packages/runtime/test/u6-pr4-jobs-bridge.test.ts:417-485`). `controlRows: []` is meaningful for exercised managed trio but cannot prove the un-attributed pass-through is governed.
- Protected files untouched: `control/**`, `tool-admission/**`, `pa-mount-registry.mjs`, `jobs-gateway-assembly.mjs`, and `install.ts`.
- Targeted C1: 10 files / 97 tests passed; world-factory: 28/28 passed. The literal requested glob found no files because names are not all prefixed `u6-prN-*`; explicit files were run.
- Offline frozen install attempted with the required hardlinked mirror and failed only because `@deepseek-ai/dsh@0.2.0-rc.2` is absent (`ERR_PNPM_NO_OFFLINE_TARBALL`), matching prior disclosure.

## Explicit ARC-C ruling under §10.6

**Needs a 7th boot; not FULL BRIDGE PASS yet.** Six boots establish bridge placement/feed, mount-generation safety, no-second-ledger on real trio calls, and teardown leak safety. §10.6 requires a real named Bridge positive接入成功, and PR4's C2 contract requires positive jobs effects; mount + placement + feed + leak-check alone are not a positive special-mechanism effect. If the seventh boot passes the expected outcome above, ARC-C can be FULL BRIDGE PASS subject to resolving/ruling the CI-05 ghost pass-through. If not, the correct status is **G4-CORE-PASS / BRIDGE-BLOCKED**, not full G4; core evidence may continue independently, but Jobs and Alpha.5 release remain blocked.

## Carried risks

- G3 `other-world-unaffected` remains an earlier carried risk.
- C2 raw instance logs remain outside the repository; receipts are verdict-complete but not byte-complete raw transcripts.
- `corded:false` currently gives a governed agent a Host-native route for un-attributed job IDs; this is the key security contract question.
