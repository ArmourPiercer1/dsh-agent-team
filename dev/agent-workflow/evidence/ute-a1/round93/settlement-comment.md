**[dated settlement, 2026-11-24T20:40Z — round 93: R1 LANDED — the Alpha.6 case producer now exists, through the EXISTING `requestApprovalLeg`; the live routed wake stays REFUTED on the NEW measured finding `G11`; full gate set green; head `@@HEAD@@`]**

Covered head: `@@HEAD@@` (parent `4f399df5e`). PR #822 stays **DRAFT**, unmerged. :3080 and its
DSH_HOME were never touched; no second server was started; no non-topic push; no history rewrite; no
frozen A0 evidence edited; no DSH fork or upstream patch (CORE PATCH BUDGET = 0).

## Verdict

Owner ruling: review `docs/reviews/20261124-0151.txt` §1, **R1 = APPROVED**. R1's contract was that a
durable Alpha.6 **case** must exist for an ordinary ask that qualifies, so the EXISTING router can select
the Officer and the round-84 wake has something to deliver. **That producer now exists and is proven over
the real ports.** The live D4 judge is still **REFUTED** — and the reason is a NEW, measured, Team-side
gap (`G11`), not the old case-absence. No gate was weakened to say otherwise.

The ruling's scope discipline is part of the diff, not just the prose: the case is written by the
**EXISTING `ControlService.requestApprovalLeg`** (`control/service.ts:5607`); **no new ask producer and no
new UTE I/O axis** were added; **no missing identity member is ever defaulted** (no fabricated Operation
Tool, no invented Authority Scope); a non-qualifying ask keeps the **byte-identical** Leader/Human path.

## The closed qualification rule (`ALPHA6-ORDINARY-CASE-Q`, R1-A)

An ask is CONVERTED only when all five clauses hold; every failure that is not "already qualified but
unsourceable" is `plain` (the lawful pre-round path):

| clause | requirement | why it is closed | where |
| --- | --- | --- | --- |
| `enabled` | the row carries `reviewRouting.enabled` | configuring Alpha.6 must be the ONLY way to widen | `alpha6-ask-case.mjs` |
| **Q1** | a **declared ToolBinding** exists for the tool (`<owner>/<name>` + ToolDefinition identity from the compiled `toolBindings[]`) | the trusted coordinate; a projection would be a second authoring source | idem |
| **Q2** | the **canonical operation identity** resolves (`canonicalizeOperation` + `classifyPermissionTool` + the fingerprint) | the case's identity must be the SAME operation the ceiling walk graded | idem |
| **Q3** | the required authority at creation is the **Leader rung** | a HUMAN rung would silently widen Officer authority — the ruling's explicit prohibition | idem |
| **Q4** | the **shared delegable predicate** (`isDelegableOrdinaryToolAsk`) holds | the router and the ReviewCapability evaluator already read exactly this; a second eligibility rule is a second policy | idem |

Refusal is a separate, typed outcome, not a fallback clause: an ask that DID qualify but whose required
identity member cannot be read yields `ADMISSION_ALPHA6_CASE_IDENTITY_INCOMPLETE` (naming the field) and
**writes nothing** — not a case, not a plain row. A second code
(`ADMISSION_ALPHA6_CASE_LEG_REFUSED`) covers `requestApprovalLeg`'s own refusal.

## Frozen case identity (R1-B) — every member has a trusted source

| member | trusted source |
| --- | --- |
| `operationFingerprint` | the ceiling walk's `routeOperationApproval` verdict |
| `authorityScope` | the SAME `createAuthorityCeilingReader` the root receives (one producer, forwarded twice) |
| `requestedEffect` | the walk (`'allow'`), never a literal default |
| `operationToolOwner` / `operationToolName` | the compiled binding coordinate, split on the LAST `/` |
| trusted ToolDefinition identity | that same compiled `toolBindings[]` entry (passed through, never re-derived) |
| blueprint content hash | the mounted blueprint document |
| policy generation | `createAlpha6AuthorityGenerationReader` |
| requesting Member identity | `domain.repositories.teamSessions.get` |
| call correlation id | the admission call's own correlation |

All nine are frozen into the leg at construction. `perEffectRequiredAuthorities: ['leader']` comes from
the walk, never from a default.

## Call site (R1-C)

`admission-port.mjs:221` calls `service.requestApprovalLeg({rootSessionId, caller:{kind:'instance',…},
…caseLeg})`; the producer is `alpha6-ask-case.mjs:216` (`caseFor`); it is wired at
`agent-bindings.mjs:626` and the host forwards the shared reader at `host.ts:2400` / `:2625`. The producer
is instantiated ONLY when the row opted in **and** the ceiling reader exists — an unwired producer is the
pre-round product, and defaulting the frozen legacy rung on a v3 Team would widen Officer authority.

## Arms (ute-vnext-a1, over the real `ControlService` / router / round-84 latch)

| arm | what it proves |
| --- | --- |
| `ADM-149` | a qualifying ask becomes a DURABLE case (`legOrdinal:1`, `reviewPayload.authorityScope`, `operationToolDefinitionIdentity:'dsh.fs/write'`, `perEffectRequiredAuthorities:['leader']`), one pending request, zero decisions; aborting the wait is `ADMISSION_APPROVAL_WAIT_ABORTED` |
| `ADM-150` | the PRODUCT's own `routeReview` selects the **Officer** member instance, and the round-84 governed delivery writes the intent fact, the confirmation fact and wakes the Officer session |
| `ADM-151` | a NON-qualifying ask writes **no** case: plain `leader-approval`, `ordinaryAsk: null` |
| `ADM-152` | an unsourceable identity member is a TYPED refusal with **zero** rows (the "never fabricate" clause) |
| `ADM-153` | the Officer's own operation is never self-reviewed — the existing ReviewCapability rules still apply inside the case |

`ADM-54`'s static witness needed one edit (one construction, `controlOf` still first) — it was updated,
not loosened, and the change is visible in the diff.

## Live D4 (`probe-d4-routed-wake.mjs`) — `d4:routed-wake` REFUTED, and the reason MOVED

Two agreeing DEV-LIVE boots (`--boots 2`, rc.2 host `639ed015…`, port 3194 family,
`agreeing=true differing=[]`; `runs/` + `archive/…boots1…` + `round93/` evidence):

| fact | boot1 | boot2 |
| --- | --- | --- |
| `enablement` | PROVEN | PROVEN |
| `officer-up` | PROVEN | PROVEN |
| `officer-binding` | PROVEN | PROVEN |
| `refusal` | PROVEN | PROVEN |
| **`routed-wake`** | **REFUTED** | **REFUTED** |
| `askAppeared` / `pendingRequestId` | true / `ctrl-1xxrzo…` | identical |
| `wakeFacts` / `wakeIntentFiles` / `reviewWakeHits` | 0 / 0 / 0 | 0 / 0 / 0 |

Failing clauses: `row-carries-approval-case`, `product-router-selects-the-officer`,
`wake-intent-fact-routed`, `wake-confirmed-delivered`, `wake-intent-file-written`,
`officer-woken-in-its-session`, `wake-has-machine-attribution`, `no-plain-c1-ask-to-the-leader`.

**The judge was amended in the OPEN and in the STRICT direction.** The two clauses that ASSERTED the
pre-fix defect (`route() === null`; "the Leader received the plain ask") now assert the REQUIREMENT (the
router must select the existing Officer instance; the plain case-less ask must be ABSENT), and the router
probe serves the boot's real durable member view instead of a hard-coded `[]`. No clause was deleted or
made vacuous; the other seven are untouched.

**Why it is still red — finding `G11` (measured both ways, disclosed in `D-ACCEPTANCE-REPORT.md` §10).**
The case identity needs a **trusted ToolBinding**, which only a declared `toolBindings[]` entry provides.
But a live v5 world cannot carry BOTH an ordinary `ask` and that binding:

- production shape (ask on the Member ceiling, **no** declared binding): no ToolDefinition coordinate ⇒
  Q1 correctly does not qualify ⇒ plain path ⇒ no case (`G11` arm A);
- declared binding (`D4_BINDING_WORLD=1`): the Alpha.5 binding-lane compiler
  (`compileEffectiveIo(…,{approvedOnce:false})`) collapses ANY `ask` path to an **empty deny lane**, so the
  worker's write is refused `LANE_DENY … outside the tool's compiled fs.write lane` and **zero** control
  rows are written (`G11` arm B; evidence `round93/d4-binding-world-*.json`).

Closing `G11` needs an owner ruling — either the binding-lane compiler carries an unresolved `ask`
(an Alpha.5 semantic change) or the centre projects a ToolDefinition coordinate for an undeclared tool
(the second authoring source Q1 exists to prevent). **Neither is papered over here:** no fabricated
ToolBinding, no defaulted Authority Scope.

## Counts that moved (and why)

- `ute-vnext-a1`: `tests 215 → 220`, `pass 212 → 217`, `skipped 3 → 3` (five new arms, all positive; the
  one skip is the pre-existing disclosed bash arm). Suite/file set unchanged (7 files) → **leg set digest
  unchanged** (`sha256:edd4f1c4…`).
- Test catalog: `tests=785`, collected 733, excluded 14, uncollected 38 — **no test FILE added or
  removed**; bounds 41/7 unchanged; digest `sha256:da8a452d…` unchanged.
- Dist mirrors rebuilt and committed in the same commit set: `place-dist-glue` **35 placements**
  (was 34 — the new `alpha6-ask-case.mjs` mirror), plus the `review-authority` rebuild the re-export owes.
  `artifacts-at-head`: HEAD carries its own build, 1946 files, drift 0.

## Instruments (updated by their own rules, no assertion weakened)

- **p4t6 scannable-surface ledger**: new booking
  `packages/testkit/test/p4t6-bookings/round93alpha6askcase.json`, `1318 → 1319`, one path, with the
  measured tie note. Without it the scan leg is red (`expected 1318 to be 1319`).
- **blueprint fence baseline**: re-recorded `vnext-admission.test.mjs` `L4641 → L4645` (ADM-54's witness
  edit above the C-alpha6 fixture) and added the SECOND identity `L7699` (the new arms' own v5 fixture),
  with the cause written in the open. Same fixture identity, nothing added or resolved.
- Three **static pins whose subject moved** were made sharper, not looser, each disclosing R1 inline:
  `a4p2-dual-envelope-mutation` (now requires the single `createAuthorityCeilingReader` construction over
  the same `permissionFacts` AND both forwards of the bound name),
  `a4p7-ceiling-port-assembly-pin`'s PIN-4 census (one producer + two forwards, instead of one inline
  spelling), and `a6-pr2a-lane-hygiene` (exactly ONE reviewed exemption path for the case producer, whose
  predicate import is routed through `review-authority` so the STRICTER
  `a6-pr1-lane-hygiene` "no plugin path imports the pure review-router lane" law stays untouched).

## Gates at this head

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
  tests 220 / pass 217 / fail 0 / skipped 3
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
  (DISCOVERED_AND_COLLECTED 733 / EXCLUDED_WITH_REASON 14 / UNCOLLECTED 38; bounds --max-uncollected 41 --max-excluded 7)
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (35 placement(s))   — every line byte-identical
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
node --test (UTE G1 nine-file argv): tests 89 / pass 89 / fail 0 / skipped 0, exit 0
ci-pr-gate --full --census-captures 2:
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=274.2
  census: captured 599f/7416l, 599f/7416l vs baseline-declared 626 / 7936 — 2 captures, identical identity sets — COUNTS MOVED, SET DID NOT
  (identity set IDENTICAL to the published baseline; comparison JSON:
   dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch/census-comparison-20261123T203837Z-7.json;
   full log: dev/agent-workflow/evidence/ute-a1/round93/ci-pr-gate.log)
```

## Seat and model disclosure

Implementation, reproduction and the gate runs were performed in one delegated DeepSeek-Harness coding
session (model `deepseek-v4.1-flash-1017`, seat: SOLE WRITER in `.worktrees/vnext-a1-cut`). No
second-party reviewer seat was commissioned in that session; the review verdict is the reproduced gate set
above plus the readable docs, not a second reviewer's opinion. The coordinating agent holds the
independent review/merge decision.

## Report / evidence

`dev/agent-workflow/evidence/ute-a1/ALPHA6-FORMAL-ROUTING.md` §R1-A…§R1-D (the rule, the identity table,
the call site, the live measurement); `CAPABILITY-MATRIX-C.md` round-93 annotation (C-alpha6 stays
**MECHANISM**); `D-ACCEPTANCE-REPORT.md` G1 annotation + **G11** + §10.2; `MIGRATED-SUITE-STATUS.md`
round-93 arms table; `round93/` (D4 results, agreement table, G11 arm evidence, this gate log);
`packages/runtime/src/plugin/vnext/alpha6-ask-case.mjs` (the rule as a machine declaration).

## Limits / NOT proven

- **R3 / BL-30 (G2) is NOT touched.** After an allow decision the provider still refuses an
  `ask`-disposition call (`IO_ASK_REQUIRES_APPROVAL`), so the GRANTED call still cannot execute. R1 makes
  case ROUTING testable; the `ask → grant → execute` chain is the next round and is claimed by NOBODY here.
- The live routed wake is **not** reached, because of `G11` — a Team-side compiler gap that needs an owner
  ruling (see above). No provider-side consumption is wired in this round, by design.
- C-alpha6 remains **MECHANISM**. No capability row becomes PRODUCT-PROVEN. The D4 measurement is a
  scripted-model DEV-LIVE boot, not a real model; it is disclosed as such everywhere it is quoted.
