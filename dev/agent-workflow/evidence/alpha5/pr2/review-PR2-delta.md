# Review-DELTA — Alpha.5 PR2 review round 1 fixes (`bb8b91b5..af3e046b`)

- **Reviewer**: independent (same reviewer as round 1, ≠ implementer). Model column: `qwen3.8-flash-next`. Harness (separate): `DeepSeek Harness`.
- **Object**: `af3e046b` (3 commits: `ef018877` fix, `c429ec0e` evidence refresh, `af3e046b` docs). Round-1 review commit `bb8b91b5` is an **ancestor** — verified, so the branch was not rewritten and nothing was force-pushed.
- **Code delta reviewed**: `packages/runtime/tool-admission/admission-kernel.ts` (+26), `a5p2-admission-kernel.test.ts` (+36), `a5p2-approval-case.test.ts` (+48), rebuilt `dist/packages/runtime/tool-admission/admission-kernel.js`, lane README. Everything else in the range is evidence/docs.
- **三值**: `PASS` / `可裁` / `FAIL`.

## 0. Verdict

**补充内容** — and the supplement is documentation only. **The F-1 defect I failed in round 1 is closed in code and independently verified here; nothing in the code delta is open.** Two things keep this from `通过`: the F-3 attribution the writer (and the relay to me) said was accepted is **not in the tree**, and the commit that says it landed contains no such edit — see D-1.

## 1. The fix, read before it was run

`admission-kernel.ts:361-384` — inside `issueApprovedGrant`, after the H1 clock gate, identity and assurance legs, and **before** `verifyEffectSetApproval` and any mint:

```
expectedCaseId = toolAskApprovalCaseId({ teamSessionId: request.member.teamSessionId,
  instanceId: request.member.instanceId, effectSetFingerprint: request.requestedEffects.fingerprint,
  authorityGeneration: approval.authorityGenerationAtCreation })
approval.approvalCaseId !== expectedCaseId → APPROVAL_STALE, details.refusal = 'approval-case-identity-mismatch'
```

That is option (i) from round 1, and it is the right shape: the identity is recomputed from the **request's own** member (the leg `verify` could not see) at the **generation the presentation claims** (so a self-consistent old-generation case still reaches `verify`'s stale leg instead of being mis-labelled), and the fingerprint/generation legs inside `verify` stay as defense-in-depth for the presentation's own claim-set. `toolAskApprovalCaseId` is imported, not re-spelled (`admission-kernel.ts:78`) — no second identity formula. README states it (`## One ApprovalCase…` → "Presentation trust (review F-1, closed)").

## 2. D-1…D-4 findings and checks

| # | severity | evidence | verdict |
| --- | --- | --- | --- |
| **D-1** | MINOR (was F-3, **still open**) | Commit `af3e046b`'s message says it accepted the F-3 attribution ("'green again at head, cause not established'") and recorded the Alpha.4 observation. `git show --stat af3e046b` = **one file, `README.md`, +8 lines, all of it the F-1 presentation-trust paragraph**. At `af3e046b`: `s12-delivery-map.md:88` still reads "…after this branch rebuilt the committed runtime dist the leg measures itself green", `runs/.pr-body.md:47` still reads "self-greened after the committed-dist rebuild", the string `cause not established` exists nowhere in `dev/` except this reviewer's round-1 file, and the Alpha.4 hard-envelope observation is recorded nowhere in the PR. The falsified causal claim is therefore still standing in the evidence the user reads, and the log line asserts an edit the commit does not contain. Close = a two-line docs edit (`s12-delivery-map.md` §(e) row + `.pr-body.md` gates row) — no code change. | **FAIL (docs only)** |
| **D-2** | 可裁 (precision) | `a5p2-approval-case.test.ts:287-333` is labelled "the A3-2 coverage half-leg IN ISOLATION". The arm that actually emits the refusal is the **documents-derived ceiling-walk** arm — `approval-case.ts:315`, message `effect 0 (read) is undetermined at execution time …` (probe-printed verbatim) — not the `grantCeiling` coverage arm at `approval-case.ts:333-344`, which no test in the tree exercises. The test's own assertions are correct and non-vacuous (`not.toContain('may not review')`, `not.toContain('required rung rose')`, and the same presentation + documents returning `ok` once only the containment seam is supplied — so it does isolate "coverage undecided" from "reviewer position", and it pins an arm that was unpinned before). But the writer's stronger claim — that the DECIDED-not-allow coverage arm is unreachable while one `documents` input feeds both half-legs — rests on a ~1080-input probe that was deliberately not kept, so it had no anchor in the repo. **This review supplies the anchor**: my own sweep (3 effect sets × 101 document families incl. exact/subtree × 3 containment-seam variants × 4 reviewers × 4 claimed creation rungs = **14,544 inputs**) fired the arms `mayReview@creation 5859`, `ACCEPTED 5651`, `rung-escalated 1882`, `walk-undetermined 1152`, and **the `grantCeiling` coverage arm: 0**. The claim holds. Fix the comment to name the emitting arm and to state `:333-344` as documented-unreachable-by-monotonicity rather than "isolated". | 可裁 |
| **D-3** | PASS (wiring instruction worth one README line) | The frozen PR0 `requires-approval` arm carries only `kind, requestedEffects, reason` (probe-printed) — the canonical case id reaches the host via `kernel.planApproval()` (`admission-kernel.ts:125`) or the `admission-requires-approval` observe event, not on the arm. With F-1 now enforced, a PR3 host that presents anything else is refused **closed**, with the expected id in the refusal message (observed: `details.expected` contains the victim instance id). Good failure mode; PR3 must take the id from `planApproval`. | PASS |
| **D-4** | 可裁 (unchanged from round 1) | F-5 (empty `requiredAssurance` reader) is now README-bookkept (`README.md:73-80`) and deferred to PR3 with the right framing ("harness property, not the law"). The §5 erratum items and the PR1r `NOT FROZEN` hold are untouched, as they should be. | 可裁 (recorded) |

## 3. F-1 verified against the lane (parent's five requirements)

All five below were executed as throwaway specs against `af3e046b` and deleted after the run; nothing was committed.

1. **Round-1 probe replayed (must now refuse)** — member `inst-A`'s legal presentation issued for member `inst-B`'s identical call at the same generation: `refused APPROVAL_STALE / approval-case-identity-mismatch`. Round 1 returned `ok` and minted. **Closed.**
2. **Forged case id** — correct member, `approvalCaseId: 'tadm-case-1'`: refused on the same leg with **zero mint side effects** (`registrations = 0`, port `sequence = []`). A presentation that lies about its generation (`id@g1`, `authorityGenerationAtCreation: 2`) is refused on the same leg rather than silently re-derived.
3. **No blanket refusal** — honest round trip on the default policy: `admit` → `requires-approval`, observed plan case id **equals** the canonical recomputation; `issueApprovedGrant` with that presentation → **ISSUED**, `consumeForExecution` → **spent-once** (`registrations = 1`), and replaying the same grant → `grant-consumed` (`APPROVAL_STALE`). Honest approvals still work end to end.
4. **Semantics not shadowed** — a genuinely stale generation still refuses on its own leg (`TOOL_BINDING_UNVERIFIED / authority-generation-drift`), and the lane's existing stale/fingerprint/coverage arms keep their messages; the new leg fires only on identity mismatch.
5. **RED-first for the fix is honest** — `runs/red-F1-foreign-member.log`: `2 failed | 21 passed` with both new tests red pre-fix (`AssertionError: expected true to be false`, i.e. the foreign/forged presentation minted), then `23 passed`. The two red lines are the pre-fix originals, not a re-labelled green run.

## 4. Regression surface (independently re-run at `af3e046b`)

| check | result |
| --- | --- |
| lane, 6 specs | `6 files / 76 passed` (was 73; +3 new) — matches `runs/a5p2-green-targeted.log` |
| `a5p0-layer-audit` + `a3p3-governance-lane-hygiene` | `4 + 21` green (consumer set still 9 files; per-symbol SURFACE rows unchanged) → the log's "8 files 101/101" reconciles: 76 + 4 + 21 |
| `p4t6` scanner tie | 10/10 green; still `1073 → 1087` — the fix added no file under `packages/`, so the pin needed no re-tie (correct, not stale) |
| `scripts/audit-a5-tool-governance-imports.mjs` | `OK … 9 consumer file(s)`, 12 lane files, 44 edges, no cycles |
| `pnpm -r run typecheck` | **exit 0**, 9 packages Done |
| committed `dist` | `tsc -p tsconfig.build.json` rebuild reproduces the committed `admission-kernel.js` **byte-identically** (only `.map` `sources` paths differ, an artifact of my outDir) — the dist in the commit is the build of this source |
| full-suite fail-set at the new head | recomputed from the raw captures: `after 21 failed / 6728 passed (6749)` vs `base 22 failed / 6651 passed`; **`only_in_after = ∅`**, `only_in_base = 1` (the a4p7 leg); `+3` passing = exactly the 3 new tests. `failing-identities-after.txt` (21 lines) still matches the new log's 21 identities |
| evidence hashes | `sha256sum -c identity-hash-manifest.md` → 27 OK, **no FAILED** (the manifest was refreshed for the changed lane file: `admission-kernel.ts` = `91bc32ea…`) |
| branch integrity | `bb8b91b5` is an ancestor of `af3e046b`; no force-push; docs tip `7a2998bb` verified docs-only in round 1 |

## 5. What must still happen before merge

1. **D-1**: actually apply the F-3 reword in `s12-delivery-map.md` §(e) and `runs/.pr-body.md` (the sentence this reviewer can defend: *"build-state leg of another instrument, green again at head, cause not established; no PR2 code path under it"*), and either record the Alpha.4 hard-envelope observation or drop the claim that it was recorded. Docs-only, two lines, and it also corrects the round-1 log line.
2. **D-2**: name the emitting arm in the F-2 test comment (and keep `approval-case.ts:333-344` labelled as monotonicity-unreachable defense-in-depth). This reviewer's 14,544-input sweep stands behind that claim if the writer wants a citable anchor.

Neither changes code, H1/H2, the one-shot edge, the §5 erratum items, or the PR1r freeze-hold. With (1) landed this line reads `通过`; without it the evidence still contains a falsified causal claim plus a log line that says otherwise, and that is precisely the drift class this repository built `lint-identities`/`fail-set` to catch.
