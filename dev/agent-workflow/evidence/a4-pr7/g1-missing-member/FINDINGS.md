# A4-PR7 G1 — a REQUIRED member the refused row does not state is damage, not a disagreement

Lane: `fix/a4-g1-missing-member` · worktree `.worktrees/g1-missing-member` · ONE commit on top of
base `origin/master @ de6823cc` (source + rebuilt install surface + tests + this evidence, as F1/W8 did);
the source sha256 below identifies the exact bytes this document describes
Review round folded in: the review of the first commit `b9eb27f0` asked for the `toolName` leg and for a pin on the
requirement probe; both are here (W13-j, W13-k + the fail-closed arm), with one premise of that review
corrected in §7.1. `W13-a…W13-i` are unchanged from the reviewed commit.
Sole-writer file: `packages/runtime/control/service.ts` · test home: `packages/tools/test/a4-corrupt-leg-guard.test.ts` (W-series)
Source sha256 before the fix: `c563b2941dc38ef72c482bff72490dc02964a5c64be2a644bc770b4d1f2a97be`
Source sha256 as committed: `be80155876d69db01cb4cfef2d3a20b15ab65c7632cfa7bc9bbab3be538b060a`
Test file sha256 as committed: `2b8f80f99e5e320d38834b614e31b1a23b52b12b1e8c32116f520634d27c3cde`

**The premise was confirmed, by run and not by reading.** G1 reproduces. Four of the twelve new legs are
red on `origin/master` and green after the fix; the other eight pin cells the fix must not move.

---

## 1. The defect, in one sentence

`corruptLegCouldGovern`'s `memberAgrees` answered *"this member is not in the row"* with
`expected.length === 0`, so for a member the reader **refuses to omit** — `actionName`, `correlation` —
the absence was read as *"this leg governs a different call"*, which is the one answer that rules a
corrupt leg out: the guard's own state space was narrower than reality's, exactly as in F1 (one identity
field of a self-contradictory row) and W8 (filing keyed on `approvalCaseId`).

## 2. The counterexample, driven through the real tool entry

`w13Row({ omit: 'correlation' })`, written as a raw `control-request-recorded` fact, then a real
`team_follow_up.execute` call from that instance carrying `correlation: 'tok-a4cl-w13'`
(`w12Leg` = real tool entry + a call-counting facade spy + `listControlState`; no direct
`consultGuard`, no fabricated verdict):

| plane | what it reads | value |
| --- | --- | --- |
| durable | 1 `control-request-recorded` row, `subject`/`targetInstanceId` → instance A, `actionName: 'follow-up'`, `toolName: 'team_follow_up'`, **no `correlation`** | present |
| reader | `parseRequestPayload` refuses it (`correlation` must be a non-empty string) → `readableRequestRows = 0` | refused |
| filing | `ControlState.corruptLegs = [{ requestId: 'req-a4cl-w13', disclosesMember: true }]` | filed |
| algebra | `memberAgrees('correlation', 'tok-a4cl-w13')` → `payload['correlation'] === undefined` → `'tok-a4cl-w13'.length === 0` → **`false`** | DISAGREES |
| verdict | no candidate → `no-request` | — |
| tool plane | `packages/tools/src/guard.ts` `consultGuard` maps `no-request` to `{ proceed: true }` | **executed** |

Measured base red (`red-W13-before-fix.log`, `Tests 4 failed | 28 passed (32)`): W13-a received
`{ verdict: 'no-request', namesRow: 'none', toolStatus: 'executed', facadeReached: 1 }` where the law
says `{ verdict: 'authority-undetermined', namesRow: 'req-a4cl-w13', toolStatus: 'blocked', facadeReached: 0 }`.
The durable leg vanished for the only call it claims, and the follow-up executed.

## 3. The causing code, verbatim (base)

```ts
const memberAgrees = (key: string, expected: string): boolean | undefined => {
  const raw = payload[key]
  if (raw === undefined) return expected.length === 0   // ← absence read as DISAGREES
  if (typeof raw !== 'string') return undefined
  return raw === expected
}
```

## 4. The rule installed

`memberAgrees` now obeys the algebra `subjectAgrees` already documents — *a member the row fails to
state is exactly a member it states in a form the reader refuses, and only a POSITIVE disagreement ever
rules a leg out* — and the two doc comments cross-reference each other in both directions (`THE PAIR`
in `subjectAgrees`, `ABSENCE HAS TWO CELLS` above `corruptLegCouldGovern`):

```ts
const memberAgrees = (key: string, expected: string): boolean | undefined => {
  const requirement = requestMemberRequirement(key)
  const raw = payload[key]
  if (raw === undefined) return requirement.required ? undefined : expected.length === 0
  if (typeof raw !== 'string') return undefined
  if (raw.length === 0 && requirement.rejectsEmpty) return undefined
  return raw === expected
}
```

**Requiredness is read from the same place `parseRequestPayload` reads it.** No key list is maintained
here: `requestMemberRequirement(key)` takes a canonical row the reader ACCEPTS (`probeRequestRow()`) and
asks the reader two questions — what does it do with this key removed, and with this key empty.
`required` ⟺ removal is refused; `rejectsEmpty` ⟺ emptying is refused. Derived once per key, cached,
never written to a ledger. The measured table (pinned by `W13-k`, and read through the export
`requestMemberRequirements`, which the candidacy algebra itself never consults):

| member | `required` | `rejectsEmpty` | consequence for an absent/empty value |
| --- | --- | --- | --- |
| `actionName` | true | true | NOTHING (was DISAGREES) — W13-b, W13-f |
| `correlation` | true | true | NOTHING (was DISAGREES) — W13-a, W13-f |
| `toolName` | **false** | **false** | unchanged: a stated-scope difference (W13-j, W13-i) |
| `operationFingerprint` | **false** | true | absent unchanged (W13-h); empty is now damage (W13-f's shape) |
| `subject` | true | true | read by `subjectAgrees`, never by `memberAgrees` (see §7) |

**The instrument cannot go quietly blind.** A probe whose canonical row stopped parsing would answer
`required: false` for every member and revert, silently, to the rule this commit removes. Two things
make that impossible: a probe that cannot answer declares the strictest reading (`required: true,
rejectsEmpty: true` — fail CLOSED, never an invented alibi), and the derived table is exported so the
law's own test can read it (`W13-k`). Mutants F and G below are the proof of both halves.

## 5. Stricter / looser, both directions, stated

* **STRICTER (execution plane).** A required member that is absent, or present and empty, answers
  NOTHING instead of DISAGREES → the leg stays a candidate and fails closed (W13-a/b/f).
* **LOOSER.** Nothing on the execution plane. One honesty move on the READ plane:
  `corruptLegDisclosesMember` no longer counts an empty value under a member the reader refuses empty as
  a disclosure, so a row whose only stated members are those empties is named `UNATTRIBUTABLE`
  (`disclosesMember: false`) instead of disclosing nothing-at-all-while-looking-attributable (W13-g).
  That class was ruled out before too (by those same empties answering DISAGREES) and it proceeds now
  exactly as it proceeded then; blocking on an unattributable row remains RULING 5-B's, reserved to a
  human.
* **Monotonicity, in the direction that matters.** No row that blocked before stops blocking:
  for every required member the call's `expected` is always non-empty (`guardOperation` refuses an empty
  `actionName`/`correlation` with `CONTROL_GUARD_MALFORMED` before candidacy runs), so such a member
  previously always answered `false` — a rule-out. Rows can only move *toward* blocking.
* **The cell the split actually separates, exactly.** Where the call names nothing AND the row omits a
  required member, the answer moved `true → undefined`. At the row level that is no move (neither
  AGREES nor NOTHING ever rules a leg out), and on the frozen route it is **unreachable** — no caller
  can hand `guardOperation` an empty `actionName`/`correlation`. It is documented rather than pinned,
  because no test can reach it; the alternative (keeping `expected.length === 0` for that cell) would
  require the function to hold a second, undocumented meaning for the same expression.

## 6. Red → green → mutation

| step | artifact | result |
| --- | --- | --- |
| RED (canonical) | `red-W13-before-fix.log` — `origin/master` source + the W13 legs a–j | `Tests 4 failed \| 28 passed (32)`: W13-a, W13-b, W13-f, W13-g |
| RED, full file vs base | `red-full-file-against-origin-master.log` | `5 failed \| 28 passed (33)` — the 4 plus W13-k, which cannot be asked of the base source (`TypeError: requestMemberRequirements is not a function`); the instrument leg tests an instrument the fix introduces |
| GREEN | `green-W13-after-fix.log` | `Tests 33 passed (33)` |
| solo ×5 | `solo-x5.log` | **5/5** (`33 passed (33)` every run, `.tmp-fault` cleared before each) |
| mutant A — flatten every absence into NOTHING | `mutant-A-flatten-all-absence-kills-W13h-W13j.log` | red: **W13-h, W13-j** |
| mutant B — restore the pre-G1 absence rule | `mutant-B-old-absence-rule-kills-W13a-W13b.log` | red: **W13-a, W13-b** |
| mutant C — drop the empty-required arm | `mutant-C-drop-empty-required-arm-kills-W13f.log` | red: **W13-f** |
| mutant D — an empty required member counts as a disclosure again | `mutant-D-empty-counts-as-disclosure-kills-W13g.log` | red: **W13-g** |
| mutant E — flatten every EMPTY into NOTHING | `mutant-E-flatten-all-empty-kills-W13i.log` | red: **W13-i** |
| mutant F — the probe row stops parsing (fail-closed arm present) | `mutant-F-blind-probe-row-fails-closed-names-it.log` | red: **W13-k, W13-h, W13-i, W13-j** — it fails closed, and the table leg names the instrument |
| mutant G — the probe row stops parsing AND the fail-closed arm is removed | `mutant-G-blind-probe-without-the-fail-closed-arm.log` | red: **W13-k, W13-a, W13-b, W13-f, W13-g** — the quiet revert the review named is loud in this world too |

Seven mutants, each killing exactly the legs that claim the cell it breaks and nothing else; the source
was restored byte-identically after every one (`restored=OK` against sha256
`be801558…` in the runner output, which re-ran the whole matrix at the shipped commit), and
`grep -c MUTANT` over both changed files is `0`.

The two-sided proof the brief asked for, in one line: **over-strict** (A) dies on the optional-absent
control legs W13-h/W13-j; **restoring the old rule** (B) dies on the counterexample legs W13-a/W13-b.

## 7. Where this lane disagrees with its own brief — and with the review

1. **`toolName` is NOT a required member, and a W13-j asserting "blocked" would have pinned a rule the
   reader does not hold.** The reader's line is
   `if (toolName !== undefined && typeof toolName !== 'string') return undefined`
   (`packages/runtime/control/service.ts:738-739`) — absence is accepted, and `''` is a string so an
   empty one is accepted too. The `toolName.length === 0 → undefined` the review quoted is at :2135 and
   :3117, i.e. `requestApprovalLeg`/`guardOperation` validating the **call's** scope: what a call may
   carry, not what a row must state. Two independent readings agree: the probe reports
   `{ required: false, rejectsEmpty: false }` (pinned), and the readable-row matcher at :1507
   (`(recorded.toolName ?? '') !== (guarded.toolName ?? '')`) treats a tool-less row's scope key as
   *different from* a tool-named call, so the corrupt-leg algebra ruling such a row out is consistent
   with the readable path, not narrower than it. So W13-j exists and is load-bearing, but it pins the
   measured cell — **proceed** — and its stated job is to go red if the probe ever answers
   `required: true` for every member. If the reader ever makes `toolName` required, `W13-k` and `W13-j`
   both go red and the pair must be re-derived together.
2. **"member present but damaged → `undefined`, already true" held only for the wrong TYPE.** A present
   but EMPTY required member answered `false`, not `undefined`. The fix covers that cell
   (`raw.length === 0 && requirement.rejectsEmpty`) and W13-f pins it; mutant C names it.
3. **The identity member's requiredness is not a fact about the `subject` key.** The first draft of
   W13-k asserted `required: false` for `subject` (because a row can satisfy identity through the legacy
   `targetInstanceId`); the probe answered `true`, because the canonical row addresses identity through
   the explicit subject alone. The leg now pins the measured value and says why it is a property of
   *this row*, and `memberAgrees` never consults the probe for identity anyway. Reading the instrument
   instead of describing it is the point of the leg, and it caught this lane's own assumption first.
4. **Twelve legs, not four.** The brief asked for the two required-member legs plus two controls. The
   fix has four decision arms and an instrument, so the group also pins the empty-required cell
   (W13-f), the read-plane disclosure move it forces (W13-g), the two optional cells it must not widen
   (W13-h/i), the third optional member (W13-j) and the probe table (W13-k). Mutants A and E show the
   last two are load-bearing rather than decorative.
5. **The tolerance ledger, restated as measured** (the review is right that my first report's arithmetic
   would have been misread; the correction is below, and it does not change the verdict):

   | run | tree | files / legs | failing identities |
   | --- | --- | --- | --- |
   | published baseline | `nine-root-post-d3-4-split.ids.txt` | 508 / 6373 | **9** |
   | BASE control | `origin/master @ de6823cc`, installed, **not built** | 508 / 6379 | **11** = the published 9 + 2 `a4p7-merge-gate` |
   | AFTER, pre-commit | this branch, `dist` rebuilt but not committed | 508 / 6388 | 12 = the 9 + a3p3 hygiene + the a4p7 *install-surface* leg + rc2 sanitize S13 |
   | AFTER, committed | this branch, committed tree (`scratch/census-final.log`) | 508 / **6391** | **9** = exactly the published set |

   Against the published baseline: **NEW = 0, FIXED = 0** — the tolerance set did not shrink, and it
   never contained an a4p7 identity. Against my own BASE run: `NEW = 0, FIXED = 2` (both a4p7). What
   was actually observed is that **`a4p7-merge-gate` measures its run context**: the three a4p7 reds
   seen across these runs each name an external cause — the composition-smoke leg `refused` because
   `packages/client/dist` does not exist in the control worktree (which was installed and never built);
   the install-surface leg was genuinely red while `dist` was rebuilt-but-uncommitted and went green
   when `dist` entered the commit; and the scratch-isolation leg hit `ENOENT` on its own
   `lint-scratch-control-a.mts` while eslint was reading it, under full-census load — the same file
   carries a leg that sweeps crashed scratch, so the collision is between that file's own
   instruments; this lane does not attribute it further. The a3p3-hygiene and rc2-sanitize identities from
   the pre-commit run pass solo on the same tree and are absent from the committed census. So this
   corroborates the *class* of G2's complaint — a verdict that depends on the leg's run context rather
   than on the product — but the specific mechanism this lane can evidence is build state and shared
   scratch under load, not colour detection; that belongs to G2's own measurement.

## 8. Counts and gates

| gate | command | verdict |
| --- | --- | --- |
| typecheck | `pnpm typecheck` | exit 0 |
| build + install surface | `pnpm run build`, `pnpm run build:composition`, `git add` the 4 drifted `service.*` files | committed in the same commit as the source |
| commit carries its build | `node scripts/check-artifacts-at-head.mjs` | `verdict=ok compared=1508 drift=0` — "HEAD carries its own build" |
| identity lint | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `160 identity lines, 76 distinct; baseline 76 distinct; new 0, resolved 0` |
| gate self-test | `node scripts/ci-pr-gate.mjs --self-test` | `pass 58 assertions` |
| the law's file | `pnpm exec vitest run packages/tools/test/a4-corrupt-leg-guard.test.ts` | `33 passed (33)`; 5/5 solo |
| root suite | `pnpm exec vitest run`, then `node scripts/fail-set.mjs capture` / `diff` | `Test Files 4 failed \| 504 passed (508)`, `Tests 9 failed \| 6382 passed (6391)`; against the published nine: **NEW=0 FIXED=0**; against this lane's own BASE control: NEW=0 FIXED=2 (both `a4p7-merge-gate`, §7.5) |

File counts: `packages/tools/test/a4-corrupt-leg-guard.test.ts` 1567 → 2030 lines, 21 → 33 `it`, 73 → 94
`expect(`; `git diff --numstat origin/master HEAD` on the file is **463 insertions / 0 deletions**, so no
pre-existing identity in the file was renamed, retitled or removed.
`packages/runtime/control/service.ts` +185 / −6 (`memberAgrees`, `corruptLegDisclosesMember`'s
`statesMember`, `corruptLegCouldGovern`'s doc, the probe + its export, the `subjectAgrees` cross-reference).
`subjectAgrees` itself is untouched — the coordinator's ruling was that it is already correct; it is the
precedent and the vocabulary this fix had to grow into.

New identities (exact strings): `test-identities-new-and-changed.txt` in this directory.

The base control is a second worktree, `.worktrees/g1-base-control`, checked out at `origin/master`
and installed (not built); it is gitignored and left in place so the BASE row above can be re-measured.

Raw vitest JSON reports stay in `scratch/` and are **not committed** (precedent:
`evidence/a4-pr7/ci-gate/scratch/census-*.json`); their `.log` tails and the captured identity sets are
committed, and every number in §7 can be re-derived from a fresh census.
