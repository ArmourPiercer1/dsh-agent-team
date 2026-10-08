# A4-PR7 external review item D3-4 — the masked rejection claim, split, proven, un-exempted

Lane: `fix/a4-d3-4-rejection-test` (worktree `.worktrees/d3-4-rejection`, one writer).
Base at branch creation: `a187d7b0`; rebased onto `39ebe9a0` (master moved mid-lane, see §7).
CORE PATCH BUDGET spent: **0** — no product file is changed by this lane. `git diff --name-only
origin/master...HEAD -- packages/` lists exactly one file, and it is a test file.

---

## 1. The identity the reviewer meant (confirmed, not assumed)

From the tolerance list in
`dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md`:

```
TEST packages/runtime/test/d3-member-identity-context.test.ts::D3 the member identity context block (Team D1-D6 repair v2, B2) D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer; a foreign-root setup rejects without installing a block
```

The baseline document itself tagged it: *"1 (`D3-4`) is a must-not-stay-exempt whose only check is
unreachable at `:452`"*. The identity matches the reviewer's description (rejection behaviour for a
missing/invalid `rootSessionId`), so the target was taken as given — nothing had to be invented.

Its recorded failure (reproduced verbatim in `transcripts/00-baseline-before-split.txt`, same
AssertionError as the published run):

```
AssertionError: expected 'agent-bindings: capability template u…' to contain 'fail closed'
Expected: "fail closed"
Received: "agent-bindings: capability template unresolved for 'session-child-p6t2-w1'
          (reason=template-id-missing instanceId=inst-p6t2seedw01) (code: capability-template-unresolved)"
  at packages/runtime/test/d3-member-identity-context.test.ts:451:50
```

**What that masked.** The leg died at line 451, so line 452 never executed:

```
450  expect(foreignSetupError instanceof Error).toBe(true)
451  expect((foreignSetupError as Error).message).toContain('fail closed')   ← died here
452  expect(foreignCtxPersonaEntries.length).toBe(0)                          ← never ran
```

Line 452 is the actual claim of the whole probe: *a bind attempted under a root that does not own the
member installs no identity block*. Everything the leg asserted before it (the three tool-layer
rejections) was passing. So the exemption excused a leg that proved precisely the thing it was not
supposed to excuse, and stayed silent about the thing it existed to check.

## 2. Why the prose probe was wrong, not merely stale (so: no product defect found)

The probe is the real cold-member bind — `agentSetup(child, undefined, undefined, 'cold-member', root)`,
the argument shape the production cold path uses (`agent-bindings.mjs:3656`), reached through the glue's
exported `agentSetup` over the live world. Under the foreign root `N` there is no `MemberInstance` row
for the boot member's child session, and the fresh-create `templateIdHint` is deliberately **not** an
authorization fallback for a cold bind (P0-1 hardening §3.4, `locateTemplate`). So the refusal is raised
by the capability locate — one gate *before* the persona layer whose sentence the old assertion quoted.

The typed contract is what the neighbouring suite already pins in this style
(`mcp-blueprint-initial-grant.test.ts` D2: `toMatchObject({ code, reason })`). The claim is **supported
by the product**: it refuses, and (proven in §4) it installs nothing. Nothing was weakened and nothing
in the product needed to change; the test had drifted onto a message substring where the contract is a
typed code. The same file documents the identical drift for the tool-layer half (caller-root gate,
PR #20), and its header contract still named the pre-PR-#20 runtime codes — corrected in place.

## 3. The split

Same file, same world, same probe call; the leg was cut where its own title already cut it.

| leg | asserts | status |
| --- | --- | --- |
| `D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer (never status executed)` | the three tool-layer rejections, verbatim from the original leg | green |
| `D3-4b FAIL CLOSED (the setup-level half of D3-4, split out to execute): a committed member bound under a FOREIGN root rejects with the typed capability-template-unresolved error and installs no block, registers no tool` | typed rejection (`code`, `reason`, refused `instanceId`, message naming the refused session) **plus** the masked reads: no scoped persona section of any kind, no registered tool, the boot member's own installed block untouched and still naming its own root — with a positive control (the second root's member: one successful setup ⇒ exactly one block + team tools registered) | green |

`transcripts/06-leg-identities-after-split.txt` lists all six legs of the file with their exact
`TEST <path>::<fullName>` strings; `transcripts/01-after-split-green.txt` /
`transcripts/11-after-rebase-green.txt` are the runs. No assertion from the original leg was dropped:
the two that could not run are now the ones the new leg leads with.

## 4. Mutation control — the new leg was proven to bite

`transcripts/02-mutation-control.patch` is the temporary product change: the same fail-open defect at
both sites of the law it violates — a boot-root fallback standing in for the foreign root's missing row,
once in the capability locate and once in the persona install, **installing the block under the foreign
root**.

* `transcripts/03-mutation-RED.txt` — the shipped leg, unmodified, against the mutant:
  `AssertionError: expected false to be true` at the "the setup rejected" assertion (no error at all).
  **RED.**
* `transcripts/04-mutation-RED-all-reads-soft.txt` — same mutant, same reads evaluated with soft
  assertions so the whole picture shows, including the ones the old leg never reached:

  ```
  expected 1 to be +0                                  ← foreignCtxPersonaEntries.length  (the masked line)
  expected [ 'deployment:persona' ] to deeply equal [] ← a block WAS installed, under root N
  expected [ 'team_list_members', …(14) ] to deeply equal []   ← 15 tools registered on the refused bind
  ```
  plus the boot member's own block being disposed by the hijack. 9 red reads. So the masked assertion is
  not decoration: against a product that fails open it is the assertion that catches the stolen identity.
* Restore: `git checkout -- packages/runtime/src/plugin/live/agent-bindings.mjs`; `0` mutation markers
  left, `git status --porcelain -- packages/` empty.
  `transcripts/05-restored-GREEN.txt` (and `11` post-rebase): **6 passed (6)**. GREEN.

## 5. Census: the identity set moved one step, and only that step

One sequential nine-root capture, nothing else running (load 1.79 on 32 cores, no 3180-family host),
`CI=true`, private `XDG_CACHE_HOME`, `packages/testkit/test/.tmp-fault` removed first, pristine host
checkout linked (`tests/deepseek-harness-test-use` → the main checkout's copy; the link is untracked and
never staged). Report: `scratch/census-20261008T162525Z.json`; log:
`transcripts/09-census-vitest-20261008T162525Z.txt`.

```
Test Files  4 failed | 503 passed (507)
Tests       9 failed | 6346 passed (6355)
node scripts/fail-set.mjs capture … → captured 9 identities (9 failing tests, 0 collection-failing files)
node scripts/fail-set.mjs diff nine-root-94da4a69.ids.txt …
  → baseline=10 current=9 NEW=0 FIXED=1        [diff exit 0]
```

`FIXED` is exactly the retired D3-4 identity; `NEW=0` is the statement that nothing else in the other
506 files moved. `scratch/census-20261008T162525Z.ids.txt` is the 9-line set; it is published as
`../population-baseline/nine-root-post-d3-4-split.ids.txt`.

`transcripts/13-census-leg-regrade-against-updated-baseline.txt` is the decisive check, run through the
gate's own census code against the **updated** document:

```
DSH-CI-LEG leg=census verdict=pass … baseline … = 9 titled reds + 0 collection files;
  captured 507f/6355l vs baseline-declared 507 / 6355 … identity set IDENTICAL to the published baseline
DSH-CI-VERDICT pass pass=1 fail=0 skip=0 skipped=none legs=1 refused=0
```

`transcripts/10-selftest-RED-while-pin-stale.txt` is a free red control: after the document moved and
before the pin moved, `--self-test` failed on precisely the committed-baseline assertion — the pin does
guard the tolerance list in both directions. `transcripts/12-selftest-GREEN-after-pin.txt`:
`DSH-CI-SELFTEST pass 58 assertions`.

Provenance (`CENSUS-PROVENANCE.txt`): the capture graded `packages/` tree
`fef63f0651b71b62db92f717202392c1d7aeca00`; that is master's `6c652989e35d70da286f87f6e36276b4d20760b8`
plus exactly one changed file, and the post-rebase `HEAD:packages` is the same OID — so the measurement
transfers to the pushed branch by tree equality, which `git diff --name-only b9cc0a2d HEAD -- packages/`
(empty) re-checks.

## 6. The tolerance/exemption change (same commit as the document restatement)

* `nine-root-2162f6a7.md`: the D3-4 line is **removed** from `## titled reds` (10 → 9 tolerated
  identities); the section's machine-interface annotation is restated; the exact strings of the retired
  identity and of its two green successors are recorded **inside** that section, because a `#` line there
  is read by neither parser while prose outside it is mined for disclosures — pasting an identity string
  into prose would have granted that file an exemption.
* The READ-THIS-FIRST box and `## CURRENT CORPUS` are re-measured to 507 / 6355 / 9 / 0; a dated section
  records what was masked, the mutation control, and the set delta.
* Family surface re-measured, not narrated: the document still parses to exactly the two disclosures it
  disclosed before (`p6t1-parallel`, plus the tools-actions path the document's own
  WHY-THIS-FILE-EXISTS header has named since it was written) — this change grants nothing new.
* `scripts/ci-pr-gate.mjs`: the one committed-baseline assertion is re-derived from the parse (6354→6355,
  10→9). Assertion count unchanged at 58 — no pin was added to make a verdict easier, none removed.
* No new exemption anywhere; no fixture expectation edited to match live output; no failure labelled a
  flake.

## 7. Disclosed edges

1. **`--self-test` prints 58 assertions, not the 51 the brief quoted.** 58 is what `origin/master`
   (`a187d7b0`) printed before this lane touched anything; the brief's figure is stale. This lane neither
   added nor removed an assertion.
2. **Master moved during the lane** (`a187d7b0` → `39ebe9a0`, PR #213: the `state-freshness` leg). It
   changed no file under `packages/`, so the census population is unaffected; the lane rebased its single
   unpushed test commit onto the new tip (no merge, no force-push, nothing published before the rebase)
   and re-ran the file, the typecheck, the lint identities and the self-test after the rebase. It also
   touched `scripts/ci-pr-gate.mjs`, which this lane edits — expect a trivially resolvable conflict in
   the self-test region, and note that PR #213's own rule ("a mutable revision must not live in prose")
   is why this document's figures are all re-measured rather than narrated.
3. The pristine host is **linked**, not copied, into the worktree and shows as one untracked line in
   `git status` (the ignore rule carries a trailing slash, which a symlink does not match). Nothing was
   staged with `-A`; each commit lists its own files.
4. `dev/agent-workflow/SESSION_ROUTER_LOG.md` and `graph.yaml` were **not** touched: they are the
   coordinator's append-only state, and a lane writing them from a worktree is how round records get
   duplicated. The coordinator's log entry for this item should say: D3-4 repaired, exemption list 10 → 9,
   evidence `dev/agent-workflow/evidence/a4-pr7/d3-4-rejection/`.
5. **Coverage note, not a claim added here:** the persona layer's own fail-closed throw ("no committed
   MemberInstance row and no templateId hint (fail closed — no silent persona-less member)") has no test
   that reaches it — the cold-path refusal now happens one gate earlier. Reaching it would need a probe
   shape production never issues (an instance hint with no template hint), so this lane did not invent one
   to manufacture coverage. Recorded here so the absence is someone's decision, not an accident.

## 8. Reproduce

```bash
cd .worktrees/d3-4-rejection
export CI=true XDG_CACHE_HOME=$PWD/.tmp-xdg/cache
ln -s <main-checkout>/tests/deepseek-harness-test-use tests/deepseek-harness-test-use

pnpm exec vitest run packages/runtime/test/d3-member-identity-context.test.ts   # 6 passed

# mutation control: apply transcripts/02-mutation-control.patch, then
pnpm exec vitest run packages/runtime/test/d3-member-identity-context.test.ts -t 'D3-4b'   # RED
git checkout -- packages/runtime/src/plugin/live/agent-bindings.mjs                          # restore

rm -rf packages/testkit/test/.tmp-fault        # ONE sequential run, ~135 s wall / ~203 s test time
pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=<scratch>/census.json
node scripts/fail-set.mjs capture <scratch>/census.json --out <scratch>/census.ids.txt
node scripts/fail-set.mjs diff \
  dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-post-d3-4-split.ids.txt \
  <scratch>/census.ids.txt                                              # NEW=0, exit 0
node scripts/ci-pr-gate.mjs --only census --census-json <scratch>/census.json   # verdict=pass
node scripts/ci-pr-gate.mjs --self-test                                  # pass 58 assertions
```
