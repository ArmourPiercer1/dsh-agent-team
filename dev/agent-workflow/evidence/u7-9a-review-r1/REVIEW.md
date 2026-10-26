# U7-9a FS family adversarial review R1

## Verdict

**BLOCKED**

The family C1 implementation and the positive C2 write/edit legs are real, but the PR does not prove the required shipped-surface boundary and has a security-relevant effect-set mismatch for `read_image`. The three C2 `FAIL`/`DISCLOSED-UNDECIDED` cells are correctly not counted as PASS; they remain delivery gaps, not passes.

## Findings

### Blocker — `read_image` omits its declared attachment-store effect from the admitted effect set

- **File:line:** `packages/tools/fs-family/src/image-executor.mjs:150-153` (effect set); descriptor declares the second target at `packages/tools/fs-family/src/fs-family-contribution.mjs:170-180`.
- **What is wrong:** The contribution honestly declares `read_image` as both a realm-file read and an `attachment-store` write, but the executor sends the Kernel only `tool-invoke(read_image)` plus the realm-file `read` effect. The subsequent `attachments.saveImage(...)` at `image-executor.mjs:226-243` is therefore not represented in `requestedEffects`/the one-shot admission request. This violates the center architecture's CI-07 complete-effects requirement and the PR's claim that all effects go through the same kernel/ledger. A declaration in the Registry cannot substitute for the per-call requested effect set.
- **Evidence needed:** A C1/C2 receipt showing the `read_image` PA call/requested-effects fingerprint contains the attachment-store create/write target, and a negative control proving a grant lacking that target cannot commit an attachment. Until then, the row either under-authorizes the real side effect or the declared contribution is false.
- **Classification:** **Defect**, not merely a disclosure gap.

### Major — `str_replace_editor` OUT_OF_SCOPE claim is not supported by the repository's current authoritative matrix

- **File:line:** `dev/agent-workflow/evidence/u7-9a-fs-20261026/README.md:101-103` and PR body claim; contradicts `docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md:24,62`.
- **What is wrong:** The PR says M-04 is `NONE_SHIPPED` and therefore out of scope. The current matrix instead says `NOT_IMPLEMENTED`, with “Host 本体注册状态未亲读，**不等于 Host 未注册**”, and its appendix carries `str_replace_editor` as a candidate whose load condition is unverified. The repository also contains explicit prior evidence that editor/image native faces were observed (`dev/agent-workflow/evidence/alpha5/wiring/we2/runs/*/run-receipt.md`), and the current design says the FS family includes `str_replace_editor` only if the user/matrix says mounted. This is not proof of a shipped mount, but it is proof that “no shipped surface” is unproven and conflicts with the matrix's deliberately unresolved status.
- **Evidence needed:** A pinned-host, shipped-bundle/preset inventory and direct runtime registration receipt proving M-04 is absent from every shipped surface, or a user/matrix ruling explicitly excluding it. Otherwise the PR must retain M-04 as an unresolved obligation and cannot close the family scope by assertion.
- **Classification:** **Disclosure/acceptance gap** that blocks this PR's scope claim (not a product defect in the three implemented rows).

### Major — C2 refusal/image/native controls are not delivered and are correctly disclosed as non-PASS

- **File:line:** `dev/agent-workflow/evidence/u7-9a-fs-20261026/c2/run-4.json:72-103`; summary `README.md:55-75`.
- **What is wrong:** The final boot records `FAIL` for `fsm:refusal-zero-effect`, `fsm:image-lane-honest`, and `fsm:ctl-native-write` (no row refusal witness, silent image arm, native write sandbox denial). The PR body calls these “DISCLOSED-UNDECIDED/BLOCKED”, which is honest, but the subject requires verifying real symlink/escape/race refusals and the native parity control. C1 tests do not establish host C2 behavior. The evidence therefore cannot support a PASS verdict for the requested C2 obligations.
- **Evidence needed:** A host run where denied-path refusal is observed before body with a typed witness, a host `read_image` positive/refusal arm with an actual row witness, and a native-member write control run that is not sandbox-refused (or an approved ENV_BLOCK ruling that removes the parity obligation).
- **Classification:** **Disclosure gap / unproven gate**, not evidence laundering.

### Minor — golden evidence is recorded against an earlier branch head than the reviewed head

- **File:line:** `dev/agent-workflow/evidence/u7-9a-fs-20261026/golden-recording.txt:2,7-10`.
- **What is wrong:** The golden recording identifies branch HEAD `a0f3f610...`, while the reviewed branch and CA-01 certificate are later (`56a55c21...`). The targeted golden test passes on the reviewed tree, so this is not evidence of a detected parity defect; it is a provenance mismatch that weakens the disk claim unless the re-run is explicitly tied to the final commit.
- **Evidence needed:** A final-head golden receipt with the reviewed SHA, or a machine-checked statement that the later commits cannot alter the parser/corpus plus the final test log.
- **Classification:** **Disclosure gap**.

## What I VERIFIED

Commands and verbatim tails:

1. **Protected center byte identity**
   - Command: a Node script compared every path in `arc-a-protected-center.json` against `git show origin/master:<path>` and checked protected-set diff.
   - Verbatim tail: `checked=33 mismatches=0`
   - No protected-set diff was printed. This verifies the 33/33 byte-identical claim against `origin/master`; it does not by itself authorize a center interface change (none is present).

2. **Targeted C1 + golden tests**
   - Command: `pnpm exec vitest run packages/runtime/test/u7-9a-fs-mutation-c1.test.ts packages/runtime/test/u7-9a-mutation-golden-vectors.test.ts --config vitest.config.ts`
   - Verbatim tail:
     ```
      ✓ packages/runtime/test/u7-9a-fs-mutation-c1.test.ts (33 tests) 3282ms

      Test Files  2 passed (2)
      Tests  37 passed (37)
     ```
   - This verifies the in-process positive/refusal/replay/symlink test battery and the 1440-vector test as implemented; it is not host C2 proof.

3. **C2 status and non-counting discipline**
   - Command: read `c2/run-4.json` and `README.md` from disk.
   - Verbatim facts: `fsm:write-positive` = `PASS`; `fsm:edit-positive` = `PASS`; `fsm:refusal-zero-effect` = `FAIL`; `fsm:image-lane-honest` = `FAIL`; `fsm:ctl-native-write` = `FAIL`; `fsm:leak-check` = `PASS`.
   - I count only PASS rows as delivery. The three disclosed cells are not counted.

4. **Contribution/registry/one-kernel wiring**
   - Inspected `team-tool-plane.mjs` and `fs-family-contribution.mjs`: one `dsh.fs-family` contribution, `fs-read` + `fs-write` manifest capabilities, per-name approval entries, and one `consumeOnce` path are present in the reviewed assembly. This verifies the claimed shape statically, not a full host execution proof.

5. **Mutation safety controls**
   - Inspected and ran C1 tests covering outside-root, symlink-name and linked-directory escapes, unknown parameters, over-cap content, per-path serialization, replay, cancellation, and edit no-create behavior. These tests passed locally. No dynamic race/TOCTOU host refusal was independently established.

## What I could NOT verify

- The required C2 host refusal witness for an unnamed/denied target; the final run is `FAIL` with zero row witnesses.
- A host `read_image` positive/honest refusal arm; final run is silent/`FAIL`.
- Native non-Team write parity; the final run is sandbox-refused and marked `FAIL`.
- A credible repository-backed assertion that `str_replace_editor` is absent from every shipped bundle/preset; the current matrix explicitly retains it as `NOT_IMPLEMENTED`/unverified rather than `NONE_SHIPPED`.
- That `read_image` attachment-store creation is included in the per-call PA requested effect set; static inspection shows it is omitted.
- A final-head (56a55c21...) disk golden recording; the checked-in recording names a0f3f610... although the final targeted test passed.

## Review tree hygiene

No product files were modified by this review. The only review artifact is this directory and the targeted test log under `dev/agent-workflow/evidence/u7-9a-review-r1/`. Before final push, `packages/` and `tests/` are checked for a clean status.
