# Dispatch brief — §7.5 deletion lane (`leaderEnvelopeCoverage`)

**Subject.** Delete the leader-envelope coverage aggregate and everything that exists only to serve
it, and prove that deleting it **newly allows nothing**:

- `packages/runtime/governance/permission-mutation.ts` — `leaderEnvelopeCoverage` at `:1419`, its call
  site at `:1390`, its refusal text, and the round-5 comment that explains why it was added.
- Every name and leg that survives only because the aggregate exists (the round-23 census listed
  **40 names / 39 legs**; re-derive it, do not inherit it).

**Base.** `master` immediately after the fail-closed merge (the SHA is in your dispatch message).
Merge `master` INTO your branch; **never rebase** a cited head. One task = one branch = one
worktree = one writer; **writes stay inside your own worktree, never an absolute path into the main
workspace** (two lanes have now leaked into it — one wrote evidence files there, one wrote a scratch
clone; both made the coordinator's own porcelain and lint untrustworthy for a round).

## The one question, and the direction it points

This aggregate is a **coverage requirement**: it can only ever *refuse*. So the risk of deleting it
is **not** that something newly refuses — it is that **something that used to be refused now
commits**. Your primary instrument is therefore a **widening witness**, not a red count:

> **STOP condition.** Any drive that was refused before the deletion and **commits** after it is a
> permission widening. Stop, report the leg identity and a construction-level repro, and do not
> "fix" it by adjusting the fixture. The expectation is zero new widenings — but that expectation is
> **the thing under test**, not a licence to treat a widening as noise.

Expect-and-check the inverse too: newly-refusing shipped behaviour should be 0 (production injects
the ceiling port at `host.ts:2703`; the fail-closed law already owns the no-port path). If shipped
behaviour newly refuses anything, that is also a STOP.

## Re-measure the premise before you touch code

The round-23 mutation experiment concluded **"deleting `leaderEnvelopeCoverage` widens permissions"**.
That was measured on the **pre-flip, pre-width-fix, pre-fail-closed** corpus. Three things have since
landed: the ceiling is asked at the width the mutation claims (`20230014`, `d6352de2` — `service.ts`
asks at `region.mutationMatcher` / the point set), the v3-only flip, and the fail-closed law (a lane
with no `authorityCeiling` port refuses a rise; the pre-v3 `undefined` skip has **no route** through
the shipped composition, pinned by R1–R4 with `undefinedAnswers === 0`).

**Task 1 is therefore measurement, not code:** repeat that mutation experiment on the current base
and report the verdict. If it still widens, the answer is a finding and §7.5 bullet 2 stays blocked —
**blocked-with-evidence is a complete deliverable**, and it is the correct one.

## Disposition bill

Every surviving reference gets one of three dispositions, per name, with a reason:
**DELETED** (with it), **RETARGETED** (the law it pinned still holds; the leg now speaks through the
mechanism that replaced the aggregate), **KEPT** (name the reason it survives a deletion). Three legs
were re-scoped by the fail-closed lane (`X1/X2/X3` with twins `X1p/X2p/X3p`) — check whether the twins
now carry the double.

## Rules you are bound by (all earned the hard way)

1. **Census: nine roots, roots named.** `packages/{contracts,domain,legacy,remote,runtime,storage,testkit,tools,client}/test`.
   Baseline = `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2162f6a7.md`
   (500 files / 6262 legs / **19 titled reds** / 3 collection files). Compare **identity sets**, never
   counts — the count moves with load (19/20/21 seen on near-identical trees), the set does not.
   **`NEW 0` is the merge condition.** A leg that "resolves" into a collection error is an
   **escalation**, not a fix.
2. **Pins by construction, not by text.** A regex pin over a deleted function is worth nothing; a
   mutant that re-adds a permissive arm and finds no leg redden is worth everything. Show the
   counterfactual: **re-introduce** the widening the deletion is claimed to prevent and name the leg
   that goes red. Retire, in the commit that falsifies them, any pin the deletion makes false.
3. **Repairs at the seam, never at the assertion.** `grep -c 'expect('` per touched test file must not
   move; if you legitimately remove an assertion because the law it tested is gone, say so in the
   record rather than hiding it behind the count.
4. **Bite proofs by blob.** Mutate one thing at a time, restore, and verify with
   `git hash-object` against `HEAD:path` — never by exit code.
5. **Fence after `git add`**, byte-identical in shape to `dirty(6,15) unknown(0,0) advisory(6,8)
   refused(52,115) prose(5,5) adjudicated(16,24)`.
6. **Artifacts.** If you touch a build input: `pnpm build && pnpm build:composition`, commit the
   rebuilt surface in the same commit, and require `pnpm check:artifacts:head` → `verdict=ok …
   drift=0`. `check:artifacts` alone does **not** prove freshness and must not be quoted as if it did.
   A missing `DSH-ARTIFACT-VERDICT` token is `refused`; `not-run` is never a pass.
7. **`p4t6` total is derived, never typed** — the referee is
   `node -e "import('./packages/testkit/fault-injection/session-event-scan.mjs').then(m=>console.log(m.scanSessionEventVocabulary({}).filesScanned)))"`,
   and any new path you add must be NAMED in its path set (the tie is asserted in-suite).
8. **Flags.** `pnpm --no-bail -r run typecheck` (not `-r run typecheck --no-bail`, which hands the
   flag to `tsc` and manufactures four `TS5023`s). `node scripts/lint-identities.mjs --diff <baseline>`
   (`--baseline` is not an argument; the instrument fails closed).
9. **Landmines from the previous lane (F-8…F-12), all live:** a declared ceiling is a **cell set**,
   never `any` (`matcherCovers` has no `any` arm); an **empty context carrier** is a second, narrower
   ceiling; approval-wired fixtures answer refusals through the durable **ask**, which needs the
   team-root binding row; **directory-renaming tests are synchronisation primitives**; a
   `STACK_TRACE_ERROR` red means a timeout — read `assertionResults[].duration`.
10. **Do not fix the merge-gate/`dist.held-by-7-6-gate` coupling in this lane.** The victim was fixed
    by family-skip; the actor (a gate that renames shared in-tree paths during a concurrent
    population run) is a separate named item. Touching it here would mix a §7.5 deletion with a §7.6
    instrumentation change.
11. **Never direct-push `master`** — a `pre-push` hook refuses it for everyone including me. Push your
    branch, hand it back, and I merge through a PR.

**Deliverables:** `FINDINGS.md` (the mutation verdict first), `leg-bill.md` (per-name dispositions),
`REPAIRS.md` if anything was retargeted, `FINAL-BATTERY.txt`, `HANDOFF.md` graded against the §7.5
bullets, and identity captures. Runs that were dirty are published, not edited down.
