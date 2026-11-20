# UTE-3 — S1 dispatch settlement wiring (evidence)

**Dated:** 2026-11-20 (session calendar). **Work package:** UTE-3 of the UTE G1
round. **Branch:** `task/ute3-settlement-wire-20261120` (one branch, one writer).
**Base:** `origin/master` = `313643100`.
**Deliverable:** `packages/runtime/settlement/dispatch-settlement.ts` (exported
from `settlement/index.ts`) + `tests/ute2-settlement/dispatch-settlement.test.mjs`
and its mutation harness `tests/ute2-settlement/lib/dispatch-mutations.mjs`,
booked by `packages/testkit/test/p4t6-bookings/ute3dispatchsettlement.json`.
**Not touched:** the production execution route, the legacy ToolPlane / Family
Body files, upstream, the retirement ledger, any Authority pointer, any approval
record. No production path imports or registers the wrapper.

## 1. The seam, and why it is the earliest durable-intent point

`definition.execute(args, exec)` — the tool definition's body entry, with the
host's `exec.callId` in hand. The wrapper is built on the same shape the product
already uses for the adopted native shell (`native-bash-tool.mjs`,
`registerWithAdmission`: admit → `definition.execute` → settle).

Later Team-owned seams are observation/decision seams, not dispatch gates:

- `packages/runtime/tool-dispatch/install.ts`: `tools/pre-execute` resolves before
  the Body but is a waterfall used by the permission lane; `tools/execute` resolves
  **after the Body is ENTERED** (stated in that file's own contract comment), so an
  admission written there is already after the effect window began;
  `tools/post-execute` fires with the projected result in hand.

The definition `execute` is therefore the earliest point where (a) the code that
is about to produce the effect is still in front of us and (b) a trusted call
identity exists. Arguments (model-controlled) are never used for identity.

## 2. The ordering proof (S1)

`recordAdmission` (durable: temp file → fsync → atomic rename → parent-directory
fsync) → `enterRunning` → the inner `execute`. The body's first line can read a
booked `ADMITTED` transition and a durable `RUNNING` record; the terminal fact
carries the real observed outcome and a `ContractExecutionFact` so the frozen
reader surface (`read`, `listUnsettled`, `projectControlResult`) answers.

The ordering control mutates only the wrapper source: it moves the admission and
dispatch-entry writes after the body call. The scenario then observes the body
running with **no** record (`stateAtBody=absent`) and turns RED. No result-only
assertion can pass that mutant.

`recordAdmission`/`enterRunning`/`settle` are the store's transition surface. The
frozen four-method `ExecutionSettlementWriter` cannot express (a) an open
`RUNNING` record or (b) an `allow|deny` admission verdict; the wrapper states this
explicitly and attaches contract facts to every transition rather than inventing a
second writer. If review wants the ladder behind the frozen interface, §3.1 needs
a fifth method.

## 3. Crash window (real SIGKILL)

A real child imports the store + wrapper from the real `.ts` sources, records
admission, enters dispatch, writes its effect file, and `SIGKILL`s itself inside
the body. Parent observations:

```
UTE3-CRASH-WINDOW signal=SIGKILL effect-written=true durable=RUNNING recovered=UNKNOWN
  missing=terminal-observation|host-result|backend-receipt
  late-terminal=SETTLEMENT_CONFLICT projection=PASS-refused
  replay=A5_SETTLEMENT_REPLAY_REFUSED never-COMPLETED=true
```

No path reports COMPLETED/PASS: a late `writer.record(completed)` is
`SETTLEMENT_CONFLICT`, `projectControlResult(outcome:'succeeded')` is
`recorded:false` with no `requestId`, re-dispatching the same call id is refused
before the body (`A5_SETTLEMENT_REPLAY_REFUSED`), and the recovered fact is
terminal UNKNOWN naming the missing evidence.

## 4. S1 / S2 split (honest)

**S1 (proven here).** For a wrapped definition: a durable admission exists before
the body may run; a hard death mid-effect is recovered as UNKNOWN with named
missing evidence; a terminal fact is never re-driven and never fabricated.

**S2 (NOT claimed).** "The durable commit is complete before the model sees
`tool/result`." The wrapper awaits its terminal write before `execute` returns,
but `execute` is not the model-visible result path (post-execute projections,
rendering, and host result traffic can happen after it, and a streaming body can
emit before it returns). Proving S2 needs an awaitable public seam before
`tool/result`; none is known in the pinned host, so this stays
`CORE_SEAM_BLOCKER` — never a listener dressed up as an ordering proof, never a
core patch.

## 5. Single writer

One wrapper captures exactly one store at construction; mutating the options
object afterwards cannot move a settlement to a second store (control RED:
`storeA=0 storeB=1` on the mutant, `storeA=1 storeB=0` on the real module). A real
second **process** opening the same root is refused by the store's own lock
(`SETTLEMENT_WRITER_CONFLICT`). Multi-process settlement is not promised.

## 6. Negative controls (5/5 RED on the mutant, GREEN on the real module)

| control | mutant | real | mutant |
|---|---|---|---|
| admission-after-dispatch | ordering | `stateAtBody=RUNNING firstTransition=ADMITTED` | `stateAtBody=absent firstTransition=absent` |
| fabricated effect | fabricated-effect | `effectEvidence=none-confirmed observed=0` | `effectEvidence=observed observed=1 ids=assumed-by-mutant` |
| changed tool result | result-changed | `identical=true addedFields=[]` | `identical=false addedFields=[settlement]` |
| replay of a recovered execution | replay-fabricated | `A5_SETTLEMENT_REPLAY_REFUSED bodyCalls=0 state=UNKNOWN` | `returned/<object> bodyCalls=0` |
| second-store binding | store-binding | `storeA=1 storeB=0` | `storeA=0 storeB=1` |

The malformed-observation arm (observed claim with no witness) is refused by the
wrapper itself (`EFFECT_CLAIM_WITHOUT_OBSERVATION` /
`A5_SETTLEMENT_OBSERVATION_REFUSED`), reported through `onSettlementError`, the
record keeps the truthful `COMPLETED`/`none-confirmed` fact, and the tool result
is still returned by identity.

## 7. Measured gates (verbatim)

```
EB3-CI-REQUIRED pass workflows=10 findings=0
DSH-TEST-CATALOG tests=883 digest=sha256:957b9166c09a517d4d1329c846773419eb98fc539b7e422b7534e17e4ee07159 refused=0 findings=0
EB3-FAMILY-DEFINITIONS pass files=30 findings=0
docs:sync --check: docs=179 notes=4 plans=138(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=2108 glue=113
UTE-RETIREMENT-GATE ledger=dev/agent-workflow/ledgers/ute-retirement.json schema=ute-retirement/1 families=1
UTE-RETIREMENT-REFUSED family=fs codes=UTE_SEMANTIC_DIFFERENCES_UNRESOLVED,UTE_VECTOR_UNREPRODUCED,UTE_MEMBER_UNCOVERED state=NOT_RETIREABLE unit=3/4
UTE-RETIREMENT-SUMMARY requested=1 allowed=0 refused=1   (exit 1 — unchanged FS numbers)
p4t6: 20/20 passed with the booking
```

Lane argv (the EXISTING settlement lane, no new job/leg):

```
node --test --test-force-exit --test-timeout=1500000 --test-reporter=spec \
  tests/next-host/boot.test.mjs tests/next-host/native-api.test.mjs \
  tests/next-host/provisioning-controls.test.mjs \
  tests/world-factory/f10-contract-identity.test.mjs \
  scripts/ute-retirement-gate.test.mjs \
  tests/ute2-settlement/settlement.test.mjs \
  tests/ute2-settlement/dispatch-settlement.test.mjs
```

The host-free part of that exact argv passes locally: **72/72**. The two
pinned-host suites refuse at module load in this fresh worktree with
`NextHostMissingError: TREE_MISSING` (the rc.5 tree is gitignored and was not
materialized here); that is an environment refusal, not a result of this change,
and the hosted lane materializes it first (`scripts/provision-next-host.mjs
--materialize`). Measured in this worktree: 87 tests, 85 pass, 2 fail, both
`TREE_MISSING`.

## 8. Machine-readable verdicts

```
UTE3-ORDER stateAtBody=RUNNING transitions=ADMITTED,RUNNING,COMPLETED observed=1 unsettledAtBody=1
UTE3-RESULT identical=true added-fields=0 definition-fields=by-reference
UTE3-FAIL state=FAILED rethrown-identity=true errorCode=PROBE_FAILED
UTE3-ABORT state=UNKNOWN reason=body-aborted-without-terminal-observation missing=terminal-observation|host-result|effect-evidence
UTE3-DENY state=REFUSED decision=deny body-invoked=false
UTE3-FAILCLOSED code=SETTLEMENT_WRITER_CONFLICT body-invoked=false records=0
UTE3-OBSERVE invented=0 refused=EFFECT_CLAIM_WITHOUT_OBSERVATION blank-witness=A5_SETTLEMENT_OBSERVATION_REFUSED result-identical=true
UTE3-CRASH-WINDOW signal=SIGKILL effect-written=true durable=RUNNING recovered=UNKNOWN missing=terminal-observation|host-result|backend-receipt late-terminal=SETTLEMENT_CONFLICT projection=PASS-refused replay=A5_SETTLEMENT_REPLAY_REFUSED never-COMPLETED=true
UTE3-SINGLE-WRITER bound-store=A second-store-empty=true cross-process=SETTLEMENT_WRITER_CONFLICT reentrant-in-process=true
UTE3-NOT-WIRED production-imports=0 references=2 grant-shaped=0
UTE3-MUTANTS total=5 red=5 scenarios=5
```
