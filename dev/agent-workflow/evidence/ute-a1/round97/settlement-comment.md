**[dated label settlement, 2026-11-24 — the Alpha.6 ROUTED WAKE is PROVEN LIVE, head `9bf67b43dd0725a5afe3b1b1b5d6ec9318c3805f`]**

Round 97 on `vnext/a1-cut`, branch head **9bf67b43d**. Sole writer worktree
`.worktrees/vnext-a1-cut`; no other worktree, no history rewrite, no merge, no port-3080 contact,
PR #822 stays **DRAFT and unmerged**. The full `ci-pr-gate` ran at `6364e4398`; its only successor
(`9bf67b43d`) adds this gate log.

## What this round had to prove, and did

The mandate was a LIVE acceptance of `d4:routed-wake`: a qualifying worker ask → a durable approval
CASE → the product router selecting the Officer → a governed wake intent + confirmation → the Officer
woken in its OWN session → the Officer resolving under its OWN binding → the decision returning to the
worker's call → the granted call executing under the receipt. **All seven links are PROVEN on two
agreeing DEV-LIVE boots**, as seven independent judges (40 clauses), each answered from durable bytes.

## The world that qualifies (no fabrication)

One coherent v5 row satisfies the closed rule `ALPHA6-ORDINARY-CASE-Q`:

- `reviewRouting: { enabled: true, officerTemplateId: 'officer', ordinaryToolApprovals: { default:
  'officer', leaderExceptions: [] }, whenOfficerUnavailable: 'hold' }`;
- the worker template declares `toolBindings: [{ owner: 'dsh.fs', name: 'write', authorization: 'ask',
  io: {…}, execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' } }]`;
- the admission lane for the target path is `ask`, and the round-94 algebra keeps that pure-ask lane
  an `ask` instead of collapsing it (the G11 fix);
- `a5sfNativeToolModules` mounts the real FS tool module; the model is scripted (the only double).

**No case identity, leg, fact, route or decision is fabricated by the driver.** The case id, leg
ordinal, operation fingerprint, authority scope, tool coordinate, blueprint hash/revision, generation,
route, wake token, decision and settlement are all read back from the product's own durable stores.

## Per-judge evidence (40 clauses; identical on both boots)

| judge | clauses | what the durable bytes say |
| --- | --- | --- |
| `d4:case-created` | 9 | `control-request-recorded` seq 9 carries `approvalCaseId case-0dotsl405xthlb0lqsqo21tg`, `legOrdinal 1`, `reviewAuthority/requiredAuthorityAtCreation 'leader'`, `operationFingerprint sha256:3c15e01d…`, `authorityScope {operationClass:'write', matcher:{kind:'exact', resource:…/worker-ask.txt}}`, coordinate `dsh.fs/write`, `blueprintContentHash sha256:47c096399d0…`, `authorityGeneration 0`, `blueprintRevision '1'`; zero decisions at capture |
| `d4:router-officer` | 4 | `route() → {kind:'recipient', target:{kind:'instance', instanceId:'inst-1crltnl0089j', templateId:'officer', routeRole:'officer'}}`, `reason:'closed ordinary tool ask delegated to the dedicated Officer'`; exactly **one** active officer candidate; requester `inst-0ty67u70r99a` ≠ reviewer; the self-ask control (same row, operation owner = the Officer) routes to the **Leader** — `reason:"actual OperationOwner is the Officer; self-ask routes to Leader"` |
| `d4:wake-delivered` | 6 | one `team-review-wake-routed` intent (token `review-wake:session-dboot-d4-root:inst-1crltnl0089j:1:a6wake%3Av1%3A1%3Ad4fdab8d`, payload `action:'review-wake'`, `deliveredToSessionId:'session-team-child-1d56…'`, non-empty `at`), **one** correlated `team-review-wake-delivered` (`factSequence` = the intent's), the Officer's wake inputs are `["plugin:dsh-agent-team","plugin:dsh-agent-team","plugin:dsh-agent-team"]` (never `user`), and **zero** settlements name the wake token — the management plane executed no tool |
| `d4:officer-decides` | 5 | Officer session `session-team-child-1d56dbb16a118ba3573db3c4b2641997` holds the wake for THIS leg; its `team_resolve_control` (`call-d4-officer-resolve-ctrl-…`) is present with a real `control-resolved` result; its centre ledger has the `invocation-authority` **allow** for that callId under `inst-1crltnl0089j` (axis `team.control`); settlement `COMPLETED`; the Leader's transcript has **no** resolve for the leg |
| `d4:ask-executes-after-review` | 6 | decision `at 01:20:50.035Z` precedes the settlement's terminal transition `01:20:50.175Z`; the worker's `write` result is not an error; the file holds the approved **27 bytes**, `sha256:ced10112e5b82a2b1b6bca1b85b1dff242db7e9820aa4a1b6332f3096bdf28c3`; an `invocation-authority` allow on the `ask` lane for `call-d4-worker-write` (axis `fs.write`); settlement `COMPLETED`/`completed` |
| `d4:duplicate-route` | 5 | leg 2 (`ctrl-0bkr20v0sxrdew191ixo11jr`) was routed by BOTH real call sites — the request-creation notifier and the reviewer `turn/end` re-collection — while still pending (`intentAt 01:20:50.245Z` < `decisionAt 01:20:50.382Z`): exactly **one intent, one confirmation, one model-visible input** |
| `d4:sticky-stop` | 5 | a REAL human `session/cancel` of a running Officer turn wrote `stopped-20765e07.json`; a THIRD worker ask (`ctrl-1pegi2p04d03sm0qi9cmv046`) was admitted and routed while stopped; the marker survived (`markersAfter=[stopped-20765e07.json]`), **0** wake inputs reached the stopped Officer, delivery refused; an explicit HUMAN prompt cleared the marker, the held wake was delivered, and the third `write` executed — settlement `COMPLETED`, file **29 bytes**, `sha256:2b28991b1453c91d156a15f550556549cbdbcb5856aa833b3fcfa7d5b3d1ea0e` |
| **`d4:routed-wake`** | conjunction | **PROVEN** |

**Two-boot agreement:** `agreeing=true`, `differing=[]`. Counters identical on both boots:
`wakeFacts 6`, `routedWakes 3`, `deliveredWakes 3`, `managementExecutions 0`, `officerAllowFacts 1`,
`officerResolveSettlement COMPLETED`, `legOrdinal 1`, `routeKind/routeRole recipient/officer`,
`selfAskRouteKind/Role recipient/leader`, `duplicateWakeInputs 1`, `stickyStopMarkerCount 1`,
`askExecuteBytes 27/27` (sha `ced10112…`), `askExecute2Bytes 29/29` (sha `2d71ffdd…`),
`askDenied/askStopped` → **0 bytes**, settlements `REFUSED`.

**The eight pre-existing judges are byte-identical** (`d4:enablement`, `d4:officer-up`,
`d4:officer-binding`, `d4:refusal`, `d4:ask-execute`, `d4:ask-execute-2`, `d4:ask-denied`,
`d4:ask-stopped`) and still PROVEN, including the two negative live arms (deny → zero bytes
`REFUSED`; Stop-while-pending → no bytes, `REFUSED`, `not-started`).

## Product defects found and fixed: NONE

**No production code changed in round 97.** The only driver change beyond the seven judges and their
mock arms is a MEASUREMENT fix: the second ask is now waited for on the durable ledger
(`control-request-recorded`) instead of the `/__p6t6/state` pending projection — the Officer can settle
a leg inside one 300 ms poll, so the projection wait could miss an ask that really happened. The
probe's own ledger positive control was tightened accordingly (exactly the 3 requests / 3 decisions
this world observed; a reader that misses one fails). No timeout widened, no retry loop, no judge
weakened, no mock beyond the scripted model.

## Level: **DEV-LIVE** (not PRODUCT-PROVEN)

`CAPABILITY-MATRIX-C` requires a **bound executable gate** for `V@B=yes`; the D4 probe is a driver with
its own evidence contract, not that gate, and the world is a named DEV-LIVE grant
(`devlive-fs-search-1`, world `u5a5sfdev1`). **C-alpha6 therefore moves MECHANISM → DEV-LIVE and no
further.** No gate was invented to lift the level.

## Gate outputs (verbatim token lines, logs in `round97/`)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (35 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=62 passed=222 failed=0 clock_ms=20000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=276.4
UTE G1 argv: tests 89 / pass 89 / fail 0 (exit 0)
```

`ute-vnext-a1`: **240 tests / 237 pass / 0 fail / 3 skipped**, leg digest unchanged
`sha256:edd4f1c4…c8a975` (no test file added in this round — the probe already existed).
Catalog unchanged (`tests=785`, digest `sha256:da8a452d…5f5ed32`). `ute-p0-assets` unchanged
(`modules=37 files=180 lines=69512`) ⇒ **no new scannable-surface file, no p4t6 delta**.
`artifacts-at-head`: `HEAD carries its own build (1950 files, drift 0)`. Census: 2 captures,
identical identity sets, `599f/7422l`.

## What is NOT proven (the honest list)

1. **PRODUCT-PROVEN is unreachable for this row.** No bound suite exercises it; DEV-LIVE is a record,
   not a gate. `V@B=yes` was not claimed anywhere.
2. **Only `write`/`writeText`** carry the live R3 receipt. `editText`/`patchText`/`deleteFile`/
   `moveFile` are mechanism-level (their tools are not shipped in this preset); subprocess/PTY has NO
   receipt (R4, `IO_ASK_REQUIRES_APPROVAL`); rc.5 multi-file `apply_patch` stays unbound (R4).
3. **The duplicate-route attempt itself leaves no durable fact** — the latch's convergence is silent.
   The judge proves the CONVERGENCE (one intent / one confirmation / one input) and records the two
   real product call sites and the durable timing that establish the attempt; it does not claim a
   fact that the product does not write.
4. **The scripted model is the only double**; no real-model interleaving was measured.
5. The receipt still binds `caseId:null` for an inline admission request (round-95 scope, unchanged).
6. **Sticky Stop is latch-scoped** and the human cancel must hit a RUNNING turn (the host's
   `turn/end` listener writes the marker); the arm drives a 40-step HOLD turn to guarantee that,
   which is a driver construction, not a product weakening.
