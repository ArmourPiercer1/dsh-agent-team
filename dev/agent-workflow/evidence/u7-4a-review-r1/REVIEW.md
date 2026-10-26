# PR #392 adversarial security review (U7-4a)

## Verdict

**PASS-WITH-FINDINGS**

The implementation has a credible same-kernel producer, pre-receipt attribution, owner-scoped management, honest cancel vocabulary, and no second approval ledger. However, the required mutation proof is incomplete: removing the pre-attribution `ensureRegistered()` call leaves the producer tests green. In addition, the committed primary C2 run record contains a `FAIL` for the live-kill leg; the 12/12 claim is true only after a separate re-judge artifact, not from the committed run record alone.

## Findings

### F-1 — major — no test catches attribution-before/without creating-lane registration

- **File:line:** `packages/runtime/src/plugin/live/jobs-background-producer.mjs:317-321`.
- **What is wrong:** The producer is required to call `ensureRegistered()` immediately before attribution and fail closed when no creating-lane definition exists. I mutation-removed that post-spawn `ensureRegistered()` call, leaving the earlier pre-spawn call intact. The required suite still passed **19/19**. Therefore the tests do not prove the post-authorization creating-lane check or its fail-closed behavior; a late/unregistered placement can be attributed if the earlier registration was valid and then the definition disappears.
- **Evidence needed:** A test that invalidates/removes the creating-lane definition after `JobRegistry.start` returns but before attribution, then asserts `background-attribution-refused`, cancellation, and zero model receipt. The mutation must fail.
- **Classification:** **Defect in test evidence / disclosure gap** (the production check exists, but the required mutation gate is unproven).

### F-2 — minor — committed primary run record is not 12/12

- **File:line:** `dev/agent-workflow/evidence/u7-4a-jobs-producer-20261026/u74a-main-4.u74a-run-record.json:147-167`.
- **What is wrong:** The committed run record marks `u74a:kill-live-requested` as `"verdict": "FAIL"`. The later `u74a-main-4.rejudged.json` marks it PASS. Thus the statement “committed RUN records verify 12/12 PASS” is inaccurate unless the re-judge is explicitly treated as the authoritative derived verdict and the original record is called a raw failed judgment. This is an evidence labeling/traceability issue, not a demonstrated runtime defect.
- **Evidence needed:** A committed manifest stating raw run verdicts versus re-judged verdicts, with the re-judge input digest and an explicit accepted final verdict. Do not describe the raw run record as 12/12.
- **Classification:** **Disclosure gap**.

## Protected-set audit

`git diff origin/master...HEAD --name-status` contains 52 paths. No files under `packages/runtime/governance-center/**`, `packages/runtime/tool-dispatch/**`, or `packages/runtime/tool-admission/**` are changed. No `packages/runtime/control/**`, `packages/runtime/src/plugin/live/pa-mount-registry.mjs`, or `packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs` changes occur. The only protected-center path changed is:

- `packages/runtime/src/plugin/live/agent-bindings.mjs` (wiring hunk around lines 2675–2710 and backend merge around 2808). This is covered by the added named U7-4a override in `dev/agent-workflow/ledgers/arc-a-protected-center.json`, booked SHA `03e74843356a2d5c7d66dea49d436ebd0219c17332e6a5779c944d3bc9c72dd3`.

The protected frozen values recompute exactly:

- `jobs-gateway-assembly.mjs`: `c99ecaadf2d34f8c313e539aee6ab9e247aad6e32b6087d29f12edaa08158b53`
- `pa-mount-registry.mjs`: `fa1d831d559d1016f6ee99e43436d3155b3f0c493a76fda021cc228f4c14510d`
- `jobs-family-bridge.mjs` lines 76–347: `71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f`

The other changed paths are family/producer, plane, dist placement, tests, harness, evidence, lint configuration, router log, and the override ledger; they are not in the protected center set.

## Security checks

- **Authorized receipt ordering:** Production order is kernel backend arm → `JobRegistry.start`/real host receipt → `ensureRegistered` → `attributeBackgroundJob` → model-visible receipt. Denied/replayed calls are blocked before the backend. C1 K5 asserts zero producer/registry/provider reach on deny; live K1 records server-side attribution before receipt.
- **No creating-lane definition:** Production calls `ensureRegistered()` before spawn and again before attribution, but F-1 shows the required mutation is not detected.
- **Receipt exposure:** Success receipt is returned only after attribution succeeds. Attribution refusal returns a typed refusal and closes the born job; no unattributed success receipt is returned.
- **Owner fence:** C1 uses `OWNER_A` versus `OWNER_F`; C2 uses owner session versus a separately mounted `inst-f`/foreign session. Foreign output is the measured `unattributed-job` refusal at this pin, with zero ring/status/kill vocabulary and no foreign host reach. This satisfies the zero-reach law even though the bridge does not expose the `owner-mismatch` word cross-mount.
- **Cancel/termination:** Producer and live evidence preserve request-form versus already-finished and report `TERMINATION-UNCONFIRMED` on kill fault. The raw run-record labeling issue is F-2.
- **One ledger:** New producer has zero imports and no approval map/store; attribution uses the existing gateway record while approvals remain kernel-owned.
- **Guard/no fallback:** `backgroundJobs` is closed and opt-in; absent config retains `background-not-supported` before probe/spawn. The creating-lane pin law (`names.bash === 'bash'`) is enforced in `team-tool-plane.mjs`, not merely documented. Native/non-Team control remains covered by K4 and the C2 native leg.
- **Replay:** Kernel one-shot/deny tests and K5 cover replay/refusal; no producer call occurs on denied ask.
- **CI-05:** Planted unattributed ids remain typed `unattributed-job` with zero reach.

## VERIFIED

- `sha256sum packages/runtime/src/plugin/live/jobs-gateway-assembly.mjs packages/runtime/src/plugin/live/pa-mount-registry.mjs; sed -n '76,347p' packages/runtime/src/plugin/live/jobs-family-bridge.mjs | sha256sum`  
  Tail: `c99ecaad...08158b53`, `fa1d831d...14510d`, `71705d6...a9b29f` (full values above).
- `pnpm vitest run packages/runtime/test/u74a-jobs-producer.test.ts --reporter=dot`  
  Tail: `Test Files 1 passed (1)` / `Tests 19 passed (19)`.
- Mutation: replace configured executor arm condition with `false && parsed.background === true`  
  Tail: `Tests 5 failed | 14 passed (19)` — this required producer-arm mutant is killed.
- Mutation: remove post-spawn `ensureRegistered()` immediately before attribution  
  Tail: `Test Files 1 passed (1)` / `Tests 19 passed (19)` — **mutant survives** (F-1).
- `git status --porcelain packages/ tests/` after restoring mutations  
  Tail: empty.
- Committed run record inspection (`u74a-main-4.u74a-run-record.json`)  
  Tail: raw `u74a:kill-live-requested` is `FAIL`; committed re-judge (`u74a-main-4.rejudged.json`) says `allPass: true`.

## COULD-NOT-VERIFY

- Did not boot a Host, touch port 3080, or use `~/.dsh`, per review rules.
- Did not perform a live mutation against the five-boot host evidence; C2 evidence was audited from committed records.
- Did not independently rerun the complete 5-boot C2 sequence (budget/evidence already consumed); relied on committed RUN records and re-judge.
- Did not run owner-fence mutation because the required mutation obligation was already falsified by F-1 and no product changes were permitted to remain.

## Boot accounting / evidence honesty

The committed evidence contains four main run records plus one plant run record, i.e. **5/5 boots**. The main raw record is not literally 12/12 because the kill-live case is marked FAIL; the derived re-judge records 12/12 main and 3/3 plant. This must be reported as “raw run + re-judge,” not as a raw 12/12 run.
