# Independent adversarial security review — PR #404 (round 2)

**Reviewed head:** `0bf4b746cd7cf4999c30c3ca9913a4e3e1b69da3` (frozen head)

**Verdict: PASS-WITH-FINDINGS. Merge recommendation: YES, with the findings below tracked as follow-up hardening.**

No Host was booted by this review; `:3080` and `~/.dsh` were not touched. The PR head was checked out in `.worktrees/rv2-404`; the report branch is based on `origin/master` in `.worktrees/rv2-404-out`.

## Round-1 findings

| Finding | Status | Independent reproduction / judgement |
|---|---|---|
| H-1 skill-root TOCTOU escape | **FIXED** | Re-ran the committed S9 swap test: `pnpm exec vitest run packages/runtime/test/u7f-inspect-family-c1.test.ts` = 34/34. The executor now resolves, snapshots, performs one `open(O_RDONLY|O_NOFOLLOW)`, calls `verifyOpenedHandle`, and reads with `handle.read` on that same verified fd. I added a scratch race test covering parent-directory replacement by an outside symlink, SKILL.md hardlink replacement, FIFO replacement, and growth after the stat snapshot; all four passed. Parent swap returned typed `exec-time-escape` with no outside content; hardlink returned typed refusal via identity drift; FIFO did not block; post-stat growth returned `skill-oversized` based on fd bytes. The executor contains no second path-based read/open after verification. The fs-family barrel change is one additive re-export only (`verifyOpenedHandle`); no fs behavior changed, and `packages/runtime/controlled-fs/**` is not in the protected-center diff. |
| B-1 vacuous mutation control | **FIXED** | E1 asserts each row's exact requested multiset including query's method-resource meta arm. X3 removes that exact arm and expects the vector to fail. The original deletion is therefore pinned RED rather than leaving the old suite green. |
| B-2 declared != requested | **FIXED** | `contribution-schema.ts` has closed `EFFECTS_KEYS = ['declared','kinds','targets']`; `$.effects.rows` is rejected as `UNKNOWN_FIELD` by the frozen closed reader. E2 checks per-row requested kinds are the declared union and union equality. A family-wide union cannot itself prevent a row requesting another already-declared kind, but E2's row table pins the three current rows (skill read+invoke; list/query meta+invoke), and X3 covers the meaningful omission. No current row can silently request `meta` or `read` outside its pinned table. |
| B-3 run records / provenance | **FIXED / ACCEPTABLE** | `run-record` is used by the repaired runner. The committed records have `overall` and `finishedAt`; boot 5 has `u7f:skill-load PASS`, `transcriptHasSkillContent:true`, and the host witness `governed-skill RAN name=u7f-demo-skill bytes=145`. The overall `FAIL` (3 PASS / 3 FAIL) is preserved and is not relabelled as delivery. `backfill-bindings.mjs` adds `bindings.teamSha`, `bindings.hostSha`, and a provenance note; it compares serialized `cases`, `overall`, and `finishedAt` before writing and refuses on change. `teamSha=292558f70` is consistent with the boot times (07:22/07:32Z, after the 06:50Z commit) and the note discloses the dirty, uncommitted review fixes later committed as `edefd724f`; `hostSha` matches the asserted 0.2.0-rc.2 pin. This is a verdict-preserving, disclosed backfill, not provenance fabrication. |
| M-1 unsupported schema keywords | **FIXED** | `validateInputSubset` scans all object keys before type dispatch and refuses unsupported keywords before host dispatch. Independently tried `anyOf`, `allOf`, `not`, `$ref`, `if`, `then`, `else`, and `minLength`; each returned one validation problem. The committed M-1 vector covers pattern, oneOf, and omitted required input, and X4 restores the old silent-skip hole and turns the vector RED. |
| R1/R2 tool name and tokenKey orthogonality | **FIXED** | R1 asserts each tool-invoke arm contains exactly its own mounted alias and excludes native spellings. R2 confirms `exec.tokenKey` is used only as the PA callId correlation and never includes a tool name. A negative name substitution cannot satisfy the row's exact arm in E1/R1; no name widening is present. |
| Live envelope fixture | **FIXED (fixture-only)** | `request-control` is present in both `teamEnvelope.allow` and the strict member entry in `c2/u7f-inspect-assembly.mjs`; no product or blueprint-schema file changed. The change is the minimum intersection needed for a member PA ask and adds no unrelated member capability. |

## Race table

| Race driven | Result | Evidence |
|---|---|---|
| Replace SKILL.md with outside symlink after identity probe | **PASS / refused** | S9, 34/34; no secret bytes; typed symlink/exec-time refusal. |
| Replace parent directory component with outside symlink between snapshot and open | **PASS / refused** | Scratch test; `verifyOpenedHandle` resolved fd outside anchor and returned `exec-time-escape`; no outside bytes. |
| Replace SKILL.md with hardlink to outside file | **PASS / refused** | Scratch test; `fstat` inode differed from snapshot and returned `exec-time-drift`; hardlinks are correctly rejected when they change identity. |
| Replace SKILL.md with FIFO | **PASS / no hang** | Scratch test completed within 500 ms with typed refusal; no blocking read. |
| Grow file after size snapshot | **PASS / capped** | Scratch test replaced content after stat; fd metered cap+1 read returned `skill-oversized`; no truncation/late path read. |
| Read after verification through a second pathname | **PASS / absent** | Source inspection: only `handle.read(...)` occurs after `verifyOpenedHandle`; no `readFile` or second path open in executor. |

## Additional checks

- `pnpm exec vitest run packages/runtime/test/u7f-inspect-family-c1.test.ts`: **34/34 green**.
- Master evidence guard copied from `origin/master` and run against this head: `EB3-EVIDENCE-GUARD pass added=0 bound=1048576 exempted=0 findings=0`.
- Raw census capture check is empty for the requested `a4-pr7/ci-gate/scratch/census-*.json` pattern.
- Diff is clean for `team-tool-plane.mjs`, `family-assembly.mjs`, binder, and the 33 protected paths. The fs-family change is additive only.
- Hosted checks on the frozen head are all SUCCESS, including candidate-protection, census-runtime, PR gate, fast/integration/security/full, and required aggregator.

## New findings / residual risks

1. **Low/medium follow-up — union declaration remains structurally coarse.** The frozen contribution schema correctly rejects `effects.rows`, so the PR cannot add machine-readable per-row declarations without a schema change. E2 is an effective current-row pin and X3 is a useful mutation control, but future rows could request an already-declared kind unless the row table/test is updated. This is not a current merge blocker because all three existing rows are exact-pinned and no unexpected current request was found.
2. **Live positive coverage remains partial by design.** The committed boot-5 record is a real skill positive, but inspect-list, refusal-zero-effect, and approval-leg remain FAIL and overall remains FAIL. They are honestly disclosed and must not be counted as delivery evidence. This review does not treat them as a product security blocker because the lane's C1 tests and the evidence explicitly preserve the failed verdict; they remain a follow-up for live integration completion.

## COULD-NOT-VERIFY

- I did not boot a Host, per the explicit review prohibition, so I did not independently obtain a new live inspect-list success or durable approval resolution.
- I did not run the full repository suite; the focused C1 suite and targeted source/evidence checks were run.
- The backfill's commit-time dirty-tree fact is supported by its explicit note and timestamps/boot logs; an independent process snapshot from the original boot is unavailable, so this is accepted as disclosed provenance rather than re-measured.

## Final judgement

The two prior security blockers (path TOCTOU and unpinned effect/validator contracts) are fixed and independently reproduced. The additional filesystem races did not escape. The remaining concerns are documented follow-ups, not merge-blocking defects at the frozen head.
