# U6-PR2-REVIEW-R2 — independent review (verbatim)

> Provenance: qiyuan-inter/gpt-6.1-sol independent session; source `dev/agent-workflow/evidence/u6-pr2-review-r2/REVIEW.md` (local); copied verbatim.

# U6 PR2 / PR #373 — FINAL round 2 independent review

## Verdict

**通过**

No blocking or supplemental correctness/safety finding was found. The enforcing read takeover is wired in production, and the requested R-REM-2/R-REM-3 conditions are independently evidenced.

## Scope and checks

- Reviewed production diff from `origin/master` (`c6cfec890`) to detached head `480114fb21ae08c7df3e3d9a55fd73e4`; no host boot and no commits/push.
- Production wiring: `packages/runtime/src/plugin/live/agent-bindings.mjs:2449-2514,2695-2715,3077-3108` installs the guard before plane assembly and passes the guard's `pendingCalls()` as the enforcing kernel lifecycle port. `packages/runtime/src/plugin/live/team-tool-plane.mjs:1666-1799` builds/publishes the enforcing kernel, binds the reviewed FS contribution once, and fails closed on registration/kernel/port failure. `packages/runtime/tool-dispatch/install.ts:1003-1028,1052-1104` performs the pre-body table gate and post-success drift veto.
- CI-05/CI-03: `team-tool-plane.mjs:1901-1915` exposes a rejecting `read` kernel face when a governed mount has no usable `fsInstance`, preventing native fallback; the no-plane path remains native. Covered by `packages/runtime/test/u6-pr2-review-r1.test.ts:241-286`.
- Scope and lifecycle: `packages/runtime/governance-center/kernel.ts:254-425` enforces enforcing-mode lifecycle-port presence, scoped approval keys, candidate generation/source binding, and one-shot consume reservation/burn. `packages/runtime/test/u6-pr2-rrem2-read-lane.test.ts` RR1–RR6 all passed.
- Golden corpus: `packages/runtime/test/u6-pr2-golden-corpus.mts:30-47` covers NFC/NFD, non-BMP, dot segments, trailing/duplicate slashes, absolute inside/outside root, and symlink-name target disclosures. The recorded family/master JSONs are byte-equal; generator provenance is recorded in `golden-vectors-round2.txt` and the test pins digest `bfa69f58…`.
- Protected set: diff contains no `control/**`, `tool-admission/**`, or `pa-mount-registry.mjs` changes. `tool-dispatch/install.ts` and `operation-permission/canonical-operation.ts` changes are the narrowly scoped consumer/normalizer seam needed by PR2.
- C1 independently run: U6 PR1/PR2/FIX-K suites, 11 files / 86 tests passed; read ride-alongs, 11 files / 182 tests passed; `node --test tests/world-factory/world-factory.test.mjs`, 19/19 passed.
- C2 receipts independently read: `c2r3/run-u6fsb11.json` reports overall PASS with all 10 cases PASS, including post-cap read success with an independent oracle receipt timestamped after the cap marker (`:200-221`).

## Findings

None.

## Carried risks / disclosures

- The full-worktree vitest receipt carries the repository's pre-existing disclosed `p6t3` baseline failures; the targeted PR2/FIX-K/ride-along suites and world-factory tests are green.
- The requested offline frozen-lockfile install could not complete in this detached worktree because the local mirror lacks the `@deepseek-ai/dsh@0.2.0-rc.2` tarball (`ERR_PNPM_NO_OFFLINE_TARBALL`). This is an environment/mirror limitation, not a code finding; tests ran using the available workspace toolchain.
- C2 evidence discloses prior host-start budget overage, while the authoritative resumed `u6fsb11` receipt itself uses one leased boot and passes leak/stable-instance checks.
