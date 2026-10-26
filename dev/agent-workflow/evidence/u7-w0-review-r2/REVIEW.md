# PR #397 — independent adversarial review R2

- Branch: `task/u7-w0-review-r2-20261026`
- Reviewed head: `b4f6e3c04f76816ccac9040c0022df34b7522c7b`
- Base: `origin/master` (`f3f415aa0` is present in the merged history)
- Verdict: **PASS**

## Verdict summary

R1 F-1 is fixed in all five registries: loaders enumerate every directory entry and refuse/name unexpected entries. The p4t6 loader returns a named violation; the other four throw named errors. R1 F-2 is resolved as an intentional semantic decision: numeric prefix gaps are documented and pinned by a test; duplicate and ill-formed names refuse.

## Required verification

| Item | Result | Evidence |
|---|---|---|
| p4t6 exact total | VERIFIED | `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts`: 20/20 green. Planting a new scannable `packages/runtime/test/r2-unbooked.test.ts` produced red (6 failed); removing one booked path from `u7w0.json` produced red (8 failed). Both plants were restored. |
| p4t6 stray plants | VERIFIED | `x.txt`, `sub/y.json`, `sub/y.mjs`, `.hidden.json`, uppercase `Lane.json`, symlink, and empty `099-empty.json` were all named as violations (`stray-entry` or `unparseable`); no silent acceptance. |
| dist-placements stray plants | VERIFIED | Same seven plants all refused; errors named `x.txt`, `sub/`, `.hidden.json`, `Lane.json`, symlink name, or empty JSON parse failure. |
| eslint-node-globals stray plants | VERIFIED | Same seven plants all refused by the real exported `nodeGlobalsPatterns()`; errors named the stray or parse failure. |
| world-kinds stray plants | VERIFIED | Same seven plants all refused; errors named every stray, including empty `.mjs` as descriptor failure. |
| suites stray plants | VERIFIED | `x.txt`, nested files, dotfile, uppercase name, symlink, and invalid module all refused by named stray/loader errors. The empty-module plant was additionally attempted; suite fixture imports require their relative runner dependency and refused in the isolated temp copy rather than being accepted. |
| F-2 gap policy | VERIFIED | `node --test tests/checks/dist-placements.test.mjs`: 9/9; order-law test explicitly accepts a `015-...` insertion between `010` and `020`. Documentation in `scripts/place-dist-glue.mjs` and evidence README states gaps are intentional. |
| F-2 grammar | VERIFIED | `01-x.json`, `0100-x.json`, and `abc-x.json` each refused as stray/ill-formed. Duplicate prefix is pinned and refused by the placement test. |
| Registry suites | VERIFIED | Placement, eslint, registry, world-factory, and ARC-D checks: 72/72 passed. |
| EB3 | VERIFIED / noted | `eb3-ci-required`: 9 workflows, 0 findings. `eb3-ci-negative-controls`: 16/16. Family boundaries, family definitions, trusted sources, and run-manifest: 0 findings. `eb3-security-run` locally reported `ENV_BLOCK` because vitest emitted no JSON report under this environment; hosted required checks are green. No EB3 script text-reads `PLACEMENTS`, p4t6 lists, `SUITE_CASES`, or eslint lists (grep clean). |
| Ports | VERIFIED | World-factory tests pass widened bands and exact edges: 3080 refused; 3179/3200/3490/3501/12999/13100 refused; sanctioned edges pass. `isSanctionedTestPort` remains strict for non-integer and stable port values. |
| Hosted checks | VERIFIED | `gh pr view 397 --json headRefOid,statusCheckRollup` shows head `b4f6e3c04` and SUCCESS for candidate-protection, census-runtime, synthesize-merge-tree, pr-gate, ci-fast, ci-integration, ci-security, ci-full, and ci-required. |
| G6b flake scope | VERIFIED | Diff touches neither `packages/runtime/test/alpha5-glue7-plane-backends.test.ts` nor `packages/tools/search-family/**`. |
| Scope | VERIFIED | No `packages/**/src/**`, protected-center path, or `team-tool-plane.mjs` changes in the PR diff. No Host boot and no :3080 interaction performed. |

## Plant outcome details

All plants were created in temporary directories copied from the corresponding live registry and removed immediately. Symlinks were treated as directory entries and refused by grammar; uppercase names were refused; empty right-suffix files were parsed/refused (p4t6 reports a violation, others throw). No plant remained in the worktree.

## Findings

None. The prior R1 findings are closed:

- F-1: fixed by complete directory-entry enumeration in all five loaders, with named stray reporting.
- F-2: gaps are intentional insertion room, documented and pinned; duplicate prefixes and ill-formed names refuse.

## Could not verify

No merge-blocking item. Local `eb3-security-run.mjs` is environment-blocked (`vitest wrote no JSON report`, exit 1), but this is not a PR failure and the hosted `ci-security` check is SUCCESS. The hosted census/runtime check is also SUCCESS. The isolated empty-suite temp copy lacks its normal relative runner dependency, so its refusal was observed as a dependency-load refusal rather than the canonical empty-descriptor message; the real registry test suite is green and all other empty-file plants were directly refused.

## Restoration

Temporary plants and mutation controls were removed/restored. Review worktree is clean except this review file before commit.
