# a5sf-r3 — BL-11 / R3: one evidence chain per call

> **Dated 2026-11-03 (real UTC).** Alpha.5 Sandbox-First work package **R3 = BL-11**
> (`docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md:35`,
> `current-implementation-plan.md:38/62/97`, reclamation registry row **R3-b**
> `dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md:41`:
> "one audit row per managed call; missing middle evidence is a FAIL").
> Branch `task/a5sf-r3-chain-20261103`, worktree `.worktrees/a5sf-r3-chain`, cut from
> `origin/master` = `cdf883244` (PR #542, R4/BL-12 on top of #541 R1 and #540 R2) and rebased
> before publishing onto `f0215bdf5` (#544 — the status PR that recorded the four R-lane merges
> and flipped this row to `READY`); the diff against that base is the files listed in §9.
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

`scripts/a5sf-diag.mjs` validates **five** kinds — `ceiling`, `call`, `approval`, `failure`,
`compiler-refusal` (`scripts/a5sf-diag.mjs:267/270`) — and IGNORES unknown fields and unknown
kinds. The recorder emits three of the five (`ceiling`/`approval`/`call`, the chain rows) and
**appends** to the JSONL path it is given (one file per run: a reused path accumulates rows, and
a second `ceiling` row for the same member is refused rather than emitted — see §7 item 2).
The two non-chain kinds are recognised by this reader's index and counted as `notChain`
(§4, A12), never as evidence for or against a chain.

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
| `kind` ∈ {ceiling, call, approval} | **yes** (closed dispatch; an unknown kind is `ignored` by the tool) | the recorder emits no other kind |
| `kind` ∈ {failure, compiler-refusal} | **yes** (the failure question) | not emitted by the recorder; tolerated and counted `notChain` by this reader |
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

**What `CHAIN_ALIGNED` is NOT: a bypass verdict.** `disposition` and `lane` are
**lane-claimed inputs** — the recorder copies what the lane reported and never re-derives the
lane (that is the passivity law, A9). So `CHAIN_ALIGNED` means *the four recorded links carry
one identity*; it does not mean *the allow was lawful*. A lane that misreports its own
`disposition` (claims `allow` where the compiled lane said `ask`) is invisible to this reader
and stays aligned — and `scripts/a5sf-diag.mjs` is the **compensating reader**: it re-derives
the compiled lane from the `ceiling` rows with the P1 algebra and reports
`ALLOW_WITHOUT_DURABLE_APPROVAL` / `BYPASS_FOUND` for exactly those rows. The two verdicts
answer different questions and are never interchangeable: run BOTH (the round-trip in §6 does;
A6 shows the same rows as `UNDECIDABLE` here and `ALLOW_WITHOUT_DURABLE_APPROVAL` there).

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
* **An unknown `kind` is a named `ROW_INVALID reason=UNKNOWN_ROW_KIND`** and forces the file to
  `UNDECIDABLE` with a non-zero exit (A12). `scripts/a5sf-diag.mjs` would count such a row
  `ignored`; this reader is deliberately loud where the tool is silent, because otherwise
  `{"kind":"provider","consulted":false}` would be a green check. The recognised non-chain
  kinds (`failure`, `compiler-refusal`) are counted `notChain` and do not affect the verdict.

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
✔ A1 aligned: one identity … ✔ A2 approval link broken … ✔ A3 policy link broken …
✔ A4 provider link broken … ✔ A5 effect link broken …
✔ A6 missing approval row ⇒ UNDECIDABLE (named AND unnamed arms)
✔ A7 unexplained allow ⇒ BROKEN … ✔ A8 recorder refuses to mint or poison evidence …
✔ A9 passivity fence (literal-token scan) … ✔ A10 CLI …
✔ A11 every identity branch is load-bearing: one row mutation each, one named verdict each
✔ A12 an unknown row kind is a named INVALID … while failure rows are tolerated
ℹ tests 12  ℹ pass 12  ℹ fail 0                               # green-tests.log
```

The suite additionally runs the adjacent inherited legs (`a5sf-harness` 10, `a5sf-diag` 11,
`a5sf-golden` 19 → `ℹ tests 40  ℹ pass 40  ℹ fail 0`), `node scripts/eb3-ci-required.mjs`
(`pass workflows=9 findings=0`) and `node scripts/eb3-ci-negative-controls.mjs`
(`24/24`).

**Mutation controls** (`mutation-controls.log`): **27 mutations**, each applied to the module
and then restored byte-for-byte (sha256 re-checked) — **all 27 RED, no survivors**. They cover
every branch the review named: the narrowed-allow arm (A6, unnamed requestId), the named-row
arm (A6), the policy revision / tool-in-ceiling / ceiling-member comparisons (A11), the four
Provider keys (A11), the oracle id + tag (A11), `EFFECT_DESPITE_REFUSAL` (A11), the
exactly-once `DUPLICATE_CONSUMPTION` law (A11), the recorder's `INVOCATION_ID_MISMATCH`
(A11), the `UNKNOWN_ROW_KIND` branch (A12), plus the pre-existing A2/A3/A4/A5/A7 arms and the
missing-link/ambiguous-row/axis arms (A11). See §11 for the table.

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
SUMMARY calls=2 aligned=2 broken=0 undecidable=0 invalid=0 notChain=0 verdict=CHAIN_ALIGNED
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
   the reclamation registry forbids; it is refused. Note the deliberate asymmetry: the tool
   IGNORES an unknown `kind`; this reader fails closed on it (§4, A12), because a silent
   `ignored` is exactly how `{"kind":"provider"}` would become a green check. A future R4
   change could validate these fields (the recorder's names are the contract proposed here),
   but that change belongs to R4/BL-12, not to this lane.
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

* **It records what the lane reported.** The recorder is passive by design; `disposition` is
  the lane's `matchLocator` answer, `lane` is the lane's decided outcome, `consulted` is the
  lane's boolean, and the effect is the oracle's verdict. None of these is re-derived or
  instrumented here. A9's fence is a **literal-token scan of the module source** for the
  forbidden call spellings (`matchLocator(`, `compileEffectiveIo(`, …): it proves the module
  does not *spell* a second computation, NOT that a re-derivation could never hide behind a
  renamed helper. The runtime proofs are the round-trip (A1) and the branch table (A11).
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
| `tests/world-factory/a5sf-evidence.test.mjs` | 12 host-free `node:test` legs (A1 aligned + round-trip, A2–A5 the four original link mutations, A6 both missing-approval arms, A7 unexplained allow, A8 recorder refusals, A9 literal-token passivity fence, A10 CLI, A11 every identity branch + exactly-once + invocation id, A12 unknown-kind fail-closed) |
| `.github/workflows/ci-integration.yml` | one new step (`a5sf evidence chain R3`), after the R2 harness step — node:test files are listed explicitly, so a suite no step runs exists nowhere |
| `dev/ci/eb3-ci-manifest.json` | one new required leg (`a5sf evidence chain R3`) with the test path as a required token; dropping it is `CI_LAYER_LEG_WEAKENED` |
| `dev/agent-workflow/evidence/a5sf-r3/{README.md,red-test.log,green-tests.log}` | this account, the RED capture, and the GREEN transcript including the round-trip and mutation controls |
| `dev/agent-workflow/evidence/a5sf-r3/aligned-chain.jsonl` | the real recorded chain both readers consume (fixture for review, not a test input) |
| `dev/agent-workflow/evidence/a5sf-r3/mutation-controls.log` | the 20-mutation table: each deleted branch, the RED leg that caught it, and the restored module sha256 |

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

## 11. Review response (dated 2026-11-03, real UTC) — APPROVE-WITH-CONDITIONS, C1–C8

The independent review found **eight surviving mutations** (test strength, not direction) and
**one genuine silent-bypass mutation**, plus five documentation/schema-truth defects. All are
closed below; nothing in the review's direction changed (no new row kind, no second
computation, `scripts/a5sf-diag.mjs` still untouched).

| # | condition | fix | proof |
|---|---|---|---|
| C1 | A6 covered only the NAMED `approvalRequestId`; deleting the narrowed-allow arm stayed **10/10 green** (silent bypass) | A6 now also drops the `approvalRequestId` — R1's real shape — and asserts the SAME `UNDECIDABLE(approval, APPROVAL_ROW_MISSING)` | **M04** RED on A6 |
| C2 | eight identity branches had no test: policy revision, tool-in-ceiling, provider member/generation/revision/binding, oracle id/tag, `EFFECT_DESPITE_REFUSAL`, `DUPLICATE_CONSUMPTION`, recorder `INVOCATION_ID_MISMATCH` | new leg **A11** — a row-mutation table with one named verdict per branch, plus exactly-once replay, `MEMBER_MISMATCH` via the direct entry point, and the recorder's invocation-id refusal | **M08–M19** RED on A11 |
| C3 | "validates exactly three kinds" was false (five: also `failure`, `compiler-refusal`) | §2 + module JSDoc corrected; the two non-chain kinds are recognised, counted `notChain`, and cannot contribute to a chain verdict | **A12** (tolerated arm) |
| C4 | an unknown row kind was silently dropped and `--check` still said `CHAIN_ALIGNED` (`{"kind":"provider"}`, `{"kind":"effect"}`) | unknown kind ⇒ named `ROW_INVALID reason=UNKNOWN_ROW_KIND`, file verdict `UNDECIDABLE`, exit 1; A12 runs both probes through the CLI | **M20** RED on A12 |
| C5 | §3/§4 overstated: `CHAIN_ALIGNED` was described as if it settled lawfulness | §3 now says `disposition`/`lane` are **lane-claimed inputs** and `CHAIN_ALIGNED` is an *alignment* verdict, never a bypass verdict; `scripts/a5sf-diag.mjs` is named as the compensating reader (it re-derives the compiled lane) and A6/A12 keep the two readers' divergence visible | §3, §4, §6 |
| C6 | module JSDoc still called link 3 "the Provider actually consulted" / "the shipped installer's result" | reworded everywhere (module header, table row, passivity list, `call()` doc, `providerFactOf` refusal) to "a `ToolBindingRealm`-shaped fact the lane hands in — not instrumented; live mount not exercised" | `grep -n "actually consulted"` = 0 |
| C7 | A9's scope was not stated (a literal-token scan) | A9 title and §8 now say it is a **literal-token scan**: it catches a call spelled `name(`, not a re-derivation hidden behind a renamed helper; the runtime proofs are A1 + A11 | §8, A9 |
| C8 | `green-tests.log` repeated its header | regenerated from a single run (one header, one transcript) | `green-tests.log` |

Full mutation table (each row: mutation applied to the module, full suite run, file restored,
sha256 re-verified — `mutation-controls.log` holds the same table):

| mutation | what was deleted | RED leg(s) | suite |
|---|---|---|---|
| M01 | provider consult check deleted (lane=allow needs consulted:true) | A4 | exit=1 ℹ pass 11 ℹ fail 1 |
| M02 | policy generation comparison deleted | A3 | exit=1 ℹ pass 11 ℹ fail 1 |
| M03 | effect-not-observed check deleted | A5, A10 | exit=1 ℹ pass 10 ℹ fail 2 |
| M04 | narrowed-allow arm deleted (unnamed durable row) | A6 | exit=1 ℹ pass 11 ℹ fail 1 |
| M05 | named-row-missing arm deleted | A6 | exit=1 ℹ pass 11 ℹ fail 1 |
| M06 | ALLOW_OUTSIDE_COMPILED_CEILING deleted | A7 | exit=1 ℹ pass 11 ℹ fail 1 |
| M07 | APPROVAL_SCOPE_MISMATCH deleted | A2 | exit=1 ℹ pass 11 ℹ fail 1 |
| M08 | ceiling member comparison deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M09 | ceiling policyRevision comparison deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M10 | TOOL_NOT_IN_COMPILED_CEILING deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M11 | provider member comparison deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M12 | provider generation comparison deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M13 | provider policyRevision comparison deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M14 | provider toolBindingIdentity comparison deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M15 | oracle identity check deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M16 | oracle tag check deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M17 | EFFECT_DESPITE_REFUSAL deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M18 | DUPLICATE_CONSUMPTION neutralised (one row may authorize a second allow) | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M19 | recorder INVOCATION_ID_MISMATCH deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M20 | UNKNOWN_ROW_KIND push deleted (unknown kinds silently skipped) | A12 | exit=1 ℹ pass 11 ℹ fail 1 |
| M21 | provider LINK_MISSING check deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M22 | effect LINK_MISSING check deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M23 | AMBIGUOUS_CEILING check deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M24 | CEILING_ROW_MISSING null guard deleted (crash) | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M25 | CEILING_AXIS_MISSING check deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M26 | AMBIGUOUS_APPROVAL_ROW check deleted | A11 | exit=1 ℹ pass 11 ℹ fail 1 |
| M27 | unbindable handling deleted (both the named branch and the catch-all) | A11 | exit=1 ℹ pass 11 ℹ fail 1 |

Honest scope of "no survivors": every mutation listed above is RED, and the sixteen
`alignCall` branches that a recorded file can reach all have a checked verdict. Two defensive
arms are exercised without a mutation of their own — `CALL_ROW_INVALID` (a non-object row)
and the empty-file refusal — because deleting them produces a crash or a `NO_ROWS` refusal
rather than a silent pass. The **one** structural limit from §10 is NOT fixed by this round
and is not a mutation: `consulted`, `disposition` and `lane` are still lane-claimed inputs, so
a lane that lies about what it consulted is caught by diag, not by this chain.
