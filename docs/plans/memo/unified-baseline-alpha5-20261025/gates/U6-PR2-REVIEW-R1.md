# U6-PR2-REVIEW-R1 — independent review (verbatim)

> Provenance: qiyuan-inter/gpt-6.1-sol independent session; source `dev/agent-workflow/evidence/u6-pr2-review-r1/REVIEW.md` (local); copied verbatim.

# U6 PR2 review round 1 — Security/Code Reviewer

**PR:** #373, head `a8ea8ccfc` (detached review worktree)
**Verdict: 阻塞**

## Findings

1. **Enforcing kernel silently accepts a synthetic lifecycle counter instead of requiring the real dispatcher port (R-REM-2 / K3).** `packages/runtime/src/plugin/live/team-tool-plane.mjs:1723-1728` constructs `mode: 'enforcing'` with `input.dispatcherLifecycle ?? { inflight: () => kernelLaneInflight }`. Thus a production mount with no `a5p1Guard` still assembles an enforcing kernel and can release based on a family-local wrapper counter. The FIX-K requirement is enforcing mode with a *real* lifecycle port, and the remediation explicitly says absence must fail closed, never degrade to an uncounted/self-counted fallback. The production wiring does pass `a5p1Guard.pendingCalls()` when present (`packages/runtime/src/plugin/live/agent-bindings.mjs:2707-2715`), but the fallback defeats the absence refusal. **Required:** remove the fallback; pass the real port only, and make the assembly return typed failure when it is absent. Add a production-shaped test proving no Guard/lifecycle port cannot mount enforcement.

2. **Required world-factory C1 suite is red at the reviewed head.** `node --test tests/world-factory/world-factory.test.mjs` fails `u6-fs: SUITE_CASES entry and parseArgs wiring` because the expected list at `tests/world-factory/world-factory.test.mjs:429-432` omits the newly added `fs:shadow-ledger-cap`, while `tests/world-factory/u5-canary-runner.mjs:91` includes it. The committed C2 receipt claims 10/10 and R-REM-3 cap evidence, but the required offline suite is not green from this head. **Required:** update the assertion and rerun the suite (and record the result).

3. **Golden corpus does not cover the explicitly required path edge classes.** The claimed 877-vector corpus in `packages/runtime/test/u6-pr2-read-golden-vectors.test.ts:47-48` contains relative, absolute, and `sub/../` paths, but no unicode path and no symlink-ish path spelling. The user-requested review condition explicitly requires checking symlink-ish/unicode coverage, and the test's own corpus digest cannot prove those classes are preserved. **Required:** add representative unicode and symlink-ish lexical path vectors to the pinned pre/post corpus, regenerate the canonical digest/receipt, and keep the family-vs-master byte equality assertion.

4. **Unsupported Team mounts can still inherit the native `read` body (CI-05).** `team-tool-plane.mjs:1557-1576` only places the governed read when `fsInstance` exists; otherwise `readExecutor`/`readRowDef` are null and the family/kernel is absent. However `agent-bindings.mjs:2416-2423` builds `nativeNames` from the global schema list, and `install.ts:1295-1302` binds those names as verified native when they resolve to the global definition. A governed Team setup with `teamToolPlane` present but no usable `fsInstance` therefore has a path for `read` to execute via the native body without a kernel approval. This is exactly the CI-05 prohibited fallback unless the product contract explicitly excludes `read` from the governed set in that configuration. **Required:** either fail the governed mount closed when the read provider is absent, or explicitly mask/deny the governed `read` name before native binding; add a negative production-shaped test proving no native read body executes.

5. **C2 receipt oracle review is incomplete for the cap case.** The cap verdict in `tests/world-factory/u5-canary-runner.mjs:1118-1124` uses `claimOccurrences(F.s4.claim) > 0` plus the product shadow ledger marker and host liveness. This is independent of tool return text, and the ledger cap implementation itself is bounded, but the committed JSON evidence's `readResults` is transcript-derived and does not expose a distinct oracle marker for the post-cap S4 effect. The receipt is therefore weaker than the requested independent-effect proof for R-REM-3. **Required:** retain/record an explicit marker/ledger observation tied to the post-cap read effect (not only a claim occurrence in model/tool messages), and include it in the verdict-carrying receipt.

## Checks performed

- Targeted Vitest: all 10 U6 PR1/PR2/FIX-K files passed, 80 tests.
- Golden test passed locally (877 digest remains pinned), but edge coverage gap above remains.
- `node --test tests/world-factory/world-factory.test.mjs`: **18 pass, 1 fail** (stale u6-fs expected case list).
- Protected source areas: `control/**`, `tool-admission/**`, and `pa-mount-registry.mjs` had no source changes; `tool-dispatch/install.ts` changed for the consumer seam and `operation-permission/canonical-operation.ts` changed for the explicitly planned read projection move.
- Production wiring traced: `agent-bindings.mjs:2449-2492` lazy kernelGuard wrapper; `agent-bindings.mjs:2695-2715` plane assembly and lifecycle port; `team-tool-plane.mjs:1691-1768` enforcing registry/kernel; `install.ts:1006-1028` pre-body table gate and `1069-1098` post-success veto.
- No host boot was performed by this review.

## Carried risks

- The committed C2 receipt reports `u6-fs` 10/10, core 7/7, and cap-hit markers, but the current offline factory assertion is stale/red and must be repaired before relying on the receipt set as a clean C1/C2 package.
- The real `pendingCalls()` wiring appears correct when a Guard exists; the blocker is the assembly's fallback path that permits enforcing without it.
