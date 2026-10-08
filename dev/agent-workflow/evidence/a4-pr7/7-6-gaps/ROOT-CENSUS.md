# §7.6 gap lane — nine-root census on the final tree, and the identity-set diff

**Lane:** A4-PR7 §7.6 gap lane (`feat/a4-76-scenario-gaps`) · **worktree:** `.worktrees/a4-76-scenario-gaps` ·
**base / HEAD:** `master @ 16022365` (the branch adds files; it commits nothing else to `packages/**` at census time) ·
**census tree state:** 5 porcelain entries at capture time — the three new specs, the `p4t6` edit, and this
evidence directory. Nothing else.

Established form = [`population-baseline/nine-root-2162f6a7.md`](../population-baseline/nine-root-2162f6a7.md),
re-confirmed there at `2f06bb44`: **502 files / 6277 legs / 19 titled reds / 3 collection files**, compared as
**identity sets**, never as counts ("the titled-red COUNT moves with load … the set does not").

## 0. Fresh-worktree prerequisite, before any census (closure finding F5)

`packages/client/dist` is gitignored, so a census taken before a build silently measures a smaller client
root. Both commands ran **first**, exit 0, logs in [`scratch/`](scratch/):

```
$ pnpm install --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store   # scratch/pnpm-install.log
$ pnpm setup                                                                   # scratch/pnpm-setup.log
$ head -2 scratch/pnpm-setup.log
$ pnpm build && pnpm build:composition          # <- what `pnpm setup` actually runs
$ pnpm -r run build
Scope: 9 of 10 workspace projects
```

Presence after that, MEASURED on this worktree rather than assumed: `packages/client/dist` carries **400
files**, and the composition entry `packages/client/dist/packages/client/src/plugin/client.js` is present —
which is the artifact the merge gate's composition-smoke leg asks for, and that leg passed
(`FINAL-BATTERY.txt` §3).

Both census captures below report **0 files under any `dist/` path** in the JSON report, i.e. the run
measured sources, and the client root contributed its full 27 files / 482 legs in both.

## 1. The census, captured twice, strictly sequentially

One root `vitest run` each (root `vitest.config.ts` = the nine roots **contracts domain legacy remote
runtime storage testkit tools client**). Sequential on purpose: an overlapped pair on the sibling
`7-6-closure` lane produced a discarded capture, so [`scratch/final-census.sh`](scratch/final-census.sh)
runs the two in one loop and diffs them before anything else reads them. No other vitest ran concurrently
with either capture; the mutants were verified, so the tree held the committed sources throughout.

| capture | start (Z) | end (Z) | files | legs | titled red | ids (`scripts/fail-set.mjs capture`) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 07:57:40 | 07:59:14 | **505** | **6285** | 19 | 22 |
| 2 | 07:59:14 | 08:00:47 | **505** | **6285** | 21 | 24 |

The corpus moved exactly as this lane adds files and legs: **502 → 505 files (+3)** and
**6277 → 6285 legs (+8)** — three specs, 3 + 2 + 3 legs. Every added leg is named in
[`LEGS.md`](LEGS.md) and was confirmed registered in the capture itself (§4).

### Per-root shape (capture 1 / capture 2)

| root | files | legs | titled red 1 | titled red 2 |
| --- | --- | --- | --- | --- |
| runtime | 353 | 4010 | 8 | 10 |
| client | 27 | 482 | 0 | 0 |
| testkit | 29 | 372 | 0 | 0 |
| storage | 23 | 287 | 0 | 0 |
| domain | 26 | 523 | 10 | 10 |
| contracts | 13 | 150 | 0 | 0 |
| remote | 15 | 232 | 0 | 0 |
| legacy | 7 | 100 | 0 | 0 |
| tools | 12 | 129 | 1 | 1 |
| **total** | **505** | **6285** | **19** | **21** |

## 2. The diff, drawn as identity sets

```
identity-set diff vs the published nine-root baseline
(baseline file: 7-6-closure/scratch/baseline-2162f6a7.ids.txt = the 19 titled reds + 3 collection files published in population-baseline/nine-root-2162f6a7.md)

### capture 1 vs baseline:
[fail-set] baseline=22 current=22 NEW=0 FIXED=0
[fail-set exit 0  (0 = no new identity)]

### capture 2 vs baseline:
NEW  TEST packages/runtime/test/p6t1-parallel.test.ts::P6-T1 P1: N=2 same-template parallel activations both succeed two COMMITTED operations, two members, two distinct child Sessions
NEW  TEST packages/runtime/test/p6t1-parallel.test.ts::P6-T1 P1: N=2 same-template parallel activations both succeed two activated results with distinct instance ids and child Sessions
[fail-set] baseline=22 current=24 NEW=2 FIXED=0
[fail-set exit 1  (0 = no new identity)]

### the three new legs, as REGISTERED in capture 1 (registry query, not transcription):
  [passed] runtime/test/a4p7-descendant-change-proposal-valid.test.ts > a4p7 §7.6 row 6 — same canonical subtree root, descendants changed (spec §6.3 / §21.3, ADR §8) > a descendant the seam newly reaches that moves NO approved rise leaves the allowed proposal VALID: same case, byte-identical frozen fingerprint, one commit
  [passed] runtime/test/a4p7-descendant-change-proposal-valid.test.ts > a4p7 §7.6 row 6 — same canonical subtree root, descendants changed (spec §6.3 / §21.3, ADR §8) > the boundary: the SAME descendant arriving where it moves an approved rise answers mutation-stale with ZERO writes (one variable separates the halves)
  [passed] runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts > a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5) > a warning observed and acknowledged on a real durable ledger is reproduced by a store opened over the same directory: same warning identity and fingerprint, same folded count/time, same acknowledgement — from rows that were never rewritten
  [passed] runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts > a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5) > the reconstructed acknowledgement is bound to its fingerprint: after the restart, drift in the bound documents mints a NEW un-acknowledged warning that re-blocks
  [passed] runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts > a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5) > the production projection reconstructs over a ledger that carries the warning family (the a4pr0a composition law applies to these fact types too)
  [passed] runtime/test/a4p7-live-descendant-authority.test.ts > a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4) > the subtree granted before the resource exists covers the resource created after startup at the FIRST ask, while the MemberInstance created after the grants still inherits nothing
  [passed] runtime/test/a4p7-live-descendant-authority.test.ts > a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4) > the prohibition, in the form a leg CAN assert: zero containment work through Team startup, the relation computed per ask for the pair asked about at a cost that does not follow the descendant population, a durable row that never moves, and a verdict that follows the live canonical relation
  [passed] runtime/test/a4p7-live-descendant-authority.test.ts > a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4) > the mechanism: the shipped authority lane reaches no directory-listing primitive at all (the tool a startup enumeration would need)
```

**Capture 1 is IDENTICAL to the published nine-root baseline: NEW 0, FIXED 0.** Capture 2 adds two
identities, both in `packages/runtime/test/p6t1-parallel.test.ts` — the flake family the baseline itself
names ("the p6t1-parallel family", 19/20/21 seen on near-identical trees). It is **not** this lane:

```
$ npx vitest run test/p6t1-parallel.test.ts --root packages/runtime        # at rest, nothing else running
[capture: scratch/captures/p6t1-parallel-at-rest.txt]
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

This lane touched no file that world loads. That is exactly why the comparison is a set and not a count:
the counts here are 19 then 21, and the identity SET differs only by the named flake.

## 3. The escalation check

A red that "resolves" into a collection error is an escalation, not a fix, so the three collection-error
files are named on both captures:

- capture 1: `runtime/test/p8s3b-result-effects.test.ts`, `runtime/test/t12a-b2-child-identity.test.ts`, `runtime/test/t12a-glue-handoff-ports.test.ts`
- capture 2: `runtime/test/p8s3b-result-effects.test.ts`, `runtime/test/t12a-b2-child-identity.test.ts`, `runtime/test/t12a-glue-handoff-ports.test.ts`

Identical to the baseline's three (`p8s3b-result-effects`, `t12a-b2-child-identity`,
`t12a-glue-handoff-ports`), unchanged in kind and in number; none of this lane's eight legs appears there,
and no baseline titled red disappeared into one.

## 4. The three new legs, as registered by the capture (a registry query, not a transcription)

```
### the three new legs, as REGISTERED in capture 1 (registry query, not transcription):
  [passed] runtime/test/a4p7-descendant-change-proposal-valid.test.ts > a4p7 §7.6 row 6 — same canonical subtree root, descendants changed (spec §6.3 / §21.3, ADR §8) > a descendant the seam newly reaches that moves NO approved rise leaves the allowed proposal VALID: same case, byte-identical frozen fingerprint, one commit
  [passed] runtime/test/a4p7-descendant-change-proposal-valid.test.ts > a4p7 §7.6 row 6 — same canonical subtree root, descendants changed (spec §6.3 / §21.3, ADR §8) > the boundary: the SAME descendant arriving where it moves an approved rise answers mutation-stale with ZERO writes (one variable separates the halves)
  [passed] runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts > a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5) > a warning observed and acknowledged on a real durable ledger is reproduced by a store opened over the same directory: same warning identity and fingerprint, same folded count/time, same acknowledgement — from rows that were never rewritten
  [passed] runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts > a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5) > the reconstructed acknowledgement is bound to its fingerprint: after the restart, drift in the bound documents mints a NEW un-acknowledged warning that re-blocks
  [passed] runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts > a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5) > the production projection reconstructs over a ledger that carries the warning family (the a4pr0a composition law applies to these fact types too)
  [passed] runtime/test/a4p7-live-descendant-authority.test.ts > a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4) > the subtree granted before the resource exists covers the resource created after startup at the FIRST ask, while the MemberInstance created after the grants still inherits nothing
  [passed] runtime/test/a4p7-live-descendant-authority.test.ts > a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4) > the prohibition, in the form a leg CAN assert: zero containment work through Team startup, the relation computed per ask for the pair asked about at a cost that does not follow the descendant population, a durable row that never moves, and a verdict that follows the live canonical relation
  [passed] runtime/test/a4p7-live-descendant-authority.test.ts > a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4) > the mechanism: the shipped authority lane reaches no directory-listing primitive at all (the tool a startup enumeration would need)
```

Eight legs, all `passed`, taken from `scratch/root-census-1.json` — i.e. they ran inside the root
census, in the same process pool as the corpus they are being added to, not only in an isolated
re-run of their own files.

## 5. What each command actually loads (so no claim is read broader than its instrument)

| command | loads | consequence |
| --- | --- | --- |
| `npx vitest run … --root packages/runtime` | the **runtime** root only | what this lane used while iterating; says nothing about the other eight roots. |
| root `vitest run` (this census) | the nine `packages/*/test` roots | **excludes the client `*.client.spec` lane**, which the merge gate runs separately and which passed there. |
| `pnpm --no-bail -r run typecheck` | every workspace package | all packages clean (see `FINAL-BATTERY.txt`); vitest alone would NOT have caught the type errors this lane did ship. |

Reproduced by: [`scratch/final-census.sh`](scratch/final-census.sh) (captures + id sets + their diff);
the diff command is in §2 above; the JSON reports are [`scratch/root-census-1.json`](scratch/root-census-1.json)
and [`scratch/root-census-2.json`](scratch/root-census-2.json).
