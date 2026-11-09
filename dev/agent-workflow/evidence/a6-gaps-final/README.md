# A6-GAPS — the two named Alpha.6 audit gaps, measured on `integration/v0.1.6`

**Status: DEV-LIVE evidence.** Branch `task/a6-gaps-20261109`, worktree `.worktrees/a6-gaps`,
product head `9ab4b5768` rebased onto `0f1106ae0` (`origin/integration/v0.1.6`, PR #692).
This is not a `V@B` run and carries no release grade. One writer, branch only, no upstream
source patch (`CORE PATCH BUDGET = 0`), `:3080` untouched; host `3186`, mock `3491`, one boot at a time.

## Gap 1 — a durable `succeeded` execution-result fact on the NORMAL path

**Construction.** Member `bash` ask (`printf ... > c1-a6-allow-<stamp>.txt`) → Officer review wake
→ `team_resolve_control` **allow** → plane consumes the allow → confined bash executes → the
Member's turn completes (`C1_A6_MEMBER_DONE`). Evidence: `a6-gaps-g1-normal-r14/`
(`A6-27` PASS, `outcome=succeeded facts=1`). Negative controls in `a6-gaps-g1-neg-r13/`:
`A6-28` a DENIED call (decision `deny`, zero consumption, zero side effect, no execution-result
fact) and `A6-29` an approved call whose confined spawn fails after consumption (one terminal
`failed` fact, never `succeeded`, Member turn continues normally).

**Two separate defects, and which one was load-bearing.**

1. **Writer (load-bearing).** `packages/tools/a5p5-tools/src/register.ts` placed
   `onExecutionResult` **inside the `request: { ... }` literal**; the spread of that literal
   suppressed TypeScript's excess-property check, so the compiler was silent. `pipeline.ts`
   reads `deps.onExecutionResult`, so the hook was dead data and no fact was written on any
   normal allow. Fixed by moving the key into the deps object, and by forwarding it through the
   family builders (`packages/tools/families/process.mjs`, `search.mjs`; reviewed digests in
   `manifest.json` updated). Before this fix the same live flow produced **zero**
   `control-execution-result` facts (observed on the branch's first pre-fix measurement; the
   failing-run directory was pruned, the base-defect probe is in `a6-gaps-base-defect/`).
2. **Reader (not load-bearing for the write, load-bearing for the observation).** The kit's
   `readControlLedger` only read requests/decisions/consumptions; it never read
   `factType === 'control-execution-result'`. Fixed so the fact is part of the measured read.

Additional writer-arm fix: `pipeline.ts` now wraps `deps.backend.run`; if the backend throws,
it calls `deps.onExecutionResult?.({ callId, outcome: 'failed' })` once and rethrows. The
literal thrown-promise path is covered at the **registered tool row** by the unit test
(`unit-execution-result.log`: 4 passed, 13 skipped; success → one `succeeded`, answered failure
→ one `failed`, throwing backend → one `failed` and rejects, policy deny → zero observations).

**What "durable" means here (store, row, exact read).** The fact is a row in the Team domain
store at `tests/homes/<stamp>/storages/team_domain.json`, under `tables.ledger[<sequence>]`
(sequence keys are strings), with `factType: "control-execution-result"` and payload
`{ requestId, callId, outcome, recordedAt }`. There is **no `phase` field**: the phase is the
fact type plus its sequence position (it is written after `control-allow-consumed`). The read
performed is `readControlLedger` in the kit (JSON parse of that store, filtering by factType);
the same rows were independently re-read by a plain Python JSON parse for this report.

**Live throw limitation (honest).** The model-facing closed shell refused every construct that
would make the backend throw *after* consumption: `workdir` is rejected by the closed schema,
an oversized argv never reaches the model turn, `background:true` leaves the guard request
unresolved, and `cwd` pointing at a **regular file** still exited 0 (`succeeded`). The one form
that produced the terminal arm live is `cwd` = a **nonexistent relative directory**: the anchored
shape admits it, the confined spawn fails after admission + consumption, and the pipeline writes
exactly one `failed` (r13, `A6-29`). The unit test is the control for the literal thrown
promise; the live run is the control for the post-consumption terminal fact.

## Gap 2 — Inbox `ACCEPTED`-but-not-`CLAIMED` crash window

**Construction.** The Officer is held in a real busy turn (direct prompt `C1_A6_BUSY` → `bash
sleep 45`), the Member's ask produces a review wake that the native next-step Inbox **accepts**
(`markAccepted`) while the wake-turn count is still 0; `SIGKILL` exactly there; restart the same
`DSH_HOME` (`create-or-open`). This is the **busy-latch** variant. The **stopped-latch** variant
was not forced: on a stopped latch machine inputs are accepted (200) but never claimed, so the
window is unreachable that way by design — a legitimate "cannot construct this way" result, not
faked.

**Measured result (`a6-gaps-g2-unclaimed-r11/`; `A6-26` FAIL, verdict `abandoned-terminal`).**
`accepted wake=review-wake:...:a6wake%3Av1%3A1%3Aa56bd830`, `busy=true`, wake turns
`0 → 0 → 0`, intent rows `1 → 0 → 0`, after restart **zero claims and zero duplicates**. The
durable PA request `ctrl-007bqk91qmca7m117zpi30ak` is **terminally abandoned**:
`control-request-abandoned` at ledger sequence 11, reason `invocation-abandoned`, zero side
effects. `team.resolveControl` after restart is refused with the typed
`CONTROL_REQUEST_ABANDONED` ("can never become an allow"). The public `team.getLedgerPage`
still returns the request id (discoverable by id); `team.getProjection` reports
`pendingControlCount: 0` — the summary **undercounts** and is a separate P2 defect.

**Classification.** Neither exactly-once nor the audit's stranded-and-resolvable variant: this
base converts the accepted window into a **terminal abandonment** (at-most-once). That avoids
the P1 (no duplicate execution, no side effect) but **drops the review work**: the wake is not
redelivered and the request cannot be resolved; recovery is to re-issue the ask. Under the
audit's two acceptable outcomes the check therefore **FAILs**; the failure is the finding, not
a kit artifact. Also measured:
the **CLAIMED control** (`a6-gaps-g2-claimed-r10/`, `A6-25` PASS) — a wake claimed by a crashed
turn is replaced by exactly one new wake (`wakes 1 → 2 → 2`) and its durable request is
preserved or decided; so claim-time crashes recover, acceptance-time crashes abandon.

## RC blocking (one line)

**Gap 1 was RC-blocking and is fixed here** (the Alpha.6 claim "normal allow → execute writes a
durable `succeeded` fact" was false before the writer fix); **Gap 2 is not P1** (no duplicate
execution — the accepted window ends in a typed, side-effect-free abandonment), but `A6-26`
FAILs and it **is** RC-blocking for the promise that every accepted review wake is eventually delivered/decidable:
on this base it is silently dropped, so either that promise is narrowed and the re-issue
runbook is written, or a redelivery/claim for the accepted state is added before RC.

## Reproduce

```bash
# Gap 1 normal (r14)
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3186 --mock-port 3491 --evidence-dir dev/agent-workflow/evidence/a6-gaps-g1-normal-r14 --keep
# Gap 1 negatives (r13): denial + post-consumption spawn failure
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXEC_NEG=1 C1_A6_RECIPIENTS=1 node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3186 --mock-port 3491 --evidence-dir dev/agent-workflow/evidence/a6-gaps-g1-neg-r13 --keep
# Gap 2 accepted-unclaimed (r11)
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_INBOX_UNCLAIMED=1 node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3186 --mock-port 3491 --evidence-dir dev/agent-workflow/evidence/a6-gaps-g2-unclaimed-r11 --keep
# Gap 2 claimed control (r10)
C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_INBOX=1 node tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port 3186 --mock-port 3491 --evidence-dir dev/agent-workflow/evidence/a6-gaps-g2-claimed-r10 --keep
```

Every run boots one Host on `3186` and one mock on `3491`, writes its DSH_HOME under
`tests/homes/c1-smoke-<stamp>/` (core storage is the durable read), and tears the processes
down; `--keep` retains only the HOME and evidence. `:3080` is never contacted.
