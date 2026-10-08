# §7.6 closure lane — findings (measurement process + gate-claim gaps)

Companion to [`SCENARIOS.md`](SCENARIOS.md) (scenario traceability) and
[`ROOT-CENSUS.md`](ROOT-CENSUS.md) (population + command equivalence). Everything below is a
measurement/process fact from this lane, not a source change: this lane modified no production source,
no `package.json`, and not `packages/testkit/test/a4p7-merge-gate.test.ts`.

## F1 — §7.6's merge-gate sentence names one file for nineteen obligations

`a4p7-v3-cutover-acceptance.test.ts` is green and real (70 legs), but its content is the version
cutover plus the shell-class ceiling: it discharges **row 1** of §7.6 and part of **row 4**. The other
seventeen scenario rows live in `a4p1-* … a4p7-a1-14-*`, `a3p3-*`, `a3p4-*`, `a2c7-*`, `a4a-*`,
`a4pr0-*`, `tools/c1-*`, `storage/p4t2-*`. Recommend the plan's §7.6 bullet name the **set** of suites
(or the acceptance suite grow into them); today a lane could satisfy the sentence literally while
nothing in that file touches escalation, mutation, warnings or intervention. Detail:
[`SCENARIOS.md` §0(b)](SCENARIOS.md).

## F2 — the plan sentence holds 18 items, not 17

Counting §7.6's semicolon list as written gives 18; splitting the pairs that carry opposite laws
(expansion no-match vs its approval counterpart, self-tighten vs self-expand) gives the 19 rows this
lane mapped. Recorded so "the seventeen scenarios" is not used as a checkable number.

## F3 — three PARTIALs, each with a named missing leg

| row | has legs for | no leg for |
| --- | --- | --- |
| 5 live descendant creation | per-decision containment, boolean-only matcher input, real `FileSystem.contains()` subtree coverage | creating a descendant **after** startup and asking about it; any assertion of the **no-startup-enumeration** prohibition |
| 6 root identity drift | root retarget ⇒ `mutation-stale` with zero writes; the proposal fingerprint binds matcher root **and** kind | the complementary half: same root + changed descendants ⇒ proposal **remains valid** |
| 17 restart reconstruction | cases, escalation chains, proposals, overlays, control rows, abandon marks, ledger projection — all reopened from durable stores | the PR6 **governance-warning** family: no suite that mints a warning ever reopens a store |

Searched-for strings and the negative results are written into each row rather than summarised away.

## F4 — the p4t6 scanned-file total is a property of the disk, not of the commit

The documented one-liner read **1136** at 06:45 Z and **1036** at 06:52 Z on the same commit: the
value moves with on-disk state left by runs. The canonical reading is the quiet-tree one (**1036**),
cross-checked by the p4t6 leg being green against its derived expectation at that moment. Any lane
quoting this total without a timestamp and a quiet-tree statement is quoting a coincidence.
Evidence + reproduction: [`transcripts/p4t6-derived-total.txt`](transcripts/p4t6-derived-total.txt),
`scratch/record-p4t6.sh`, `scratch/scan-list.mjs`.

## F5 — the merge-gate composition smoke leg depends on build state

In a fresh worktree the leg
`packages/testkit/test/a4p7-merge-gate.test.ts > … the composition smoke leg … is green …` fails with
`refused` because `packages/client/dist` is gitignored. After `pnpm build && pnpm build:composition`
it passes. So a §7.6 root census run without `pnpm setup` reports an extra red that is **not** an
Alpha.4 regression. Either the leg states its build prerequisite in its own failure text or the gate
sentence says "after `pnpm setup`". (This lane did not edit the leg; it is off-limits here.)

## F6 — two harness facts that cost this lane a discarded capture

1. **`ps` cannot see other processes here.** Every tool call runs in its own PID namespace
   (`bwrap --unshare-pid`), so `ps -ef | grep vitest` returns nothing even while a census from another
   call is running. The lane's one quarantined artifact —
   [`transcripts/root-census-attempt-overlapped-DISCARD.txt`](transcripts/root-census-attempt-overlapped-DISCARD.txt) —
   came from trusting exactly that check. Liveness must be judged from job ids and from whether the
   output file is still growing.
2. **A `cmd &` launched from a tool call dies with that call.** The first battery script appeared to
   stall after leg 2; it had been killed when its parent call ended. Long legs now run as harness
   background jobs (`scratch/final-battery-2.sh`).

## F7 — the client lane cannot be captured through its package script

`pnpm --filter @dsh-agent-team/client run test -- --reporter=json --outputFile.json=…` forwards the
literal `--`, so vitest registers no JSON reporter and **no file is written** while the suite still
runs and exits 1 — a silent no-capture. Working form:
`pnpm --filter @dsh-agent-team/client exec vitest run --reporter=default --reporter=json --outputFile.json=…`.
Recorded in [`transcripts/client-before-after-diff.txt`](transcripts/client-before-after-diff.txt).

## F8 — lint is red at base, and the gate leg is the identity diff, not the exit code

`pnpm run lint` exits 1 with **128 errors / 32 warnings** at `0e7004b6`, unchanged by this lane
(evidence-only files). The gate-comparable artifact is `node scripts/lint-identities.mjs --diff
dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`: this tree reports the same
**160 identity lines / 76 distinct** as the published reference, and the diff leg is in
[`transcripts/final-battery-legs-2.txt`](transcripts/final-battery-legs-2.txt).
