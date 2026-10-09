# A4-PR7 W2 lane B — rebuild success criteria, pinned as tests (FINDINGS)

- Branch: `test/a4-w2-rebuild-guarantees` (base `origin/master@ea417956`), one lane worktree, one writer.
- Human ruling in force: **RULING 5-B** (2026-10-09, warning-first) — an unattributable corrupt
  approval record does NOT block execution; recovery REUSES THE EXISTING LIFECYCLE; dispose means
  *instance rebuild*, **not history deletion** (`packages/runtime/lifecycle/dispose.ts` header:
  `Dispose: quiesce → DISPOSED 终态（历史不删除）`).
- New mechanism: **none**. Test files only, plus the sanctioned p4t6 lane-list extension (§6).
- Lane file: `packages/runtime/test/a4-w2-rebuild-guarantees.test.ts` — 15 tests, all green:
  `Test Files 1 passed (1) / Tests 15 passed (15)`.
- All measured excerpts below come from a THROWAWAY console-probe copy of the spec (run once,
  deleted; never committed). Full raw capture: [`measured-captures.log`](./measured-captures.log).

## 1. Case 1 — dispose = instance rebuild, not history cleanup (+ folded quota facts)

Path driven: `createLifecycleService(ports).disposeMember({rootSessionId, instanceId})` over the
real durable P6-T4 world (`packages/runtime/lifecycle/dispose.ts`; quiescence via the established
P7-T3 fakes; DISPOSE edge `sources: [CREATED, RUNNING, SETTLED, ARCHIVED] → DISPOSED`,
`packages/domain/lifecycle/src/operations.ts:97`). The Remote `member.dispose` wire itself is NOT
this lane (other lane owns it; see §8).

Measured (world `a4-w2-rebuild-alloc`, quotas team `{maxInstances:3, maxConcurrent:2}` — derived
blueprint, §7 note):

- `disposeLifecycle: "DISPOSED"`, `disposeLastStep: "commit-dispose"`, row lifecycle
  `"DISPOSED"`, and the member row SURVIVES with identity fields verbatim — before == after:
  `{"instanceId":"inst-1tz0nl01hv98","templateId":"worker","label":"p6t1-member","childSessionId":"session-child-p6t1-1tz0nl01hv98","createdAt":"2026-10-09T09:43:49.425Z"}`.
- Control-plane ledger: `requestCountBefore:1 == requestCountAfter:1`,
  `decisionCountBefore:1 == decisionCountAfter:1`, AND the captured row JSON (sequence + factType +
  payload) is byte-identical across the dispose (`requestRowsJsonBefore == requestRowsJsonAfter`,
  sequences 2/3, identical payloads).
- Folded quota fact (occupancy): with leader + DISPOSED A + live B committed under
  `maxInstances:3`, the next fresh-token activation is refused with the EXISTING code
  `cCode:"ACTIVATION_QUOTA_TEAM_MAX_INSTANCES"`, `cDetails:{"maxInstances":3,"current":3}` and
  `refusalZeroWrites:true` (fail-closed before reservation). Mechanism: `countTeamQuota`'s
  `teamTotal += 1` is unconditional per member row (`packages/runtime/activation/checks.ts:421ff`);
  only `isActiveLifecycle` feeds `teamActive`. NOT "fixed" — pinned as-is.
- Rebuild on a FRESH `requestToken` (same-token activate would be a re-drive, skipping admission —
  rebuild legs must and do use fresh tokens).

## 2. Case 4 — maxConcurrent is dispose-sensitive (contrast pair)

World `a4-w2-concurrent` (same derived quotas; `maxConcurrent:2`):

- Contrast WHILE ALL LIVE: leader + W1 + attempt →
  `contrastCode:"ACTIVATION_QUOTA_TEAM_MAX_CONCURRENT"`, `contrastDetails:{"maxConcurrent":2,"active":2}`.
- After `disposeMember(W1)` (`disposeLifecycle:"DISPOSED"`), a fresh-token activation is ACCEPTED
  (`acceptedAfterDispose:"inst-1bf9h0l1bzgt"`) — the active count dropped BECAUSE of the dispose;
  no Restore leg needed (direct edge from every non-terminal state, one durable write).

## 3. Case 2 — the rebuilt member inherits NO dynamic permission overlay

Mechanism asserted, not imagined: the overlay lives in the durable `permission_overlays` store,
keyed `(teamSessionId, memberInstanceId)`, current = highest generation, append-only, **no
template fallback** — `createPermissionOverlayRepositoryPort(...).latest(identity)` reads through
to `repository.latest(identity.teamSessionId, identity.memberInstanceId)`
(`packages/runtime/permission-governance/overlay-repository.ts:73-77`; port member set is exactly
`append/latest/history` with the generation CAS at the store, `:8`/`:23`). The port rides the
world's live domain handle (`world.domain.repositories.permissionOverlays`) — the store is never
opened twice over a live domain.

Measured (world `a4-w2-overlay-clean`; grant via `createGovernanceMutationService.mutatePermission`,
operator lane, one `fs/write` exact-matcher rule, `expectedGeneration:0`):

- Premise: `grantChanged:true, grantGeneration:1, grantMember:"inst-0n4h9t90em84"`,
  snapshotId carries A's instanceId (`grantSnapshotCarriesA:true`), `latestAGen:1`, `historyABeforeLen:1`.
- Rebuild (new token → `bId:"inst-0maigqc0ec8i"` ≠ aId): `latestB:"undefined"`, `historyBLen:0` —
  **that is what "clean dynamic-overlay state" means on the measured mechanism.**
- A's rows survive: `latestAGenAfterRebuild:1`, `historyAAfterLen:1`.
- DISCLOSURE for readers: this pins only the DYNAMIC overlay layer. The blueprint's BASELINE
  permission layer (static layers / envelopes) is a SEPARATE layer — "no overlay rows" ≠ "no
  permissions", and this suite claims nothing about baseline-layer inheritance.

## 4. Case 2b — a disposed member's pending leg does not reach the same scope (TOOL plane named)

World `a4-w2-guard-isolation`. A has a pending leader-approval request
(`actionName:'team.a4w2.scoped-action', toolName:'bash', correlation:'corr-a4-w2-shared-scope'`,
subject = A); A disposed; member B guards the SAME (action, tool, correlation) with B's instanceId.

- Positive control BEFORE dispose (the proceed is not vacuous): service plane
  `{allowed:false, reason:"request-pending", requestId:"ctrl-12qye3w1hrydel1nq9tmq0ao"}`; tool plane
  `{proceed:false, reason:"request-pending", requestId:"…"}`.
- THE LAW, asserted **on the tool plane** (`packages/tools/src/guard.ts:72` `consultGuard`, the
  plane where `no-request` maps to proceed — `packages/tools/src/index.ts:35`):
  `bDecision = {"proceed":true}`. The service plane is recorded alongside:
  `bVerdict = {allowed:false, reason:"no-request"}`. Both planes asserted (两者都记).
- B is NOT blocked by A's leg; B's scopeKey differs by subject identity, and B is alive.
- Boundary recorded: the disposed member's OWN scope after dispose answers
  `{allowed:false, reason:"target-stale"}` on the service plane (liveness check (b) runs before any
  request matching; `GUARD_LIVE_LIFECYCLES = ['CREATED','RUNNING','SETTLED']`, service.ts:317) and
  `{proceed:false, reason:"target-stale"}` on the tool plane.

**W1 observation (measured only, semantics untouched):** after the dispose, A's pending request
STILL appears in `listControlState(root).requests` — `requestsCountAfterDispose:1`,
`aLegStillListed:true`. The dispose moves the lifecycle row; it does not close, abandon, or hide
control legs. Whether a pending leg on a DISPOSED subject should expire is a semantic question
reserved to the human; this lane records it and changes nothing.

## 5. Case 3 — corrupt-leg warnings do not vanish on rebuild (+ the measured disclosure truth)

World `a4-w2-corrupt-survival`. Two refused `control-request-recorded` rows injected via the raw
writer (`writeRawControlFact`):

- (a) UNATTRIBUTABLE: `{summary:'…'}` — no scalar member, no subject, no legacy target → refused,
  `disclosesMember:false` (the RULING 5-B class).
- (b) ATTRIBUTABLE TO A: writes a **non-empty** `actionName` (per the parent ruling: set at least
  one of the four scalars non-empty; recommended `actionName`), AND carries A's parseable instance
  subject, AND is refused on the missing `requester` → `disclosesMember:true`. Its `true` does not
  depend on the broader paths (§5.1).

Measured before dispose == after dispose+rebuild (`bId:"inst-1lku4u91xdwt"` ≠ aId):

```
corruptBefore == corruptAfter ==
 [ {sequence:2, disclosesMember:false},
   {sequence:3, requestId:"req-a4-w2-damaged-attributable", disclosesMember:true} ]
corruptRequestRowsBefore:2 == corruptRequestRowsAfter:2
```

### 5.1 Disclosure predicate — measured vs the brief's wording (assertions follow measurement)

The brief said `disclosesMember` counts the four scalars. The CODE and the measurement are broader
(scratch probe, [`disclosure-predicate-probe.log`](./disclosure-predicate-probe.log)):

| row shape (all refused → corrupt)                     | measured `disclosesMember` |
| ----------------------------------------------------- | -------------------------- |
| parseable `subject` ONLY                              | **true** (`:1217-1219`)    |
| non-empty legacy `targetInstanceId` ONLY              | **true** (`:1221-1222`)    |
| all four scalars present-but-EMPTY                    | **true** — an EMPTY `operationFingerprint` discloses (`rejectsEmpty:false`) |
| `operationFingerprint:'fp-only'`                      | true                       |

`corruptLegDisclosesMember` = `packages/runtime/control/service.ts:1206-1223`; the empty-slot
relaxation is DOCUMENTED INTENT at `service.ts:1189-1202` (an empty legacy fingerprint agrees with
a fingerprint-less call — `W13-g`). The W13-g law ("present-and-empty where the reader REFUSES
empty = not written") holds and my rows obey it; the brief's "scalars only" simply under-describes
the predicate. Committed assertions contain no claim resting on the discrepancy; row (b) sets a
non-empty `actionName` exactly as ruled. 如果实测值和故事不一致，改的是故事——已在此改。

## 6. p4t6 scan ledger (parent process correction adopted, own commit)

Lane list `SCANNED_PATHS_A4W2` (one entry) + the derived-sum extension (both totals) + the
presence spread + the lane's OWN tie. No other list touched, no reformat, no merged lists.
Both endpoint totals are MEASURED scanner readings (temporary `+1` probe on one `expect`, reverted
before commit — never a hand-written total):

- before: `AssertionError: expected 1042 to be 1043` ([`p4t6-before-measured.log`](./p4t6-before-measured.log))
- after: `AssertionError: expected 1043 to be 1044` ([`p4t6-after-measured.log`](./p4t6-after-measured.log))
- green after probe removal: `Tests 10 passed (10)` ([`p4t6-green.log`](./p4t6-green.log))

Counting method: `filesScanned` = the scanner's own walk of `packages/**` source (two
self-referential exclusions); the asserted total is ALWAYS derived (`983 + Σ lane-list lengths`);
tie = `expect(SCANNED_PATHS_A4W2.length).toBe(1043 - 1042)` — movement == the one named file.
If the integration order moves the merged tip first, a post-rebase rerun of p4t6 re-derives both
numbers (process, not regression).

## 7. Lane quality gates (all run, all green)

- `vitest run test/a4-w2-rebuild-guarantees.test.ts` → 15/15.
- `vitest run test/p4t6-session-event-scan.test.ts` → 10/10 (with the probe-free tree).
- `pnpm -C packages/runtime run typecheck`, `pnpm -C packages/testkit run typecheck` → clean.
- eslint over the two touched files → no output (identity-clean).
- Full runtime suite WITH the lane (`packages/runtime` per-package invocation):
  `Test Files 3 failed | 353 passed (356)`, `Tests 7 failed | 4079 passed (4086)`
  ([`runtime-full-with-lane.log`](./runtime-full-with-lane.log)). Decomposition:
  - `test/p6t3-mediation.test.ts` (5) + `test/p6t3-restart.test.ts` (2) — the published pre-existing
    reds: all seven names appear verbatim in the earlier lane's baseline failset
    (`dev/agent-workflow/evidence/a4-pr7/f1-corrupt-identity/base-preexisting-reds.log`).
  - `test/a4pr0a-fact-type-closed-set.test.ts` — a per-package-invocation artifact, NOT a red: the
    suite's own header says a per-package invocation "fails LOUD ('the guard has no subject')"
    because its tracked-path lookups are repo-root-relative. Under the correct root invocation
    (`pnpm exec vitest run packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts`) it PASSES
    (measured: `Test Files 2 passed (2) / Tests 24 passed (24)` together with this lane's spec).
- CONTROL (lane file temporarily OUT of the tree, same per-package invocation): the three files fail
  IDENTICALLY — `Tests 7 failed | 5 passed (12)`
  ([`control-baseline-reds-without-lane.log`](./control-baseline-reds-without-lane.log)).
  The lane ADDS no new failing identity. Quota/blueprint notes: the Case 1/4 world uses a
  DERIVED blueprint source (P6-T4 fixture with ONLY the team quota block moved 4→3 / 4→2, blueprintId
  `A4W2-REBUILD-BP`); a containment guard fails fast if a replacement ever misses.

## 7.5 Local CI-gate history (fresh worktree is NOT a provisioned checkout — every step recorded)

- Gate run 1 (`--full`, all legs): **7/8 pass**; `census` REFUSED — `tests/deepseek-harness-test-use`
  (gitignored pristine host, pinned `639ed015397…`) is absent from a fresh worktree. Provisioned by
  rsync of the main workspace's provisioned copy into the lane worktree (verified: pinned SHA,
  `git status --porcelain` empty, built `app-boot/lib` present).
- Census run 2 (provisioned host, unbuilt client lane): 8 NEW reds — `plugin-dsh-compat` ×6 all
  `Cannot find module …/tests/deepseek-harness-test-use/packages/boot/app-boot/lib/index.js` and
  `a4p7-merge-gate` ×2 (`packages/client/dist … not on disk`, client lane unfired). All build-state
  provisioning, none semantic. Provisioned: `pnpm build` + `pnpm build:composition` (exit 0; the
  tracked committed-dist surface shows ZERO drift; `artifacts-at-head` stays green).
- Census run 3: reds == the 9 tolerated, plus ONE new identity
  `a3p3-governance-lane-hygiene … the ceiling adapter and the PR2 evaluator each have ONE audited
  consumer set per name` — failure `STACK_TRACE_ERROR` from vitest-runner internals (a timeout
  artifact, not a verdict flip). Published load-family rule honored: **3 consecutive solo runs, all
  green** (`Tests 21 passed (21)` ×3). Resample verdict of the gate itself: see below.
- The nine tolerated reds all reproduced in run 3 (t2-blueprint-hash ×1, p6t3-mediation ×5,
  p6t3-restart ×2, p6t6-actions ×1) — none of them "fixed" or moved by this lane.
- CONTROL census (this machine, `nproc=32`, lane spec file OUT of the tree): a3p3-hygiene goes red
  ANYWAY, together with the two published rc2 load-flakes (`rc2-kit-preset-seam`,
  `rc2-sanitize-evidence`) and 2 more load reds — 14 reds this time vs 10 in the lane-in runs,
  red SETS DIFFERING RUN TO RUN. The a3p3 red is therefore a property of running the 6400-leg
  census under 32-way load on this box (5000 ms default clock), NOT of this branch
  ([`census-control.log` raw capture pinned in `dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/`,
  untracked per that directory's convention]).
- Discriminator with the gate's OWN documented clock knob (`--census-test-timeout 30000`):
  **`leg=census verdict=pass`** — `COUNTS MOVED, SET DID NOT (509f/6412l vs the baseline document's
  own 508 / 6373) — the counts are context and the identity set is the verdict`; clock stated on the
  leg line: `--testTimeout=30000 ms, an operator override above the 5000 ms default`. The timeout
  hypothesis is proven: under the override the red set is EXACTLY the 9 tolerated, with this lane's
  file (+1) and legs (+15) as pure count context ([`census-run5-timeout30s.log`](./census-run5-timeout30s.log)).
  The declared clock is disclosed here precisely so no reader mistakes a raised clock for a hidden red.
- The control run also demonstrated the p4t6 pin has teeth: with the lane LIST committed but the
  lane FILE temporarily out of the tree, `p4t6 … coverage: all nine package dirs…` reddens —
  "a name without a file fails HERE", exactly as its law says.
- A census-mv slip by this lane momentarily deleted tracked `ci-gate/scratch/` artifacts; they were
  restored from the index in the same session (`git checkout -- …`; porcelain verified clean after).
  Disclosed here because the log of a near-miss is cheaper than a reader's suspicion.

## 8. 未验证 / 不声称 (not verified / not claimed)

1. The Remote `member.dispose` wire (handler, wire contract, remote plane) — owned by another lane;
   this suite drives the lifecycle service the handler wraps.
2. Restart survival of any capture here (single-process worlds; restart models are pinned by the
   P4/P6 suites).
3. Any production composition wiring for the governance permission lane — the lane deps are the
   a3p3 fixture pattern (real chain + real overlay store + noop legacy doubles; the capability
   PolicyReader throws if consulted, and was never consulted).
4. That the unattributable class SHOULD or SHOULD NOT block — RULING 5-B keeps it non-blocking
   (`a4-corrupt-leg-guard.test.ts` W8-b/W12-c pin the execution effect); this lane pins only that the
   WARNING SURVIVES dispose+rebuild unchanged.
5. That A's still-listed pending leg should stay listed FOREVER or expire — recorded (W1), not ruled.
6. No claims about baseline (static-layer) permission inheritance in §3 — separate layer, out of scope.
7. The seven p6t3 reds in §7 are NOT claimed fixed and NOT claimed unrelated in origin — only
   claimed pre-existing on the merge base, by name-match against the published failset and by
   control run. The a4pr0a line in the same log is claimed ONLY as an invocation artifact
   (it passes under the root invocation its own header prescribes).
8. The worktree environment provisioning in §7.5 is claimed only as LOCAL grading capability; it
   changes nothing tracked (host tree is gitignored; builds left the tracked dist byte-identical).
9. The a3p3-hygiene red in §7.5 is claimed load-flaky ONLY on the strength of 3 solo greens + the
   runner-internal error shape — if the resampled gate still fails it, this lane re-reads it as
   real, not flaky.
