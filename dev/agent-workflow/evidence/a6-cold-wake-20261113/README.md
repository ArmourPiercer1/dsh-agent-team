# A6-COLD-WAKE — a NEW governed ask gets no review wake after a cold boot (PD-44 / `COLD-WAKE`)

- Lane: `task/a6-cold-wake-20261113` (worktree `.worktrees/a6-cold-wake-20261113`), base `origin/master` `673b8b182`.
- Evidence class: **DEV-LIVE** (real Host, real plane takeover, SIGKILL + create-or-open boot, sanctioned ports).
  No `V@B`, no `CANDIDATE-C2`, no matrix grade, no Authority/CI movement.
- Instrument: `tests/kits/a6-cold-wake-20261113/a6-cold-wake.mjs` (derived copy of the A1 kit; the A1 kit's
  record is untouched). Two worlds per run, one restart per run, teardown verified.
- Frozen finding ids used here: **`COLD-WAKE`** (this row) and its clauses **CW-1…CW-5** (the kit's own
  clause names, not register ids).

## 1. Verdict

**Product defect — liveness, not corruption.** After the Host is SIGKILLed *while a review-wake turn is
open and its wake intent row is live*, the create-or-open boot recovers the durable facts (ledger,
decision, execution, intent row) **consistently**, but the wake plane then goes silent for **NEW** work:

1. the post-restart plan for the new ask is admitted and its leg is durably `pending`;
2. **no `[team-review-wake]` names the new request** inside a **45 s** observation window (wake-intent
   dir empty at the moment of the new ask in `diag-6`);
3. `team_follow_up` on the crashed Member is admitted (`status 200`, no refusal) and produces **no model
   turn** for the Officer in 60 s;
4. only `team.resolveControl` (**the operator**) ends it — `decidedBy: "operator"`, 200.

The pre-crash twin of the same ask was decided by the **Officer instance** (`inst-…`, `kind: "instance"`),
so the machinery itself works; the crash is what breaks it.

## 2. Discriminator (what makes it fail)

| condition at SIGKILL | runs | new ask decided by |
| --- | --- | --- |
| **no** live wake-intent row (`wakeFilesAtKill: []`), no open wake turn | `diag-2`, `diag-3` | **Officer**, within 251–252 ms |
| a **live** wake-intent row (`wakeFilesAtKill: ["wake-*.json"]`) and an open wake turn | `diag-5`, `diag-6`, `fixed-run1` | **operator**, after the 45 s window |

Same kit, same composition, same host pin; only the kill point differs. That is the whole finding: a live
wake intent at the kill is the poison, and the poison is silent.

## 3. Two-run table (the two clean repro runs)

| run | dir | kill | `wakeFilesAtKill` | recovery wake turns | `followUpProducedTurn` | window | decided in window | decider |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| repro 1 | `diag-5/` | after-decision | `["wake-917e9599.json"]` | `[]` | `false` | 45 157 ms | **false** | operator |
| repro 2 | `diag-6/` | after-decision | `["wake-dfb3a21f.json"]` | `[]` | `false` | 45 160 ms | **false** | operator |
| control 1 | `diag-2/` | after-completion | `[]` | `—` | `true` | 251 ms | true | Officer |
| control 2 | `diag-3/` | after-decision, no open turn | `[]` | `[]` | `false` | 252 ms | true | Officer |
| (attempt) | `fixed-run1/` | after-decision + two re-arm patches (§6) | `["wake-525c0d79.json"]` | `[]` | `false` | 45 161 ms | **false** | operator |

Clause scores: repros `CW-1 true, CW-2 true, CW-3 false, CW-4 false, CW-5 true`; controls all `true`.
`CW-3` = "a wake naming the new request appears within the window"; `CW-4` = "the Officer decides it".

Per-run facts are `cw-facts.json`; timelines are `cw-timeline.md`; the delivered wake texts are
`a6-officer-wakes.log` (every `[team-review-wake wakeId=…]` with the request ids it named); the model-side
request order is `mock.log`; the Host's own output is `instance.log`; the kit's console trace is `run.log`.

In `diag-5` the only post-restart wake (`…0bec1e63`, then `…51fcc63c`) names the **pre-crash** legs
(`ctrl-04kg4…`, `ctrl-0hzr9…`) — grep-confirmed as real durable legs in `storages/team_domain.json` — and
the new ask (`ctrl-0o3i24a0yxeso71ydgucc0v8`, leg 1, `parameter-permission`) is named by **none** of them.
A wake turn does start 0.4 s **after** the operator's allow; it names a leg that only exists because the
operator decided. That ordering is the finding.

## 4. Mechanism (code, file:line)

The intended recovery law is "adopt the persisted wake as `queued`; that single wake's turn re-reads
authority itself". After a cold boot the premise is false, and each guard that would normally re-read is
bypassed in a different way:

1. **Boot adoption, never a delivery.** `alpha6/wake-intent.ts:144` — *"intent + Inbox row exists →
   ADOPT as `queued` (windows c and d), never [emit a delivery effect]"*. The intent row was `accepted`
   and the native message was still listed, so recovery adopts and delivers nothing.
2. **The queued latch swallows the changed fingerprint.** `review-wake/coordinator.ts:300-306` —
   *"The single queued wake is generic: it survives a work change and the turn re-reads authority
   itself"* — `scan-result` on a `queued` latch only moves `observedWorkFingerprint`; it emits **no**
   `deliver-wake`.
3. **The release gate never fires for an orphan.** `alpha6/wake-dispatch.ts:370-408` — the `queued`
   branch releases (`delivery-failed` + rescan) **only** when `inbox.has(queuedWakeId)` is false. The
   orphaned message of the *crashed* turn is still listed by the Host's pending store (`has` answers
   presence, not liveness), so `present: true` → *"No second delivery"* — silently, with no failure and
   no fact.
4. **The turn that could claim it never claims it, and its end never rescans.**
   `src/plugin/root.ts:2701-2708` claims a latch only from `agent/inbox/claimed`; a wake claimed **before**
   the crash is continued by the resumed process after the boot, so no claim event arrives. And
   `src/plugin/root.ts:2717` — `if (coordinator.state.status === 'queued') return` — makes `turn-end`
   skip the post-turn rescan for exactly that state.

So: the new plan is absorbed (2), the safety release is blocked by a stale-but-present message (3), the
ordinary re-read path is dead (4), and recovery never re-plans (1). The new ask's leg stays durably
`pending` and *decidable* — `team_list_pending_control` lists it, `team.resolveControl` resolves it — but
nothing wakes the reviewer for it. That last property is what makes it a defect rather than corruption:
**no fact contradicts, and every layer believes it is in a healthy state.**

## 5. Why this is a defect and not the documented crash limit

The documented limits cover *not re-delivering a notification the dead process had already claimed*
(ADR line 261 "restart … never auto-restarts a dead invocation"; blueprint memo line 206 "已 claim 但中途
崩溃的通知不应假设 Host 自动完整重投"). Neither says a **new** ask — minted *after* the boot, never claimed
by anyone — is left without a wake. `docs/runbooks/REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md` §3.4 promises the
opposite: a re-issued ask "reaches the reviewer (a review wake / its turn in the reviewer session, or
`team_list_pending_control` lists the new id)". The last clause is satisfied; the first two are not, and
the runbook presents them as one promise. PD-40 (latch-scoped Stop) is a different limit and is not
conflated here: this finding is about **wake delivery**, not Stop.

## 6. Fix attempts, measured and withdrawn (do not read this as a shipped fix)

Two narrow re-arm patches were implemented, unit-tested and A/B measured live; **both were reverted**
before commit because the live measurement still starved:

1. **Boot reconcile** (`recoverReviewWake` + `root.ts` boot loop): at a cold boot no live turn owns a
   claim, so withdraw the ownerless native message and rebuild from the durable ledger. Unit-tested
   host-free (withdraw → clear → idle → exactly one re-issue; unremovable message → retained, no
   duplicate). **Live: the boot rebuild re-delivered the *pre-crash* leg's wake (correct — it was still
   pending) but that delivery still started no turn.**
2. **Turn-end re-arm** (`alpha6ReviewWakeTurnEnd`): release a `queued` latch at turn end when its native
   message is positively gone, then run the normal rescan. **Live: the intent row was cleared with no
   delivery and no visible failure (`diag-6`/`fixed-run1`: `wake-intent-dir-changed files: []`,
   `newWakeTurns: 0`).**

`fixed-run1/` is that attempt's record. The residual blocker is the **recipient session's restored
invocation**: after the boot the Officer session is materialised with its crashed invocation intact and no
run loop; wake deliveries append to a queue that nothing drains, and the only observed drain was the same
delivery attempt that the latch had already suppressed. That seam is
`packages/runtime/src/plugin/live/agent-bindings.mjs` (`ensureLiveAgent` / `deliverReviewWake`), inside the
**ARC-A protected centre**. The fix is therefore an **ARC-A centre-interface override on
`agent-bindings.mjs`** — re-driving a restored invocation for a new pending leg — **plus its own
crash-semantics review**; **neither is in this Preview's scope**, and `CORE PATCH BUDGET = 0` forbids
patching the upstream/host side. That is why this lane ships the finding, the instrument and the register
row instead of an unverified patch, and why the limit is **deferred (owner ruling 2026-11-13)**, not
"hard": `docs/runbooks/REVIEW-WAKE-ACCEPTED-NOT-CLAIMED.md` §3.4 now carries a dated correction beneath its
original table so no operator waits for a wake that does not come.

## 7. Operator meaning (what a Team owner must do today)

- A cold restart **does not lose** the decision or the ask; it loses the *wake* for work minted after it.
- After a Host restart, **check `team_list_pending_control`** before assuming a governed `bash` ask is
  dead. Pending legs are listed with their ids.
- Resolve it with **`team.resolveControl`** (the operator path) — that is the measured, working remedy and
  it unblocks the subsequent wake path as a side effect.
- `team_follow_up` on a crashed Member is **admitted but does not produce an Officer turn**; do not rely
  on it as the restart remedy.

## 8. Residual limits — not claimed

- **n = 3** reproducing runs + **n = 2** controls, one composition, one host pin (`639ed01539`,
  0.2.0-rc.2), one kit. This is not a stability claim and not a rate.
- The observation window is 45 s; a wake arriving later than 45 s would not be counted. Nothing in the
  runs suggests a late arrival (the intent dir was empty at the window end).
- "Wake" here means a **model-visible turn start** carrying `[team-review-wake]` and naming the new
  request id; the kit does not measure delivery-to-inbox separately from turn start.
- No redelivery is claimed for the pre-crash wake; its fate (consumed by the resumed turn) is only
  observed, not proven.
- The root cause is localised to "a restored invocation with no run loop + a queued latch that cannot be
  released" — the exact upstream resume contract was **not** instrumented; the two patches were withdrawn
  precisely because their live behaviour could not be explained to that depth inside this lane.
- Teardown: every non-`--keep` run stopped the live Host and the `LIVE_HOST_AFTER_RESTART` process and
  removed its `DSH_HOME` by verified path. `diag-5`/`diag-6`/`fixed-run1` were produced with `--keep`
  (debugging) and their homes are **removed** in this commit's cleanup; the evidence dirs keep the facts,
  logs and timelines. `:3080` was only probed read-only (`401`).

## 9. Reproduce

```bash
node tests/kits/a6-cold-wake-20261113/a6-cold-wake.mjs \
  --cold-wake --cw-kill after-decision \
  --worktree "$PWD" --testuse /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use \
  --host-port 3194 --mock-port 3497 \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/a6-cold-wake-20261113/repro"
```

Exit code 2 = the finding reproduced (`VERDICT FAIL — failed: COLD-WAKE`). A control run uses
`--cw-kill after-completion`. Ports: host `3181-3199` (3180 excluded), mock `3491-3500`.

## 10. Artifact bundling (2026-11-13) — why each run has one `artifacts.json`

The repository budget `scripts/integration-order.mjs` `BOUNDS.maxCandidates = 6000` ("committed `.json`
under `dev/agent-workflow/evidence`") is a hard ceiling: at `origin/master` `28b083d9a` the tree already
carried **5983** such files, and this lane originally added **53** more, so the bound was hit
(**6036 > 6000**) and `tests/u7-3-devex/devex-integration.test.mjs` E4/E5 failed on this branch — a real,
PR-caused red, not a pre-existing one. Rather than raise a repo-wide bound from inside an evidence lane
(an owner measurement, not this lane's call), the per-run JSON was **bundled without loss**:

- `cw-facts.json` (the measurement itself) and every `.md` / `.log` artifact stay as separate files;
- each run directory now carries **one** `artifacts.json` (`schema: a6-cold-wake-artifacts/1`) holding the
  other eight files **verbatim**: original name → `{bytes, sha256, text}`. Unpacking reproduces them
  bit-for-bit:
  `node -e 'const b=require("./artifacts.json");for(const [n,v] of Object.entries(b.files)) require("fs").writeFileSync(n,v.text)'`
- nothing was edited, summarised, re-serialised or dropped; the sha256 per entry is the check.

After bundling this lane contributes **11** committed `.json` files (5 × `cw-facts.json` + 6 ×
`artifacts.json`; `diag-1` has no `cw-facts.json`), so the tree sits at **5994 / 6000**. That is a
**disclosure to the owner, not a fix of the budget**: the remaining headroom is 6 files, and the next
evidence lane will hit the same wall. The bound should be re-measured and, if evidence is to keep growing,
raised by whoever owns `scripts/integration-order.mjs` — this lane deliberately did not touch it.
