# A4-PR7 §7.7 W8 — RULING 5-A: a refused control leg was FILED only if it still named its case

Task: external review item **W8**, implemented as **RULING 5-A** (red first, then green).
Branch: `fix/a4-w8-corrupt-filing` (base `origin/master` @ `915d2321`).
CORE PATCH BUDGET honoured: zero upstream imports, zero upstream patches. The product change is
one filing condition, one named row-level precondition, and one additive field on a read route —
all inside this repo's `packages/runtime/control/`.

---

## 1. The defect, in one sentence

`loadControlState` filed a row the strict reader refused into `ControlState.corruptLegs` **only if
the damaged payload still carried a readable `approvalCaseId`** — the one field the candidacy test
(`corruptLegCouldGovern`) refuses to trust, because a damaged row's case id is exactly what cannot
be recomputed. So a refused row that named its scope (identity, action, tool, correlation) but not
its case was in **neither** `state.requests` **nor** `state.corruptLegs`: invisible to the read
plane, invisible to the guard, and the call its own durable leg governs was answered `no-request` —
the single verdict `packages/tools/src/guard.ts` maps to **"proceed"**.

Same disease as F1, one level up: the guard's state space was narrower than reality's. F1 was a row
whose disclosed members were read one-at-a-time; this was a row that was never in the set at all.

## 2. The counterexample (real `team_follow_up.execute`, not an internal call)

`w12RefusedRow()` (`packages/tools/test/a4-corrupt-leg-guard.test.ts`): a `control-request-recorded`
row with `subject`/`targetInstanceId` = the live seeded worker, `actionName: 'follow-up'`,
`toolName: 'team_follow_up'`, `correlation` = the call's `requestToken`, **no** `operationFingerprint`
(the scope shape `packages/tools/src/tools.ts` sends) and **no** `approvalCaseId`. Its damage is
`authorityScope` present-and-malformed (`SCOPE_SUBTREE`) — the very damage W1 files when a row
happens to name a case. Driven through `followUp.execute` with the runtime facade behind a
call-counting spy, producer plane and tool plane both captured:

| leg | the call | BEFORE 5-A | AFTER 5-A |
| --- | --- | --- | --- |
| **W12-a** | names the row's members | **`no-request`, tool `executed`, facade REACHED 1, namesRow `none`** | refused `authority-undetermined` naming `req-a4cl-w12`, tool `blocked`, facade 0 |
| **W12-b** | same row, different correlation | `no-request`, `executed`, facade 1 | same (anti-freeze unchanged) |
| **W12-c** | row discloses NO comparable member | `no-request`, `executed`, facade 1, **reported nowhere** | `no-request`, `executed`, facade 1, **and reported: `disclosesMember: false`** |
| **W12-d** | call named by neither of two refused rows | `executed`, facade 1, neither row reported | `executed`, facade 1, **both rows reported** |
| **W8-a** | P6T4 `consultGuard`, row names the call | `{ proceed: true }` | `{ proceed: false, reason: 'authority-scope-unbound', requestId: 'req-a4cl-w8' }` |
| **W8-b** | P6T4 `consultGuard`, row discloses nothing | `{ proceed: true }`, unreported | `{ proceed: true }`, **reported** |

Transcripts: [`red-before-fix.log`](red-before-fix.log) (5 failed / 16 passed),
[`green-after-fix.log`](green-after-fix.log) (49 passed),
[`solo-x5.log`](solo-x5.log) (21/21 five times, no flake).

## 3. The installed rule

1. **Filing** (`loadControlState`): every `control-request-recorded` row whose payload is an
   inspectable plain object and which `parseRequestPayload` refused is filed in `corruptLegs`.
   Filing now depends on the DAMAGE alone.
2. **Candidacy is unchanged where the ruling put it**: the five-member algebra inside
   `corruptLegCouldGovern` is byte-identical (identity-with-two-disclosures from F1,
   `actionName`, `toolName`, `correlation`, `operationFingerprint`; a row stays a candidate unless a
   member positively disagrees). One **row-level precondition** was added in front of it, by name:
   `corruptLegDisclosesMember(payload)` — a row that discloses none of the five members
   (every one absent-or-unreadable) is **unattributable** and is not a candidate. Without that arm,
   filing every refused row would silently turn the all-`undefined` verdict vector into "governs
   every call in the Team at once", which is RULING 5-B's decision, not this lane's.
3. **The read plane is loud** (additive, non-gating): `ControlService.listControlState` now returns
   `corruptLegs: readonly ControlCorruptLegRecord[]` — `{sequence, requestId?, approvalCaseId?,
   disclosesMember}` for every refused row, durable-sequence ordered, identities echoed only when the
   damaged row still discloses one. `disclosesMember: false` is the marker of the RULING 5-B class.
   This is the shape W9 pinned (`readApprovalCaseState`, `findApprovalCaseByIdentity` report and gate
   nothing) extended to the rows those case-keyed routes can never reach.

## 4. Disclosed relaxations and boundaries (read these before merging)

* **The one permissive cell.** An unattributable row that happens to name a case BLOCKED before this
  change (all-five-`undefined` verdicts made it a candidate). Under RULING 5-A's "it must still not
  block" — which is unconditional and case-id-independent — that cell now proceeds, loudly
  (`disclosesMember: false` on the read plane). No test in the tree pinned it (root fail-set diff
  `NEW=0`); it is stated here because it is the only direction this change moves that is not
  fail-closed, and it is exactly the cell RULING 5-B exists to settle.
* **Not wired into the model-facing tool.** `team_list_pending_control` still returns `pending` /
  `count` / `truncated` unchanged. The fault is on the durable read route (which that tool already
  reads and the remote/UI plane can read); surfacing governance faults in a Leader's tool payload is
  a model-facing shape change with its own docs/census consequences, so it is left as a disclosed
  follow-up rather than being smuggled in here. **No `CORE_SEAM_BLOCKER`**: nothing here needed an
  upstream change — the read route extended is this repo's own.
* **W8 was renamed, by instruction.** The old identity
  `W8 (disclosed boundary): a corrupt row that names no case keeps today's no-request`
  no longer exists; RULING 5-A required splitting it (the `D3-4b` precedent), so it is now **W8-a**
  (attributable → the new block) and **W8-b** (unattributable → still proceeds, pending 5-B). No
  other leg was renamed or removed; W1–W7, W9–W11 are untouched and green.

## 5. A second pin of the old rule, found and corrected

`packages/runtime/test/a4a-control-exact-scope.test.ts` (C2) asserted `no-request` for exactly the
shape this ruling files — a refused, case-less row whose fingerprint member is present-but-empty or
non-string, consulted at a scope that matches it. Its stated claim ("fail-closed ABSENT: the row can
never grant an allow") is now **better** served, but the reason string moved to
`authority-undetermined`, so the leg was corrected in place and renamed, with a comment citing this
ruling. Exact new identity:

```
TEST packages/runtime/test/a4a-control-exact-scope.test.ts::A4a (C2): a scope without the fingerprint is exactly the old behavior > a CORRUPTED durable fingerprint (present-but-empty / non-string) is fail-closed ABSENT: the row can never grant an allow, and since RULING 5-A it is refused BY NAME, not as no-request
```

No other test in the tree wrote a refused case-less row that matches a guard call (enumerated: the 23
files that write `control-request-recorded` raw facts; the root-suite fail-set diff confirms `NEW=0`).

## 6. Two-sided mutation proof

* **Mutant A (over-strict — the unattributable cell blocks):** deleted the
  `if (!corruptLegDisclosesMember(payload)) return false` line. Killed exactly the three named
  boundary witnesses — W8-b (`proceed:false` where it must proceed), W12-c and W12-d
  (`verdict: authority-undetermined`, `facadeReached: 0` where the boundary is "proceeds, and is
  reported"). 18 others, including W12-a/W12-b and all of W1–W11, stayed green.
  [`mutant-A-overstrict-kills-the-boundary-legs.log`](mutant-A-overstrict-kills-the-boundary-legs.log)
* **Mutant B (permissive — the attributable cell proceeds again):** restored the old filing condition
  `isPlainObject(payload) && typeof payload['approvalCaseId'] === 'string'`. Killed W12-a and W8-a
  (the attributable witnesses: `no-request` / `facadeReached: 1` / `{proceed:true}` came back) plus
  the loudness halves of W8-b / W12-c / W12-d.
  [`mutant-B-old-filing-rule-kills-the-attributable-legs.log`](mutant-B-old-filing-rule-kills-the-attributable-legs.log)
* Both mutants reverted by restoring the file from a byte copy: `sha256` before
  `c563b2941dc38ef72c482bff72490dc02964a5c64be2a644bc770b4d1f2a97be`, after the same.

## 7. Gates

| gate | result |
| --- | --- |
| group (`a4-corrupt-leg-guard.test.ts`) | 21/21, 5× solo, no flake |
| `a4a-control-exact-scope` + `a4p3-approval-case` + `control-legacy-row-compat` | 82/82 with the group |
| root suite fail-set vs base (same worktree, `915d2321`) | base 12 → after 11: **NEW=0**, FIXED=1 |
| `pnpm typecheck` | exit 0 (all packages) |
| `pnpm run build` + `pnpm build:composition` | rebuilt; the 6 drifted `dist` files are staged in this commit |
| `node scripts/lint-identities.mjs --diff lint-identities-11e1609c.txt` | 76 distinct, **new 0**, resolved 0 |
| `node scripts/ci-pr-gate.mjs --self-test` | **58** assertions pass (right base) |

The single FIXED identity is
`packages/testkit/test/rc2-sanitize-evidence.test.ts::… S13 file aliases, quoted values, and capture
formats pass the standalone regressions`: it spawns a nested `node --test` with a 60 s timeout and is
load-sensitive; it was red in the base full-suite run and passes solo (13/13) on this tree. Nothing
in this change touches the sanitizer. Base fail set:
[`root-suite-failset-BASE.txt`](root-suite-failset-BASE.txt),
after: [`root-suite-failset-AFTER.txt`](root-suite-failset-AFTER.txt),
diff: [`root-suite-failset-diff.txt`](root-suite-failset-diff.txt).

## 8. What could NOT be verified here

* The root suite was run **once** per state (base, after), not repeatedly; the S13 leg above shows
  why a single run cannot separate flake from change for that identity. Everything else in the diff
  is a stable identity.
* The 11 pre-existing reds at `915d2321` (5× `p6t3-mediation`, 2× `p6t3-restart`,
  `a3p3-governance-lane-hygiene`, `a4p7-merge-gate`, `p6t6-actions`, `t2-blueprint-hash`) were not
  investigated: they are other lanes' debt and unchanged by this branch.
* Whether the unattributable class is reachable in a real deployment beyond hand-edited / foreign
  ledgers: the legs construct it deliberately, because a row that damaged ALL five comparable
  members while leaving everything else parseable is not a shape any writer in this repo produces.
* Whether RULING 5-B should block the unattributable class is a human decision; this branch pins the
  current effect and makes the choice visible, it does not pre-empt it.

## 9. Deviations worth recording

* `pnpm install --frozen-lockfile` used the shared store
  (`--store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store`) because this environment is
  offline (same deviation as F1).
* `tests/deepseek-harness-test-use` is a symlink to the main checkout's pristine host clone (the tree
  is gitignored by an ignore rule with a trailing slash, so it shows as `??`); it is NOT staged.
