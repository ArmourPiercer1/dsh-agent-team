# A4-PR7 §7.7 F1 — corrupt-identity: the guard read ONE identity field of a corrupt leg and treated the other as absent

Task: F1 "corrupt-identity", drive F (corrupt-leg disclosure round), §7.7 defect list.
Branch: `fix/a4-f1-corrupt-identity` (base `origin/master` @ `a187d7b0`).
CORE PATCH BUDGET honoured: zero upstream imports/patches; the change is one member of one
function in this repo's `packages/runtime/control/service.ts` plus tests.

---

## 1. The defect, in one sentence

`corruptLegCouldGovern` — the function whose whole job is to keep a damaged control row from
being read as "no request governs this call" — read the row's identity from **one** field: if
`subject` was present it was consulted and `targetInstanceId` was never looked at, and
`targetInstanceId` was read **only** when `subject` was absent. So a corrupt row that names
TWO different instances (`subject`→A, `targetInstanceId`→B, A≠B) was positively ruled out for
a call on B, because the one field the guard read disagreed.

That is not an exotic shape: `parseRequestPayload` (`:712-719`) REFUSES a row whose explicit
subject disagrees with its legacy projection ("an ambiguous identity — fail closed, never a
guess"), and `loadControlState` (`:1452-1463`) files every refused row that names an
`approvalCaseId` into `corruptLegs`. **The contradiction is the main path into the bucket this
function reads**, and the guard was reading it backwards.

## 2. The counterexample (drives the real `team_follow_up` entry, not an internal call)

One row built with `ledger.put`, self-consistent everywhere except the identity:
`subject` = `inst-p6t2seedw01` (worker) AND `targetInstanceId` = `inst-p6t2seedw02` (worker2),
valid `approvalCaseId`, `actionName: 'follow-up'`, `toolName: 'team_follow_up'`,
`correlation` = the call's requestToken, no fingerprint, no `authorityScope` → refused by the
reader solely for the identity contradiction → `corruptLegVerdictOf` = `authority-undetermined`.
Plus a readable durable DENY on the same case, and `team_follow_up` executed through
`followUpSpec()`'s real `execute`, with the facade wrapped in a call-counting spy.

| leg | targeted instance | BEFORE the fix | AFTER the fix |
| --- | --- | --- | --- |
| **W11-a** | A (worker) = `subject` | refused `authority-undetermined`, facade 0 | same (unchanged) |
| **W11-b** | B (worker2) = `targetInstanceId` | **`no-request`, tool `executed`, facade REACHED 1, DENY not consulted** | refused `authority-undetermined` naming `req-a4cl-w11`, facade 0 |
| **W11-c** | C (scout) = neither | `no-request`, tool `executed`, facade 1 | same (unchanged) |

W11-b is the corruption: the guard answered `no-request` (packages/tools/src/guard.ts
`:87-89` → `{proceed:true}`), a stored DENY over a live request vanished from the tool plane's
view, and the follow-up was actually executed.

## 3. The causing code, verbatim (before)

```ts
  const subjectAgrees = (): boolean | undefined => {
    if (payload['subject'] !== undefined) {
      const parsed = parseSubject(payload['subject'])
      return parsed === undefined ? undefined : subjectIdentityOf(parsed) === subjectIdentity
    }
    // The legacy projection `parseSubject`-derived rows carry: a present
    // `targetInstanceId` IS the instance subject, read the same way here.
    const legacyTarget = payload['targetInstanceId']
    if (typeof legacyTarget !== 'string') return undefined
    return (
      subjectIdentityOf({ kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: legacyTarget }) ===
      subjectIdentity
    )
  }
```

The `return` inside the `subject` branch is the bug: `targetInstanceId` is unreachable whenever
`subject` is present, so the row's second assertion never enters the verdict.

## 4. The rule this change installs

> **The identity member of a corrupt leg reads EVERY identity the row discloses, not the one
> it prefers.** A row discloses through `subject` and/or `targetInstanceId`; both are
> collected. The member AGREES only when EVERY disclosure agrees, DISAGREES only when EVERY
> disclosure disagrees, and says NOTHING when the disclosures contradict each other — because
> a self-contradictory assertion is evidence about nothing: the row claims the call at A as
> loudly as the call at B, so neither half can be read as "not THIS call". Only a positive
> disagreement ever rules a leg out, and that is what still keeps one damaged row from
> freezing a whole Team.

No special case for B, no "when they disagree treat it as X": the member became a set.
The actionName / toolName / correlation / operationFingerprint member algebra
(`memberAgrees`) is untouched, character for character, as is the row-level
`!verdicts.some((agrees) => agrees === false)`.

One secondary consequence, in the fail-closed direction and documented in the code: a
present-but-unreadable disclosure (a `subject` that fails `parseSubject`, a non-string or empty
`targetInstanceId`) now enters the set as "nothing", so it can block another disclosure from
ruling the row out; previously such a row could be ruled out by the other field.

## 5. Evidence in this directory

| file | what it is |
| --- | --- |
| `red-W11b-before-fix.log` | the canonical RED, fix absent: `Tests 1 failed | 14 passed (15)`, only W11-b, showing `no-request` + `facadeReached: 1` |
| `green-W11-after-fix.log` | verbose green after the fix: all 15 named legs, W11-a/b/c refused or proceeded as the rule says |
| `solo-x5.log` | the corrupt-leg group run 5× solo against the final source: `15 passed (15)` × 5 → **5/5** |
| `mutant-overstrict-kills-W11c.log` | proof the green pair is not vacuous: mutating the fixed member so the identity DISAGREES can never rule a row out turns **W11-c** red — the anti-freeze half is load-bearing |
| `base-preexisting-reds.log` | the 9 runtime/tools failures, captured with this branch's changes stashed |
| `root-suite-failset-BASE.txt` / `-AFTER.txt` / `-diff.txt` | whole-root-suite fail identity sets captured with `scripts/fail-set.mjs`, base vs after: `baseline=10 current=10 NEW=0 FIXED=0` |

Red→green is attributable: the same test file, same fixture, the fix as the only difference.
The 10 root-suite reds are the disclosed pre-existing debt (5× `p6t3-mediation`, 2×
`p6t3-restart`, `d3-member-identity-context` D3-4, `p6t6-actions` direct-delivery, 1×
`t2-blueprint-hash`) and none of them moved.

## 6. Deviations from the tasking, stated up front

1. **File placement.** The tasking put the new W11 group in
   `packages/runtime/test/a4p3-approval-escalation.test.ts` on the premise that "that file
   already holds the corrupt-leg guard group". That premise is false on this base and on every
   branch: `git log --all -S"consultGuard" -- packages/runtime/test/a4p3-approval-escalation.test.ts`
   is empty, and the W1..W10 group (with `consultGuard`, the `team_follow_up` harness W10 uses)
   lives only in `packages/tools/test/a4-corrupt-leg-guard.test.ts` (added by `70075deb`).
   The group was added there instead — same W-series numbering, reusing the real entry the W10
   leg drives, without duplicating the law and its harness into a second file.
   `packages/runtime/test/a4p3-approval-escalation.test.ts` is therefore **unchanged**:
   154 `expect(` before, 154 after; 57 named legs before, 57 after; solo `57 passed (57)`.
2. **pnpm store.** `pnpm install --frozen-lockfile` ran with
   `--store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store` (the repo's shared 3.7 GB
   store) rather than a fresh `$PWD/.pnpm-store` inside the worktree; a fresh store in a
   worktree has no content and the environment is offline, so `--frozen-lockfile` could not
   have completed.

## 7. Anything that pinned the OLD behaviour

Nothing. The tree was searched two ways:

- **Mechanically**: whole-root-suite fail identity sets, base vs after —
  `NEW=0 FIXED=0`, i.e. no test changed colour in either direction. Had a test been *deliberately*
  pinning "proceed when `subject` mismatches but `targetInstanceId` matches", it would have
  turned red here. None did.
- **By hand**: every test payload carrying both identity fields. Three sites, none of them the
  old rule: `packages/runtime/test/control-subject-normalization.test.ts:143` (scenario 4 pins
  the WRITE plane refusing a mismatched pair with `CONTROL_REQUEST_MALFORMED` and zero facts —
  the same law as §1); `packages/client/test/pr56-control-subject-payload.test.ts:240` (the
  client's read plane renders a subject/target CONTRADICTION as `unsupported-subject` and
  refuses to pick a side — it *corroborates* the installed rule); this file's own W11 row.
- `W7` (the existing anti-freeze legs) differ from the corrupt row by correlation / action /
  tool, never by identity, so they were never this code's customer — they stayed green.

## 8. Counts and gates

| item | before | after |
| --- | --- | --- |
| `packages/tools/test/a4-corrupt-leg-guard.test.ts` `expect(` | 42 | 50 |
| `packages/tools/test/a4-corrupt-leg-guard.test.ts` named legs | 11 | 15 |
| `packages/runtime/test/a4p3-approval-escalation.test.ts` `expect(` | 154 | 154 (untouched) |

New test identities (exact, as `scripts/fail-set.mjs` would name them):

```
TEST packages/tools/test/a4-corrupt-leg-guard.test.ts::W11 a corrupt leg that names TWO instances rules out NEITHER of them W11-premise: the row is refused by the reader, filed as a corrupt leg, and its DENY survives
TEST packages/tools/test/a4-corrupt-leg-guard.test.ts::W11 a corrupt leg that names TWO instances rules out NEITHER of them W11-a: a call on the instance named by `subject` is refused by name, not ruled out
TEST packages/tools/test/a4-corrupt-leg-guard.test.ts::W11 a corrupt leg that names TWO instances rules out NEITHER of them W11-b: a call on the instance named by the legacy `targetInstanceId` is refused TOO (the counterexample)
TEST packages/tools/test/a4-corrupt-leg-guard.test.ts::W11 a corrupt leg that names TWO instances rules out NEITHER of them W11-c: a call on an instance NEITHER field names proceeds (the anti-freeze half)
```

No existing identity was renamed or removed.

Gates against the final source:

- `pnpm exec vitest run packages/tools/test/a4-corrupt-leg-guard.test.ts` → `15 passed (15)`, 5/5 solo.
- `pnpm exec vitest run packages/runtime/test/a4p3-approval-escalation.test.ts` → `57 passed (57)`.
- whole root suite (`vitest run`) → fail-set identical to base (`NEW=0 FIXED=0`).
- `pnpm typecheck` → exit 0.
- `pnpm run build && pnpm build:composition` → `DSH-ARTIFACT-VERDICT verdict=ok`; the three
  drifted `packages/runtime/dist/packages/runtime/control/service.*` artifacts are in the same
  commit as the source (the repo's install-surface freshness gate).
- `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt`
  → `76 distinct; new 0, resolved 0`.
- `node scripts/ci-pr-gate.mjs --self-test` → `DSH-CI-SELFTEST pass 51 assertions`.

No storage-seam change was needed; the row was written with the public `ledger.put` the W-series
already uses, so no `CORE_SEAM_BLOCKER`.
