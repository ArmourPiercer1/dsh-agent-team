# U6-PR3-REVIEW-R1 — independent review (verbatim)

> Provenance: qiyuan-inter/gpt-6.1-sol independent session; source `dev/agent-workflow/evidence/u6-pr3-review-r1/REVIEW.md` (local); copied verbatim.

# U6 PR3 / PR #375 — Security/Code Review Round 1

## Verdict

**补充内容**

Production wiring and C1 evidence are materially sound, but PR3 C2 does not prove the required positive real-Host bash effect. The missing leg is a pre-existing master product condition, not a PR3 regression; nevertheless CA-02/ARC-B explicitly requires a real positive effect and the current live suite only proves fail-closed refusal.

## Scope and verification

- Reviewed detached `9d66e5134` against `origin/master` `cd54f3b7c`; no host boot and no commits/push.
- Mandated offline install with a hardlinked `.pnpm-store/v11` mirror: **PASS** (`pnpm install --frozen-lockfile --offline`).
- Targeted U6 PR3/PR2/FIX-K/PR1, shell/bash ride-along, and a3p3 vitest suites: **21 files / 238 tests passed**.
- `node --test tests/world-factory/world-factory.test.mjs`: **22/22 passed**.
- Read committed PR3 C2 receipts under `dev/agent-workflow/evidence/u6-pr3-20261026/`; u6-proc judge is 9/9 fail-closed PASS, but live positive spawn arms are disclosed as unreachable on this Host world.

## Findings

1. **C2/CA-02 positive bash effect is not demonstrated (supplement required).**
   - Evidence: `tests/world-factory/README.md:78-106`; `dev/agent-workflow/evidence/u6-pr3-20261026/README.md:67-79`.
   - The live C2 world proves `proc:mounted`, typed pre-body refusal, zero-process refusal, replay refusal, spoof refusal, late-call refusal, and non-Team native parity. It does **not** prove the governed shell's positive external effect: the four spawn arms are unreachable because the shell fingerprint requires `human-admin`, no Admin resolver exists, and the leader dual-gate downgrades to the born-terminal ask when the bind-time token is absent.
   - This is pre-existing on master: `docs/plans/active/alpha4-permission-governance/alpha4-permission-governance-spec.md:153,308,520-529` states there is no production Human Admin resolver and an unresolved `human-admin` leg terminates synchronously. PR3 did not introduce that authority requirement or weaken refusal behavior.
   - **Required minimal addition:** add a named follow-up C2 fixture at the public seam (test-only Control/Admin resolver or equivalent explicit bind-time authorization fixture) that supplies an authorized approval for one governed shell call in the World, then records the real marker/disk effect, exactly-once consume, and settlement. This can be done without product semantic changes; it must not weaken the production no-Admin fail-closed law. Until that receipt exists, CA-02/ARC-B is incomplete.

No other blocking code or security findings were found in this round.

## Production/code conclusions

- Guard arming is production-first and fail-closed: `packages/runtime/src/plugin/live/agent-bindings.mjs:2449-2535` installs the guard before Team tool placement; setup rejects if arming fails.
- The dispatch gate verifies the live definition before `next()`, refuses a missing/mismatched kernel-table identity before Body, and vetoes a successful settle after drift: `packages/runtime/tool-dispatch/install.ts:973-1028,1054-1094`.
- The enforcing kernel receives the real dispatcher lifecycle port (`a5p1Guard.pendingCalls().length`) and has no self-count fallback: `packages/runtime/src/plugin/live/agent-bindings.mjs:2707-2715`; assembly failure is typed `PLANE_KERNEL_UNAVAILABLE`: `packages/runtime/src/plugin/live/team-tool-plane.mjs:1794-1833`.
- A governed shell row is registered through the closed contribution schema; registration/kernel/mount failures do not restore the retired center path: `packages/runtime/src/plugin/live/team-tool-plane.mjs:1724-1787,2066-2083`.
- Non-Team native bash remains native when no governed plane exists, while a governed native `bash` takeover has a pre-body table refusal: `packages/runtime/test/u6-pr3-bl01-ask-door.test.ts:129-179`.
- `scopeKey` is used for the kernel approval table and mount feed; approvals bind family, registration generation, and source digest, with revoke/re-register invalidation and one-shot consume reservation/burn: `packages/runtime/governance-center/kernel.ts:247-349,352-393,431-523`; the shared mount uses one kernel and one scope for read + process families: `packages/runtime/src/plugin/live/team-tool-plane.mjs:1724-1864,1877-1926`.
- ARC-B structural proof is substantive: one mounted kernel owns both names/family entries, and the read/bash refusal trace is byte-equal: `packages/runtime/test/u6-pr3-kernel-flow.test.ts:93-124,145-250`. The production assembly is the same `centerKernel` object for both registrations.
- The center-interface change is minimal: `canonicalizeShellOperation` delegates projection to `normalizeShellProjection`, while the authority still resolves the workdir and computes the fingerprint: `packages/runtime/operation-permission/canonical-operation.ts:619-658`. The recorded 299-vector corpus is broad and master output is recorded pre-move: `packages/runtime/test/u6-pr3-golden-corpus.mts:7-25,43-125`; `packages/runtime/test/u6-pr3-shell-golden-vectors.test.ts:26-81`.
- The old bash backend implementation is moved to the process family and the center no longer places its shell arm; BL-01 is re-tested at the production seam: `packages/runtime/src/plugin/live/team-tool-plane.mjs:1583-1613`; `packages/runtime/test/u6-pr3-bl01-ask-door.test.ts:99-126`.

## Disclosed changes / carried risks

- Assembly-injected transport preserves the dormancy law: the process family receives the reviewed row factory from the assembly, rather than importing/activating the dormant a5p5 lane (`packages/runtime/src/plugin/live/team-tool-plane.mjs:1592-1605`; PR3 evidence README lines 44-49).
- The a3p3 source cache changes scan performance only; regexes and census teeth remain unchanged, and the targeted census suite passed. It should remain covered by existing planted-counterexample tests.
- The `readdirSync` marker-channel fix is a genuine oracle repair: PR2's `spoofBodyMarkers: []` was blind; PR3's rerun observes the real marker directory and leaves verdicts unchanged (`dev/agent-workflow/evidence/u6-pr3-20261026/README.md:81-86`). This affects confidence in the PR2 oracle, not the PR2 merged safety verdict: it removed a false-negative measurement path and the rerun remained PASS.
- Existing disclosed risks remain carried: G3 `other-world-unaffected` gap, and C2's lack of a positive governed-shell effect until the named fixture/follow-up is run.
