# a5sf-r3 — BL-11 / R3: one evidence chain per call

> **Dated 2026-11-03 (real UTC).** Alpha.5 Sandbox-First work package **R3 = BL-11**
> (`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md:35`,
> `current-implementation-plan.md:38/62/97`, reclamation registry row **R3-b**
> `dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md:41`:
> "one audit row per managed call; missing middle evidence is a FAIL").
> Branch `task/a5sf-r3-chain-20261103`, worktree `.worktrees/a5sf-r3-chain`, cut from
> `origin/master` = `cdf883244` (PR #542, R4/BL-12 on top of #541 R1 and #540 R2) and rebased
> before publishing onto `f0215bdf5` (#544 — the status PR that recorded the four R-lane merges
> and flipped this row to `READY`); the diff against that base is the eight files listed in §9.
>
> **CORE PATCH BUDGET = 0.** Nothing under `tests/deepseek-harness-test-use/` or any upstream
> tree was read or written. No Host boot, no port, no `DSH_HOME`, no network, **no
> `packages/**` change** (so `packages/testkit/test/p4t6-bookings/a5sf.json` is untouched).
> No second ledger, no second oracle, no second policy computation, no new row kind, and
> `scripts/a5sf-diag.mjs` was not modified (R4 owns it; the gap is filed in §7).

## 1. What this package is

`tests/world-factory/lib/a5sf-evidence.mjs` — a **passive recorder** plus a **same-call
alignment check**. For ONE managed call it appends JSONL rows carrying the four links an
independent observer needs, in the shape `scripts/a5sf-diag.mjs` already validates, and then
lines those links up on one identity:

| link | the fact | producer (at this base) | what the recorder does |
|---|---|---|---|
| **1 approval** | the Alpha.4 decision + its durable exactly-once consumption (`ControlOperationScope`) | `packages/runtime/control/service.ts:3240` `guardOperation` writes the `control-allow-consumed` fact (`service.ts:300`); payload type `packages/runtime/control/types.ts:1735` `ControlConsumptionRecord`, scope `types.ts:1502` | copies the `ControlConsumptionRecord` it is **handed**, verbatim (never mints, never re-decides) |
| **2 policy** | the compiled `MemberPolicy` + the per-call `EffectiveIo` | `packages/runtime/member-io-policy/src/compile.ts:100` `compileMemberPolicy`, `:189` `compileEffectiveIo`; the compiler is reached through the merged harness `tests/world-factory/lib/a5sf-harness.mjs:362` `requireCeiling` / `:385` `compileInvocation` (which delegates to `compileEffectiveIo`) | copies the policy objects' identity fields and the `EffectiveIo` lanes; **asserts the two are the same computation** (member + policyRevision + `effective.invocationId === callId`); never calls the compiler or the algebra |
| **3 provider** | the Provider that was actually mounted/consulted | `packages/runtime/team-services/src/install.ts:260` `installToolBindingRealm` → `ToolBindingRealm` (`install.ts:242`: `identity{teamId,memberInstanceId,templateId,instanceGeneration}` + `toolBindingIdentity` + `policyRevision`); the realtime guard is `packages/runtime/team-services/src/fs.ts:82` `createMemberFsGuard` | extracts ONLY the realm's JSON identity fields (the live `ctx`/`fs` handle never enters the file) and requires the lane's explicit `consulted` boolean |
| **4 effect** | the independently observed effect | `tests/world-factory/lib/oracle.mjs:47` `createOracle`, conjunction `:112` `effect()` (marker + ledger `body-ran` + host-pid liveness — the tool's own return value is NOT an input); reached through `a5sf-harness.mjs:412` `oracleFor` / `:423` `judgeEffect` | copies the oracle verdict (`oracleId`, `tag`, `effect`, `basis`, `observedAt`); it never observes anything itself |

The alignment check imports the **approval-binding law** from the R4 tool
(`scripts/a5sf-diag.mjs:211` `bindApproval`, `:229` `approvalAuthorizes`) instead of
restating it. Row selection (a named `approvalRequestId`, else the first row that authorizes)
mirrors `a5sf-diag.mjs`'s own selection so the two readers always name the same durable fact. This is
exactly the reconciliation R4's §7 item 1 asks for ("the schema should be reconciled with the P2
evidence chain (BL-11/R3)"), and the recorder emits the `logicalOperationId`/`operationFingerprint`
identity R4's "one risk" note requires for every narrowed allow.

**Why this is the missing producer.** R4's README §7 item 3 (`dev/agent-workflow/evidence/a5sf-r4/README.md:191`) states plainly that at its base
"No producer, no CI fixture of a real run" — its own fixtures are hand-written.
BL-11 is that producer: the C1 suite records a chain in which the approval row comes from the
**real** `ControlService` over the durable P6-T4 unit world, the policy from the **real** P1
compiler, and the effect from the **real** oracle, then uses the R4 reader as the judge.

## 2. The row schema: emitted vs validated

`scripts/a5sf-diag.mjs` validates exactly three kinds and IGNORES unknown fields
(`tests/a5sf-diag/a5sf-diag.test.mjs`, `scripts/a5sf-diag.mjs` `validCall`/`validLane`).
The recorder emits exactly those three kinds and **appends** to the JSONL path it is given (one
file per run: a reused path accumulates rows, and a second `ceiling` row for the same member is
refused rather than emitted — see §7 item 2).

```
{"kind":"ceiling","member","templateId","instanceGeneration","policyRevision",
 "tools":[{"tool","binding","read":{mode,allow,ask,deny},
           "write":{mode,allow,ask,deny},"network":{"access"}}]}

{"kind":"approval","requestId","decisionSequence","consumedAt",
 "scope":{rootSessionId,subject?,targetInstanceId,actionName,toolName?,
          capabilityDomain?,correlation,operationFingerprint?}}

{"kind":"call","callId","member","tool","axis","locator","lane",
 "instanceGeneration","policyRevision","toolBindingIdentity","disposition",
 "approvalRequestId"?,"logicalOperationId"?,"operationFingerprint"?,
 "actionName"?,"capabilityDomain"?,"provider":{…},"effect":{…}}
```

| field | validated by `a5sf-diag.mjs`? | why it is carried |
|---|---|---|
| `kind` ∈ {ceiling, call, approval} | **yes** (closed dispatch; unknown kind = `ignored`) | the recorder emits no other kind |
| `call.callId/member/tool/locator/lane` + `axis` | **yes** (required) | the tool's own contract |
| `call.approvalRequestId`, `logicalOperationId`, `operationFingerprint`, `actionName`, `capabilityDomain` | **yes** (optional; used by `bindApproval`) | the durable-row binding keys |
| `call.instanceGeneration`, `call.policyRevision`, `call.toolBindingIdentity`, `call.disposition` | **no — additive** | the per-call policy identity + the lane's own `matchLocator` disposition (narrowed-allow vs unexplained-allow cannot be decided without it) |
| `call.provider{consulted,teamId,memberInstanceId,templateId,instanceGeneration,toolBindingIdentity,policyRevision}` | **no — additive** | link 3 has no slot in R4's contract |
| `call.effect{oracleId,tag,effect,basis,observedAt}` | **no — additive** | link 4 has no slot in R4's contract |
| `ceiling.instanceGeneration`, `ceiling.policyRevision`, `ceiling.templateId` | **no — additive** | the compiled policy identity (link 2) |
| `ceiling.tools[].binding` | **no — ignored** (the tool reads `tool` + the axis lane) | provenance of the per-tool intersection |

`a5sf-diag.mjs` accepts all of these rows **unchanged** and its report is unaffected; A1
asserts `analyzeRows(...).ignored === 0`, i.e. the additive fields do not become invisible
"ignored" evidence. See §7 for the gap this discloses and for what would break if a future
R4 change made the tool strict.

## 3. Identity keys: what each link can and cannot carry

The chain is aligned when the four links carry ONE identity: member instance id, instance
generation, invocation/call id, logical operation (or its canonical `operationFingerprint`).
Not every link can carry every key:

| key | link 1 approval | link 2 policy | link 3 provider | link 4 effect | call row |
|---|---|---|---|---|---|
| member instance | `scope.targetInstanceId` | `memberIdentity` | `identity.memberInstanceId` | — (tag only) | `member` |
| instance generation | **not in `ControlOperationScope`** | `instanceGeneration` | `identity.instanceGeneration` | — | `instanceGeneration` |
| invocation/call id | `scope.correlation` only when the caller used the call id (R1's real shape uses a **logical-operation** correlation: `packages/runtime/test/a5sf-approval-takeover.test.ts:822/847` binds `correlation:'corr-a5sf-r1-oneshot'` to `callId:'call-r1-real-oneshot'`) | `invocationId` | — (the realm has no call id) | `tag = callId` (the recorder's attribution convention) | `callId` |
| logical operation | `scope.correlation` / `scope.operationFingerprint` | — | — | — | `logicalOperationId` / `operationFingerprint` |

`CHAIN_ALIGNED` therefore proves member agreement across all four links, generation
agreement across policy+provider+call, invocation-id agreement across call+compiled-policy+
oracle tag, and operation agreement across approval+call. It **names** the keys that no link
can carry — `unbound: ["approval.instanceGeneration", "effect.member",
"effect.instanceGeneration"]` — instead of implying them; A1 pins that disclosure.

## 4. Verdict semantics (fail closed)

* `CHAIN_ALIGNED` — all four links present and every key two links both carry agrees.
* `CHAIN_BROKEN(reason, link)` — a link is present but contradicts the chain identity:
  `APPROVAL_SCOPE_MISMATCH`, `GENERATION_MISMATCH`, `POLICY_REVISION_MISMATCH`,
  `ALLOW_OUTSIDE_COMPILED_CEILING`, `TOOL_NOT_IN_COMPILED_CEILING`,
  `PROVIDER_NOT_CONSULTED`, `PROVIDER_*_MISMATCH`, `EFFECT_NOT_OBSERVED`,
  `EFFECT_DESPITE_REFUSAL`, `EFFECT_TAG_MISMATCH`, `EFFECT_ORACLE_UNSOUND`.
* `UNDECIDABLE(reason, link)` — a link (or a key) is **missing** (a malformed row is a missing
  link, never a dropped row): `LINK_MISSING`,
  `CEILING_ROW_MISSING`, `AMBIGUOUS_CEILING`, `APPROVAL_ROW_MISSING`,
  `APPROVAL_SCOPE_UNBINDABLE`, `AMBIGUOUS_APPROVAL_ROW`, `DUPLICATE_CONSUMPTION`,
  `CALL_FIELD_MISSING`, `CEILING_AXIS_MISSING`.

**The missing-approval asymmetry (A6/A7), deliberately two verdicts.** For a *narrowed
allow* (compiled disposition `ask`, decided `allow`) a missing durable row is
`UNDECIDABLE(approval, APPROVAL_ROW_MISSING)`: the row may exist outside the recorded file,
so absence is not proof of a bypass. For an *unexplained allow* (compiled `deny`, decided
`allow`) the chain is `CHAIN_BROKEN(policy, ALLOW_OUTSIDE_COMPILED_CEILING)` **whether or
not** an approval row exists — an approval never widens a hard ceiling (R1's law), so the
missing row is not the ambiguity. A6 also runs `a5sf-diag.mjs` on the same rows: the R4 tool
reports `ALLOW_WITHOUT_DURABLE_APPROVAL` (exit 1) because it answers the *bypass* question,
while the chain answers the *completeness* question. Both refuse to say "clean"; the
distinction is intentional and is why the two must not be collapsed.

A refused call (`lane` ask/deny) is aligned with no effect (`EFFECT_DESPITE_REFUSAL` if the
oracle saw one) and does not require `consulted: true`.

## 5. RED → GREEN (real output in the logs)

```
$ node --test tests/world-factory/a5sf-evidence.test.mjs      # module absent = RED
✖ tests/world-factory/a5sf-evidence.test.mjs
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/tests/world-factory/lib/a5sf-evidence.mjs'
ℹ pass 0  ℹ fail 1                                            # red-test.log

$ node --test tests/world-factory/a5sf-evidence.test.mjs      # GREEN
✔ A1 aligned: one identity across all four links, and a5sf-diag reports the narrowed allow as legitimate
✔ A2 approval link broken … ✔ A3 policy link broken … ✔ A4 provider link broken …
✔ A5 effect link broken … ✔ A6 missing approval row ⇒ UNDECIDABLE … ✔ A7 unexplained allow ⇒ BROKEN …
✔ A8 recorder refuses to mint or poison evidence … ✔ A9 passivity fence … ✔ A10 CLI …
ℹ tests 10  ℹ pass 10  ℹ fail 0                               # green-tests.log
```

The suite additionally runs the adjacent inherited legs (`a5sf-harness` 10, `a5sf-diag` 11,
`a5sf-golden` 19 → `ℹ tests 40  ℹ pass 40  ℹ fail 0`), `node scripts/eb3-ci-required.mjs`
(`pass workflows=9 findings=0`) and `node scripts/eb3-ci-negative-controls.mjs`
(`24/24`). Mutation controls (each applied to the module, then restored — same SHA):
M1 provider-consult check removed ⇒ **A4 red**; M2 generation comparison removed ⇒ **A3 red**;
M3 effect-observation check removed ⇒ **A5 red** (and A10, same law through the CLI);
M4 missing approval row treated as aligned ⇒ **A6 red**.

## 6. The diag round-trip (the schema contract is measured, not declared)

`aligned-chain.jsonl` in this directory is a **real recording**: the approval row is the
durable `ControlConsumptionRecord` the real `ControlService.guardOperation` wrote over the
P6-T4 unit world (`requestId=ctrl-…`, `decisionSequence=2`,
`consumedAt=2026-09-01T09:00:00Z`, the frozen P6-T4 clock); the ceiling is the real P1
compiler's `MemberPolicy` ∩ tool restriction; the effect is the shipped oracle's verdict over
a planted World marker. Two calls are recorded: a narrowed allow (durable `ask` locator,
decided `allow`) and a plain compiled `allow`.

```
$ node scripts/a5sf-diag.mjs dev/agent-workflow/evidence/a5sf-r3/aligned-chain.jsonl
A5SF-DIAG tool=scripts/a5sf-diag.mjs rows=4 files=1
ALLOW_LEGITIMATE … code=APPROVAL_CONSUMED_NARROWED_ALLOW callId=call-a5sf-r3-legit
  requestId=ctrl-… tool=read axis=read boundBy=call.logicalOperationId = scope.correlation
SUMMARY calls=2 allow=2 findings=0 legitimate_narrowed=1 undecidable=0 classified=0 gaps=0 verdict=NO_BYPASS_FOUND
$ echo $?
0
$ node tests/world-factory/lib/a5sf-evidence.mjs --check dev/agent-workflow/evidence/a5sf-r3/aligned-chain.jsonl
CHAIN_ALIGNED callId=call-a5sf-r3-legit … operation=logicalOperationId:corr-a5sf-r3-fixture
  boundBy=call.logicalOperationId = scope.correlation unbound=approval.instanceGeneration,effect.member,effect.instanceGeneration
CHAIN_ALIGNED callId=call-a5sf-r3-open …
SUMMARY calls=2 aligned=2 broken=0 undecidable=0 invalid=0 verdict=CHAIN_ALIGNED
```

Both readers consume the **same file** without conversion. (`observedAt` is run-specific; the
`requestId`/`decisionSequence`/`consumedAt` come from the durable control scope, and the ceiling
lanes from the compiled policy, so a regeneration reproduces everything except the clock.)

## 7. Schema gap between R4's parser and what a real call supplies (filed, not patched)

1. **No slot for the policy/provider/effect identity.** `call` has no
   `instanceGeneration`/`policyRevision`/`toolBindingIdentity`, and no vocabulary for
   "Provider consulted" or "effect observed". This recorder adds them as fields on the rows
   the tool already accepts (§2). The alternative — new `kind` values — would be counted as
   `ignored` by `a5sf-diag.mjs` and would be **invisible** evidence, i.e. the parallel schema
   the reclamation registry forbids; it is refused. A future R4 change could validate these
   fields (the recorder's names are the contract proposed here), but that change belongs to
   R4/BL-12, not to this lane.
2. **`ceiling` is keyed by MEMBER only.** Two compiled generations of one member cannot be
   recorded in one file: the diag reports that member's allows `UNDECIDABLE` with
   `DUPLICATE_CEILING_MEMBER`. The recorder therefore **refuses** a second ceiling row for a
   member (`A5SF_EVIDENCE_CODES.DUPLICATE_CEILING_MEMBER`) instead of poisoning the report.
   P2 must use one file per member-generation (or wait for an R4 schema change).
3. **`tools[]` is keyed by tool NAME only.** Two bindings that expose the same tool name but
   compile different lanes are ambiguous (first entry wins). The recorder refuses that
   (`TOOL_ENTRY_CONFLICT`) rather than emitting a silent first-wins.
4. **The durable scope carries no generation.** `ControlOperationScope` (`types.ts:1502`) has
   `targetInstanceId`/`correlation`/`operationFingerprint` but no instance generation, so link
   1 cannot be generation-aligned. This is R1's disclosed residual (`evidence/a5sf-r1/README.md`
   §6.5) and is reported as `unbound`, never assumed away.
5. **Missing-approval verdict vocabulary differs on purpose** (§4): diag says
   `APPROVAL_BYPASS/ALLOW_WITHOUT_DURABLE_APPROVAL`; the chain says `UNDECIDABLE`. Both are
   fail-closed; a single verdict would have to pick one question.

## 8. What this chain does NOT prove

* **It records what the lane reported.** The recorder is passive by design (A9 fences its
  source): `disposition` is the lane's `matchLocator` answer, `lane` is the lane's decided
  outcome, `consulted` is the lane's boolean, and the effect is the oracle's verdict. None of
  these is re-derived or instrumented here.
* **It does not observe the kernel.** No syscall/eBPF/Landlock probe, no fd inspection. The
  oracle's channels are World-level (marker file, the plugin's canary ledger, host-pid
  liveness — `oracle.mjs` header), not the OS's view of the process.
* **It does not prove `body=0`** (no side effect before a refusal) or that the Provider did
  not write before throwing. A refused call is aligned when the oracle saw no effect; the
  oracle's three channels cannot see every possible side channel.
* **No real Host and no real effect verification in C1.** The approval row comes from a real
  `ControlService` but over the **durable unit world** (P6-T4), not a live Host; the
  `MemberPolicy` authority input is the fixture fact `{revision:'a4:a5sf-r3-fixture',
  admitted:true}` (the real authority port is P2 wiring); the "Provider install result" is a
  `ToolBindingRealm`-shaped record — **a live realm mount needs a Cordis root and is not
  exercised** (same limit R2 §8 disclosed for `installToolBindingRealm`). Nothing here is a
  G2 acceptance; it is the harness P2 will wire.
* **The rows are not signed or tamper-evident.** A writer who can edit the JSONL can change
  every field; the chain is an audit format, not a ledger with its own integrity.
* **One durable row authorizes at most one allow per report** (R1 exactly-once, mirrored as
  `DUPLICATE_CONSUMPTION`). A file spanning independent runs that reuse `requestId`s is
  `UNDECIDABLE`, deliberately.

## 9. Files

| file | why |
|---|---|
| `tests/world-factory/lib/a5sf-evidence.mjs` | the recorder (ceiling/approval/call), the four-link alignment check, the `--check` CLI, the closed transport-refusal vocabulary |
| `tests/world-factory/a5sf-evidence.test.mjs` | 10 host-free `node:test` legs (A1 aligned + round-trip, A2–A5 the four mutations, A6/A7 the missing-approval asymmetry, A8 recorder refusals, A9 passivity fence, A10 CLI) |
| `.github/workflows/ci-integration.yml` | one new step (`a5sf evidence chain R3`), after the R2 harness step — node:test files are listed explicitly, so a suite no step runs exists nowhere |
| `dev/ci/eb3-ci-manifest.json` | one new required leg (`a5sf evidence chain R3`) with the test path as a required token; dropping it is `CI_LAYER_LEG_WEAKENED` |
| `dev/agent-workflow/evidence/a5sf-r3/{README.md,red-test.log,green-tests.log}` | this account, the RED capture, and the GREEN transcript including the round-trip and mutation controls |
| `dev/agent-workflow/evidence/a5sf-r3/aligned-chain.jsonl` | the real recorded chain both readers consume (fixture for review, not a test input) |

Dependency note (identical to R2's C1): the P1 TS seams need the workspace installed
(`pnpm install --frozen-lockfile`; `ci-integration` already installs) and Node ≥ 24 for native
type stripping. In a bare checkout the harness/evidence suites refuse with
`SEAM_UNAVAILABLE`, never a false green.

## 10. The one risk for the reviewer

The recorder's two strongest claims — **provider consulted** and **effect observed** — are
arguments the lane hands in, and the "install result" is only shape-validated (no seal proves
it came from `installToolBindingRealm`). So BL-11 currently gives P2 an **alignment harness**,
not a tamper-proof chain: a lane that passes `consulted: true` without consulting stays
`CHAIN_ALIGNED`. The remaining links are real (the durable row is minted by `ControlService`,
the lanes come from `compileEffectiveIo`, the effect from the oracle), and A9 fences the
recorder from ever computing them itself. The reviewer should decide whether P2's per-mechanism
wiring must make `disposition`/`consulted` mechanically produced at the guard/installer seam
(the honest next step) instead of remaining recorded claims — this package deliberately does
not pretend otherwise.
