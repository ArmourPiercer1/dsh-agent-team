A6-STOP-RACE

# A6-12 — where the Stop/consumption race actually is (read-only mechanism note)

Scope: **static code reading only**. No boot, no port, no product change, no commit to
`packages/**`. Written by a delegated mechanism-investigation session on
2026-11-09/10, at the tree named below.

| field | value |
| --- | --- |
| tree read | `master` @ `f31e3d9e2`, candidate content `168266dbf` (same product content) |
| measured candidate | `cand-v0.1.6-1` = `168266dbfe7f2de091d998431bd56ce4dba0dbb5` |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (DSH `0.2.0-rc.2`) |
| upstream files cited | read from that pristine checkout; they are **not** our product and are **not** patched (`CORE PATCH BUDGET = 0`) |
| instrument | `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` |
| adjudication record | `dev/agent-workflow/evidence/c2-adjudication/README.md` §11.2 + `c2b-a6-stop-r*/a6-stop.json` — **not on this tree**; it lives on `origin/task/c2-adjudication-20261109` @ `7c0f90686` (verified: `git branch -a --contains 7c0f90686`) |
| product files touched | none |

Everything below is a `file:line` claim from the tree above. The one thing I cannot
settle statically — which of the awaits in §1.3 actually consumes the measured 83–110 ms —
is listed in §6 as "needs a boot to prove".

---

## 0. Re-read of the raw fact (confirms the adjudicator's number, from their artefact)

`git show 7c0f90686:dev/agent-workflow/evidence/c2-adjudication/c2b-a6-stop-r1/a6-stop.json`:

- durable `allow` decision: `sequence 14`, `createdAt 16:07:59.975Z`
- durable `control-allow-consumed`: `sequence 15`, `createdAt 16:08:00.058Z`
- `fileAfter: ""` (no side effect), `revived: true` (the kit's predicate: a consumption exists
  for the pre-Stop allow).

Delta = **+83 ms**, exactly the reported band. Note the kit's naming: `lateDecision` is
*not* the late allow (that one is refused `CONTROL_REQUEST_DECIDED`, seq-14 stays last);
`lateConsumption` is the **pre-Stop human allow's** consumption. So the kit's `revived`
predicate is `file-marker OR consumption-exists-for-the-pre-Stop-allow`
(`c1-leader-approval-smoke.mjs:1785`).

---

## 1. The path: allow decision → consumption fact → tool call

Numbers are `file:line` in this repo unless prefixed `[upstream]`.

### 1.1 From the decision to the guard (the PA ⇄ Control bridge)

The member's governed `bash` row is admitted `requires-approval`
(`admission-requires-approval`, seen 4×/boot in the deny-fix runs). The bridge's own header
pins that this is the ONLY production path a `requires-approval` admission takes to a body
(`packages/runtime/operation-permission/pa-control-bridge.ts:5-13`), and the production
wiring is `packages/runtime/src/plugin/live/agent-bindings.mjs:3206-3245`.

Ordered path for the consumed leg:

1. `packages/runtime/src/plugin/live/team-tool-plane.mjs:1112-1120` — PA edge pre-check:
   an already-aborted invocation returns `{kind:'allow', cancelled:true}` with zero row.
2. `team-tool-plane.mjs:1274` — `controlLeg({ …, signal })`: the host cancel signal rides
   the leg input.
3. `pa-control-bridge.ts:448-516` — `requestApprovalLeg` writes the durable request row
   (the human leg is an escalated case leg; the kit's `reviewAuthority:human-user`).
4. `pa-control-bridge.ts:558-566` — `awaitApprovalCaseDecision(...)`: the durable wait.
5. `pa-control-bridge.ts:605` — `observe({stage:'decision-arrived'})`.
6. `pa-control-bridge.ts:619` — **cancellation checkpoint #1** (mint-time), `cancelled()`.
7. `pa-control-bridge.ts:628-652` — rung re-check via `assembly.planApproval`.
8. `pa-control-bridge.ts:671` — `await assembly.issueApprovedGrant(...)` (mint).
9. `pa-control-bridge.ts:683` — **cancellation checkpoint #2** (pre-consumption), `cancelled()`.
10. `pa-control-bridge.ts:691-702` — the exact guard scope object is built (sync, no await).
11. `pa-control-bridge.ts:705` — `await deps.controlService.guardOperation(scope)`.

### 1.2 The consumption write (inside the per-team lock)

`packages/runtime/control/service.ts`:

- `:4004` `guardOperation(scope)`; `:4085` `withTeamLock(teamLocks, root, async () => {`
- `:4181-4193` durable-abandon fence (see §2)
- `:4263-4273` already-consumed check (`allow-consumed`)
- `:4311-4312` `await checkExternalOperation(...)`  — await
- `:4335` `await recheckConsumedAuthority(root, request.payload)` — await
- `:4359` `paManifestClassOf(request.payload)`; `:4366-4378` `await paEffectsDenyReason('guard', …)` — await
- `:4394` `if (corruptLeg !== undefined) return corruptLegVerdictOf(...)` — the file's own
  "LAST look before the durable write" slot
- `:4395-4407` `await putEntry({ …, factType: FACT_CONSUMPTION, … })` — **the consumption fact
  is written here**; `FACT_CONSUMPTION = 'control-allow-consumed'` at `:319`
- `:4408-4412` `return { allowed: true, requestId, decisionSequence }`

### 1.3 From the guard verdict to the tool call

12. `pa-control-bridge.ts:718-725` — the verdict must PAIR to this request + decision
    sequence, else deny.
13. `pa-control-bridge.ts:733-739` — returns `{decision:'approve', grant, manifest}`.
14. `team-tool-plane.mjs:1546-1556` — `paAdmitBody` = `paAdmitPartA` (steps 2-13, which
    already consumed) **then** `paAdmitEdge`.
15. `team-tool-plane.mjs:1496-1498` — **execution-edge cancel check**:
    `if (signal?.aborted === true) return {kind:'allow', cancelled:true}` — **after**
    consumption, **before** the body.
16. `packages/tools/a5p5-tools/src/pipeline.ts:120-146` — `pa.kind==='allow' && cancelled`
    → renders a `cancelled` settlement, **zero backend**.
17. Only if not cancelled: `pipeline.ts:196-201` `await deps.backend.run({…, signal})` — the
    actual shell body. (Had it run, the effect file would be non-empty; it is `""` in 6/6.)

So the observed shape is exactly reproducible from the source: **consumption is written at
step 11, the body is refused at step 15.** That is why `consumed=true` and `file=""` are not
in tension — they are two different fences, one before the body and none before the write.

---

## 2. Does a fence exist today?

**Yes — four of them, and every one of them is on the wrong side of the write, or is only a
snapshot of the in-memory abort.**

The closest existing guard, quoted:

```ts
// pa-control-bridge.ts:679-687
// A5-M1 item 4: the consumption-point cancellation checkpoint. The
// minted one-shot grant stays behind the refusal (never handed back to
// a dead invocation); the durable Control state is untouched — no
// guard call, hence zero consumption.
if (cancelled()) {
  return deny('the invocation was cancelled after the grant was minted and before the durable consumption; the minted grant is not returned (zero PA consumption, zero body)', record.requestId)
}
```

What it covers: a cancellation that is **already observable at the instant that line runs**,
i.e. before `guardOperation` is entered. It also covers the mint (checkpoint #1 at `:619`
covers the same instant after the decision arrived), and the two earlier edges
(`team-tool-plane.mjs:1112` before any row; `pa-control-bridge.ts:537` before the wait).

What it does **not** cover: **the gap between `pa-control-bridge.ts:683` and
`service.ts:4395`.** That gap contains at least four `await`s (`:4311`, `:4335`, `:4366`,
`:4395`) plus the durable `allocateSequence()`/`putEntry`. Nothing in the guard re-reads
cancellation, and the control service never receives the signal at all: `ControlOperationScope`
(`pa-control-bridge.ts:691-702`, built from `types.ts` `ControlOperationScope`) has no cancel
field, and `guardOperation`'s input is "the DURABLE row and nothing else"
(`service.ts:3846-3852`).

The durable half of a fence exists but is never armed on Stop:

```ts
// service.ts:4181-4193 — the abandon terminal mark outranks a prior allow
if (abandon !== undefined) {
  return { allowed: false, reason: CONTROL_GUARD_BLOCK_REASONS.REQUEST_ABANDONED, … }
}
```

This *would* refuse the consumption if a `control-request-abandoned` fact existed. Nothing
writes one on Stop: the bridge only abandons on a **bounded-wait timeout**
(`pa-control-bridge.ts:589-597`), and the router's inline path only on its own signal
(`packages/runtime/action-router/router.ts:583-600`). A plain `session/cancel` writes no
durable row at all (§3).

**One-branch answer.** There is not a leader-vs-member asymmetry inside the bridge — the
bridge is the same code for both planes (`agent-bindings.mjs:3206-3245`, `a5IsLeaderPlane`
only picks `beneficiaryAuthority`). But the **team-tools guarded path has no cancellation
fence at all**: `packages/tools/src/tools.ts:344-352` builds the guard scope from five fields
and never forwards `ctx.signal` (it is only forwarded to the runtime action at
`tools.ts:370-373`). So `team_delegate` / `team_collect` / the other guarded team tools can
consume an allow after a Stop with no checkpoint anywhere, while the PA bridge at least
*has* three. That asymmetry is real and is the larger of the two.

Finally, the wiring detail that decides how much the three checkpoints are worth: production
never passes the bridge's `deps.signal` (`agent-bindings.mjs:3206-3245` has no `signal` key),
so `wiringSignal` is `undefined` and the only live source is the per-call `input.signal`
(`pa-control-bridge.ts:532-536`). The signal chain that makes it
live at all is §3.

---

## 3. Where the Stop lands

1. Kit: `POST /api/session/cancel {method:'session/cancel'}` on the **worker member's**
   `childSessionId` (`c1-leader-approval-smoke.mjs:440-447`, issued at `:1767-1769`).
2. `[upstream] packages/api/session-controller/src/commands.ts:511-524` —
   `cancel(request)` finds the live agent and calls
   `agent.cancel({kind:'user'}, {keepInbox:true})`, then returns `{accepted:true}`.
   **`A6-11` PASS is this acknowledgement and nothing more** — the kit asserts
   `status===200 && result.ok===true|accepted===true` (`:1786-1788`). It is a "the RPC was
   admitted" fact, not a "the turn stopped" fact.
3. `[upstream] packages/core/agent-loop/src/agent.ts:175-182` —
   `if (this.phase.kind !== 'idle') this.phase.abort.abort(cause)`.
4. `[upstream] packages/core/agent-loop/src/agent.ts:270` —
   `const signal = this.phase.abort.signal` (per-turn/step); passed to
   `executeToolCalls(…, signal, …)` at `:534-537`.
5. `[upstream] packages/core/agent-loop/src/tool-calls.ts:65,79` — the same signal becomes
   each `ToolExecutionInput.signal`; `[upstream] packages/core/tools/src/index.ts:351`
   (`ToolExecution.signal`).
6. `packages/tools/a5p5-tools/src/register.ts:243` (`exec.signal`),
   `:267` (onto the pipeline request) → `pipeline.ts:130-133` (onto the PA edge) →
   `team-tool-plane.mjs:1067-1069,1274` → `pa-control-bridge.ts:521-530`.

**What state it sets:** an in-memory `AbortSignal` abort whose `reason` is the closed
`{kind:'user'}` object (`agent.ts:73-93` reads the same union back for `turn/end`). It is
**turn-scoped and non-durable**: it lives on `this.phase.abort`, is discarded when the phase
returns to `idle` (`agent.ts:258-265`), and `cancel()` on an idle agent is a no-op
(`agent.ts:175-182`). `keepInbox:true` deliberately retains queued work, so Stop withdraws
*continuation*, not the inbox.

**Is that state observable to the consume step at the moment it runs?** It is observable in
principle — it is the same object the whole chain above carries — and it *is* read at three
sites (`pa-control-bridge.ts:537/619/683`). It is **not read at the one site that matters**
(`service.ts:4395`): the service has no parameter for it, and by construction
"the DURABLE row and nothing else" (`service.ts:3846-3852`). The 83–110 ms figure is
therefore not "the consume step is past its last check by a hair"; it is the entire span
between the last check (`:683`) and the write (`:4395`), which the guard spends in its own
awaits.

**Two Stop shapes are NOT this mechanism and must not be conflated with it:**
`docs/PREVIEW-STOP-SEMANTICS.md:9-16` (the UI's *Stop this Member* = `goals/pause` +
`session/cancel` + durable re-read) and the Alpha.6 Sticky Stop (durable `stopped-*` marker,
`root.ts:2764-2770`, latch-scoped per PD-40). The A6 kit issues the **bare** `session/cancel`
— no goal pause, no durable marker (also why `A6-22` markers are empty in the kit's own
config, and why the consumed boots carry no `control-request-abandoned`).

---

## 4. The smallest honest fence

**Site:** `packages/runtime/control/service.ts:4394-4395`, i.e. the slot the file already
reserves for "the LAST look before the durable write" (`:4389-4394`, the corrupt-leg check),
immediately before `await putEntry(...)` at `:4395` — **inside** the existing per-team lock.

**What it must read:** the state Stop sets, i.e. the invocation's live abort signal, and
nothing else — no new authority, no new durable read. Concretely an optional probe on the
scope, e.g. `ControlOperationScope.cancelProbe?: () => boolean`, set by
`pa-control-bridge.ts:691-702` from the existing `cancelled()` (`:536`) and by
`packages/tools/src/tools.ts:344-352` from `ctx.signal` (which is how the team-tools branch
gets the fence it currently lacks). The service must **not** start reading an AbortSignal off
its own wiring: per-call identity is the only correct granularity.

**On a trip:**

1. **Refuse** with a new closed reason, e.g.
   `CONTROL_GUARD_BLOCK_REASONS.INVOCATION_CANCELLED` (`control/types.ts:1856-…`, 1 value +
   doc). The refusal has to be a *value in the closed set*, because
   `packages/tools/src/guard.ts:78-90` proceeds on `no-request` and blocks on everything
   else; a boolean or a throw would be read as a different failure.
2. **Write the durable record**: the **existing** terminal abandon fact via
   `commitAbandonmentFact(root, requestId, 'invocation-cancelled-before-consumption')`
   (`service.ts:3650-3653` documents that "A DECIDED request may still be abandoned: that is
   the allow-invalidating path — the abandon closes the durable allow"). Zero new fact type,
   zero new vocabulary. This matters: refusing **without** the abandon would leave a still
   spendable allow on the ledger, i.e. it would trade a burned approval for a leaked one.
3. Return `{allowed:false, reason, requestId, decisionSequence}` — the same shape as
   `AUTHORITY_RISEN` (`:4336-4343`), so the bridge's existing deny path
   (`pa-control-bridge.ts:713-720`) renders it without new plumbing.

**Size:** product code ≈ **20–25 lines over three files** —
`control/types.ts` 1 reason + 1 optional scope field (~5), `control/service.ts` ~14 (probe +
abandon), `pa-control-bridge.ts` 1 line in the scope literal, `packages/tools/src/tools.ts`
1 line — plus one host-free test. That is under the ~20-line rule **only if** you accept the
next paragraph; if not, it is a design gap and the line count is a lie.

**Why it is a narrowing, not a closure — read this before shipping it.** The probe is read at
one instant; `await allocateSequence()` + `putEntry` still await. A cancel landing in that
window still consumes. So the fix converts an ~80–100 ms unfenced window into a
microtask/IO-sized one. Closing it *properly* requires the consume commit to be conditioned
on a **durable** stop fact, which means Stop must write durable per-invocation state first —
exactly the class of change PD-40 already ruled out for the Sticky Stop
(`RELEASE-NOTES-0.1.6.md:139-145`: "a session-scoped durable marker is a design change with
crash semantics … not attempted here"). Upstream's `session/cancel` gives us only an
AbortSignal, and `keepInbox:true` means even the turn-scoped state is gone once the phase goes
idle.

So the honest framing for the owner:

- If the requirement is **"a human Stop must never burn an approval that has not executed"**,
  the ~20-line probe is the right *first* step and it will move 4/6 toward 0/6 in practice,
  but it cannot be claimed as a guarantee, and the guarantee-level fix is durable stop state =
  design change.
- If the requirement is **"the ledger must never say `consumed` for an allow whose body was
  refused"**, that is unsatisfiable without durable stop state: the consumption write and the
  body refusal are two different fences (§1.3) and no ordering of them removes the window.

---

## 5. Is "in-flight work completes after Stop" an existing documented promise?

**Partly — and the honest reading is the second one you offered: the docs promise Stop
interrupts the turn, disclose a millisecond window for *already-started execution*, and do
not disclose a consumed-but-never-executed approval.**

Quotes (all verified in-tree):

- `docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md:130-132`:
  > "**Stop means "no continuation after the durable `pause` is ACKed", not "no execution after
  > the click".** There is a millisecond-scale window between the click and the pause ACK in
  > which a tool call may already have started. The number is measured and disclosed, not
  > hidden."
- `docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md:52-53`:
  > "Stop withdraws goal continuation (durable `paused`, no new round after the ACK)." /
  > "after the durable `pause` is ACKed, there is no continuation (no new round, no new model
  > request)."
- `docs/plans/active/alpha5-sandbox-first/PREVIEW-CONTRACT-2026-11-16.md:159-165` (§3.1 "Stop
 的保证"): the promise is again "durable `pause` ACK 之后不再有 continuation", with the
  measured S1c sequence `goals/get → goals/pause → session/cancel → goals/get`.
- `docs/PREVIEW-STOP-SEMANTICS.md:60-72` (§2.1) is the most explicit:
  > "Stop **不是瞬时**的。… 在这个窗口里被接纳的调用仍可能在 pause 之后才完成（它已经在执行，
  > pause 只是撤掉后续续轮的授权，不是回滚已经开始的执行）。… 所以本入口可以辩护的保证只有一条：
  > **"`goals/pause` 被确认（ACK）之后，不再有新的续轮。"** 不是"点击之后没有任何执行"。"

- **No row covers this race**: `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md`
  has PD-30 (GOAL-STOP), PD-34 (MEMBER-STOP), PD-35 (STOP-OUTCOME), PD-40 (STICKY-LATCH) — a
  grep for `stop|consum|race|in-flight` finds no row about a consumed allow with no execution.

Three honesty notes on the doc side:

1. The disclosed window is about **execution that already started** finishing. The measured
   case is the opposite: **execution was refused** (`file=""` 6/6, §0) and the approval was
   burned anyway. No doc sentence describes that shape.
2. The documented Stop is the **durable-pause** Stop. The kit issues the **bare**
   `session/cancel` (no pause), so the kit measures a strict subset of the documented entry —
   under the doc's own wording there is no ACK to hang a guarantee on. That makes the kit's
   `A6-12` text ("Stop before consumption prevents execution",
   `c1-leader-approval-smoke.mjs:1789`) a **claim stronger than the product documents**, and
   the product's own code (steps 1, 14, 16 in §1.3: `cancelled → zero consumption`) shows
   that the *stronger* claim is the intended semantic. So this is not the docs' disclosed
   limit; it is a gap **under the product's own fence order**, which happens to be stricter
   than the release note.
3. Practically: the 0.1.6 note lets the owner say "not a defect, a disclosed window" — but
   only by quoting a window about started execution, for a Stop shape (bare cancel) the note
   does not describe. I would not make that argument.

---

## 6. What needs a boot to prove (not asserted here)

1. **Which await owns the 83–110 ms.** Statically the window is `:683 → :4395` and contains
   `checkExternalOperation`, `recheckConsumedAuthority`, `paEffectsDenyReason`,
   `allocateSequence`, `putEntry`. Which of them dominates is a measurement, not a reading.
2. **The abort's actual delivery instant** relative to `:683`. The 4/6-vs-2/6 split is
   explained by whether the abort lands before or after `:683`; a boot with timestamps on
   `cancelled()` and on `putEntry` would settle it. (Consistent with the source, but not
   proven by the source.)
3. **Whether the probe fence moves 4/6 to 0/6.** Predictable, not measured — and it will not
   be 0/6 with certainty, per §4.
4. **Whether the team-tools branch (`tools.ts:344`) can actually hit this in production.**
   The missing `ctx.signal` forward is a reading; whether a Stop can land inside
   `guardOperation` for those tools on a live host is a boot.
5. **The kit's oracle**: `revived = marker OR consumption` conflates "the call revived" with
   "the approval was spent". Whether `A6-12` should count a consumed-but-unexecuted allow as
   a failure is an owner decision, not a code fact. (It currently does; the product's own
   `cancelled → zero consumption` shape says the kit is right.)

---

## 7. One sentence for the owner

**This is a small fix that is honestly a design gap: the last cancellation read is
`pa-control-bridge.ts:683` and the consumption write is `control/service.ts:4395`, with four
awaits and no cancel probe between them — a ~20-line probe at `service.ts:4394` (plus a
closed `invocation-cancelled` reason and the existing terminal abandon fact) narrows the
window from ~80–100 ms to a microtask but cannot close it, because Stop sets only an
in-memory, turn-scoped AbortSignal (`agent.ts:175-182`) and the durable close-out required for
a guarantee is the same class of change PD-40 already declined.**
