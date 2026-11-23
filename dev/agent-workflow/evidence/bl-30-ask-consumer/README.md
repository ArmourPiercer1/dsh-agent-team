# BL-30 — the ask-disposition approval consumer: the exact invariant that stops the wire-up

**Round 88 · 2026-11-23 · HEAD `4fc75e99e` (+ this round's commit), branch `vnext/a1-cut` · PR #822 (DRAFT)**
**Base of the measurement:** the round-87 D4 live blocker (`dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` §4.2),
`ALPHA5-SANDBOX-BACKLOG.md:559` **BL-30** (`READY`), `:562` **BL-33** (consumption half blocked on BL-30).

This round's task was to wire BL-30: make a call whose compiled disposition is `ask` EXECUTE when, and only
when, a durable one-shot grant exists for THAT call — using the designed consumption seam
`resolveAskClassCall` (`packages/runtime/member-io-policy/src/approval-takeover.ts:206`), which the product's own
source says "has NO production caller" (`provider-capabilities.ts:200-205`, `:315`; `team-services/src/fs.ts:32-39`,
`:175-187`).

**Verdict of this round: STOP, with the invariant MEASURED rather than argued.** No product code was changed and
no consumer was wired, because the seam's contract cannot be satisfied by the only production producer of an
`ask`-disposition approval without changing a Control-plane invariant. The measurement is a new regression arm in
the seam's own suite (below); the reasoning is §3; the routes that WOULD be lawful are §4 and each is a product /
owner decision, not a wiring change.

---

## 1. The two durable mechanisms in play (read, not assumed)

| # | mechanism | what it is | where |
| --- | --- | --- | --- |
| 1 | **the durable Control ask** | the admission lane records an ask as a Control request, waits for the durable decision, and mints a one-shot grant on `allow` | `packages/runtime/src/plugin/vnext/admission-port.mjs:16-24`, `:94-233` (`createControlApprovalPort`), `:592-712` (`completeAsk`) |
| 2 | **the one-shot grant** | a `member-io-policy` invocation-binder CAPABILITY (`singleUse: true`), bound to `memberInstanceId / callId / policyRevision / toolBindingIdentity`, consumed exactly once with no `await` between check and mark | `packages/runtime/member-io-policy/src/invocation.ts:158-305`; minted at `admission-port.mjs:682-700`, SPENT at `:770-784` |
| 3 | **the designed ask consumer** | `resolveAskClassCall` → `AskApprovalAuthority` = `ControlService.guardOperation`, which authorizes AND consumes a durable **guarded** allow (check-and-reserve, exactly once) | `approval-takeover.ts:63-71`, `:343-376`; `control/service.ts:4030-4450` |
| 4 | **the refusing plane** | the confined fs / subprocess Provider refuses an `ask`-covered locator with `IO_ASK_REQUIRES_APPROVAL` before the effect | `member-io-policy/src/provider-capabilities.ts:196-210`, `:279-320`; `team-services/src/fs.ts:160-187` |

The live D4 row that produced the verbatim refusal is mechanism 1 + 2 succeeding and mechanism 4 refusing
afterwards (`d4/runs/boot01/wake-measurement.json#workerWrite.result`).

---

## 2. THE MEASUREMENT (real `ControlService`, real adapter, one durable world twice)

New arms in the seam's own suite — **`packages/runtime/test/a5sf-approval-takeover.test.ts`**
(`describe('BL-30 · the admission ask is INLINE, and an inline allow is not a guard token')`).
Both legs use the SAME admission-shaped scope and the SAME fixtures; only the durable row's
`executionCoupling` differs:

| leg | durable row | `guardOperation(scope)` | `resolveAskClassCall(...)` | consumption rows |
| --- | --- | --- | --- | --- |
| **guarded** (control) | `executionCoupling: 'guarded'` | `allowed:true`, then `allow-consumed` on replay | **ok** — one `ask → allow` narrowing | **1** |
| **inline** (what production writes) | `executionCoupling: 'inline'` | **`allowed:false`, reason `no-request`** | **refused `APPROVAL_DENIED`** (`the existing approval authority refused (no-request)`) | **0** |

Verbatim run (`packages/runtime/test/a5sf-approval-takeover.test.ts`, this HEAD):

```
 ✓ test/a5sf-approval-takeover.test.ts (25 tests) 114ms

 Test Files  1 passed (1)
      Tests  25 passed (25)
```

(23 tests before this round; +2 = the two legs above. No existing assertion was changed or weakened.)

**Why the inline leg is the production shape, not a contrived one:** `createControlApprovalPort` hard-codes
`executionCoupling: 'inline'` (`admission-port.mjs:163`), and the round-87 live row proves it —
`d4/runs/boot01/control-ask.json`:

```json
{"requestId":"ctrl-1xxrzo21k29yc31rawhls0qn","actionName":"admission-ask","toolName":"write",
 "correlation":"admission:call-d4-worker-write","executionCoupling":"inline",
 "subject":{"kind":"instance","instanceId":"inst-0ty67u70r99a"}}
```

---

## 3. THE INVARIANT (what the wire-up would have to bend)

**Control-plane lane disjointness (B2 / plan §D.4): an INLINE allow is NOT a guard token.**

* `packages/runtime/control/service.ts:4155-4165` — the comment that defines the boundary: an inline allow
  "authorizes the frozen invocation's OWN continuation, which writes NO `control-allow-consumed` fact. The
  GUARDED execution path (this guard) must therefore NOT consume or be authorized by it".
* `packages/runtime/control/service.ts:4289-4291` — the enforcement: `if (request.payload.executionCoupling ===
  CONTROL_EXECUTION_COUPLINGS.INLINE) continue`, so the row falls through to `NO_REQUEST`.
* `packages/runtime/src/plugin/vnext/admission-port.mjs:76-79` — the producer's own statement of the law:
  "the durable allow is **not a reusable guard token** and the exactly-once law is the one-shot grant."
* `packages/runtime/control/service.ts:4600-4700` — the other half of the same design: only an INLINE request
  is durably ABANDONED when its wait is aborted, which is what makes a **Stop beat a pending ask**
  (`ADM-57`, and the round-62 live stop arm).

Therefore, with the product as it stands:

1. `resolveAskClassCall` can only be satisfied by a **guarded** durable allow (measured above). The admission
   lane must stay **inline** to be awaitable per-invocation and to keep the Stop-cancels-the-ask law. The two
   requirements are mutually exclusive for one row.
2. The provider plane runs **after** the host tool guard (`tools/pre-execute` → guard → body; `fs.ts` is only
   ever reached from the body), and that guard has already **spent** the one-shot grant
   (`admission-port.mjs:770-784`). So even if the provider were handed the call id, the single-use capability is
   `CAPABILITY_CONSUMED` by then: a provider-level consume would be a SECOND consumption of one approval, and a
   provider-level "already consumed?" check would be a second authority over the same one-shot bit (the binder
   exposes no lookup by call id, and adding one is a P1-04 contract change).
3. The provider plane has **no** Control reference at all (`packages/runtime/team-services/src/**` has none —
   `install.ts` / `mount.ts` / `product-assembly.ts` never see `controlServiceRef`), no TeamSession root, no
   `MemberPolicy`+`ToolIoRestriction`+`InvocationAuthority` tuple to recompile with, and no call identity. Its
   only per-call channel is the ambient `tools/execute` attribution store
   (`team-services/src/guard-observability.ts:170-189`), whose own contract forbids exactly this use:
   "ATTRIBUTION ONLY … it is never an admission input and never widens, selects or reorders a policy."

So the three ways to make the granted ask execute are all invariant changes, not wiring:

| route | what it costs |
| --- | --- |
| **(a) flip the admission ask to `guarded`** | one approval would gain TWO one-shot paths (the binder grant + `guardOperation`'s `control-allow-consumed`) — i.e. two authorities over one decision; and the Stop cascade would stop abandoning a pending ask (`ADM-57`, round-62 live stop) because `inlineAbortCascade` gates on `inline` |
| **(b) substitute a different `AskApprovalAuthority`** (the binder, a "was it consumed?" query, or a new per-call registry) | the R1 contract explicitly refuses this: "a structural stand-in that skips the durable row does NOT satisfy the law this adapter documents" (`approval-takeover.ts:63-68`); it is the "second approval authority" the round's hard rules forbid, and the binder capability is already spent before the body |
| **(c) mint a second guarded Control row for the provider plane** | two durable approval rows for one ask = parallel adjudication over one invocation, explicitly forbidden ("keep the consumer single: one call site") |

The nearest LAWFUL shape (route **d**, for a follow-up round and an owner ruling) is not a consumption at all:
the provider would read the ONE decision the centre already enforced — i.e. the admission point would have to
publish, per `callId`, the resolved disposition it already wrote into its `invocation-authority` fact
(`decision: allow`, `laneDecision: ask`), and the confined Provider would narrow its ask on THAT decision
(nothing else widens). That is a new cross-plane read port (an admission-duty *shape* change: the OS plane stops
being an independent refusal and becomes a reader of the centre's decision), which is why it is not this round's
call to make.

---

## 4. What this round changed (and what it deliberately did NOT)

**Changed:** one suite, additively — two arms in `packages/runtime/test/a5sf-approval-takeover.test.ts` that pin
the measured boundary (guarded = consumable, inline = `no-request`/`APPROVAL_DENIED`/0 consumptions). This makes
the STOP a machine-checked fact: if a later round makes an inline allow guard-consumable, or makes the admission
ask guarded, the arm goes red and the coupling invariant has to be re-decided openly (exactly the kind of silent
bend a green suite would otherwise hide).

**NOT changed (deliberately):** no product source file, no `provider-capabilities.ts` behaviour, no
`admission-port.mjs` coupling, no Control service, no new consumer call site, no grant ledger, no second
authority, no upstream/host file, no blueprint/row config, no test assertion loosened, no timeout widened.

---

## 5. Live status (step 4 of the round)

**A booted host still refuses the granted ask, and this round did not re-boot to "re-measure" it: no product
byte changed, so the refusal path is the identical code the round-87 D4 probe measured verbatim** (two agreeing
DEV-LIVE boots, `d4/runs/boot01|02/wake-measurement.json#workerWrite.result` = `IO_ASK_REQUIRES_APPROVAL` from
`provider-capabilities.ts:315`). Spending a DEV-LIVE start on an unchanged refusal would buy no information; the
in-process leg above is the sharper instrument for the boundary itself (it isolates the coupling variable, which
a boot cannot).

**NOT PROVEN — stated, not implied:**
* that any product configuration can make an `ask`-disposition call execute after a grant (it cannot today);
* a live `ask → grant → execute` arm on a booted host (unreachable for the reason in §3);
* the routed Alpha.6 review wake (round 87's `d4:routed-wake` stays REFUTED; the second gap was out of scope);
* the BL-33 consumption half stays blocked on BL-30 (its consistency half is unchanged);
* the ambient-attribution route and route (d) above are DESIGNS, not implementations, and were not prototyped.

---

## 6. Gates (run for this round's commit)

See `gates.log` in this directory for the verbatim output of the required battery
(`dispatch-tests --run --leg ute-vnext-a1`, `test-catalog --max-uncollected 41 --max-excluded 7`,
`ute-cut-closure --check`, `ute-p0-assets --check`, `docs-sync --check`, `place-dist-glue`,
`eb3-ci-required`, the bound vitest leg, `ci-pr-gate --full --census-captures 2`, UTE G1 argv).

---

## 7. Re-run

```
cd packages/runtime && ../../node_modules/.bin/vitest run test/a5sf-approval-takeover.test.ts
# expects: 25 passed (the two BL-30 legs are the last describe block)
```

The D4 live probe (unchanged product): `node tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs --boots 1`
— it will still answer exit `3` (BLOCKED) with the same two seams.
