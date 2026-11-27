# Security review — UTE vNext A1 cut + centre (adversarial, round 113)

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, PR #822 (DRAFT). Reviewer role:
Acceptance-Reviewer for the five areas the review `20261125-0058` Stage C names — **Admission,
Provider/OS boundary, Settlement, Control, Stop**. This is an audit **against the code**, not a
restatement of the design notes; every claim below is either traced to a control at `file:line` and
an arm that attempts to break it, or reported as a finding.

## Disposition (round 114, 2026-11-25) — every finding closed or declared

This review was produced in round 113 as an **audit with no fixes**. Round 114 dispositioned each
finding; the finding sections below keep their original text (so the defect record is not rewritten)
and now carry a disposition marker. Evidence: `round114/README.md`; the acceptance table row is
`D-ACCEPTANCE-REPORT.md` round 114.

| finding | severity | disposition | where it now stands |
| --- | --- | --- | --- |
| **SEC-01** admission fact not `fsync`'d | Low | **FIXED** | `packages/runtime/src/plugin/vnext/fact-ledger.mjs`: `open(O_APPEND) → write → fsync(file) → close`, plus one directory fsync when the append creates the file; the in-memory admission is registered only after the durable append. Policy is **fsync-before-return, not a batched window** (bounded at one fsync/record + one dir fsync for the first record). A refused fsync is named and fail-closed (`LEDGER_NOT_DURABLE` / `LEDGER_DIRECTORY_NOT_DURABLE` / `LEDGER_CLOSE_FAILED` / `LEDGER_UNRECOVERABLE`), the un-acknowledged bytes are rolled back, and settlement is **never opened** for an un-durable fact. Format, ordering, digest and replay rule unchanged. Arms `SEC-01a…d`. **Remaining bound:** real machine power loss is not injectable in-process; the ordering that makes the claim true is pinned, the physical cut is not. |
| **SEC-02** d4 README contradicts `results.json` | Low | **FIXED (history retained)** | `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` corrected 2026-11-25 with a dated banner; round-87/88 text kept as `[HISTORICAL]`. §2 is now the `results.json` transcription at head `41d579119`. Machine check `tests/checks/d4-evidence-consistency.test.mjs` fails on a head/judge/verdict/`overall` mismatch or a current-tense REFUTED about a PROVEN judge outside a historical block; mutation control RED on the pre-correction README. |
| **SEC-03** host-capability tools have no managed lane | Low (declared boundary) | **DECLARED — no behaviour change** | Named on the capability surface: `CAPABILITY-MATRIX-C.md` row **C-host-capability** and the single acceptance table **row 35** (`D-ACCEPTANCE-REPORT.md`). The status vocabulary now contains DECLARED UNCOVERED BOUNDARY; the boundary is discoverable from the table, never counted as confinement. |
| **SEC-04** ungoverned rows outside every invariant | Informational | **DECLARED (unchanged)** | Still a labelled product mode (`{ mode: 'ungoverned', uteProtected: false }`). No fix proposed; no behaviour change. |

No finding remains **open**. SEC-01/SEC-02 were defects and are fixed; SEC-03/SEC-04 are declared
product boundaries and stay declared (changing them is a product-scope decision, not this round).

## 0. Scope, method, and one honesty note

- **Method.** Read the product code first (`admission.ts`, `admission-port.mjs`,
  `approved-ask-receipt.ts`, `provider-capabilities.ts`, `team-services/{fs,web,subprocess}.ts`,
  `settlement/{execution-settlement,dispatch-settlement}.ts`, `control/service.ts`,
  `pre-dispatch-abort.mjs`, `fact-ledger.mjs`, `centre-install.mjs`, `realm-lane.mjs`), then attempt
  each claimed invariant. Where a probe was feasible, a **throwaway** Node script was run against the
  built modules in `/tmp` (not committed; its transcript is quoted). Where a probe was not feasible
  in this round, the existing arm that already attempts the break is cited by id and file.
- **Threat model audited.** A model-driven agent whose tool calls pass through the pinned host's
  `ToolsService`, plus product code in the same process. **Arbitrary in-process hostile code is NOT
  the stated threat model of this generation** — that is treated separately in §6, because no
  in-process design can survive `import('node:fs')`.
- **One honesty note.** The review text `20261125-0058` itself is **not present in this checkout**:
  `docs/reviews/` holds only `20261120-1700.txt`, and the review's Stage A/B demands are recorded
  second-hand in `dev/agent-workflow/SESSION_ROUTER_LOG.md:11280-11400` and the round-110/111
  evidence. The five areas below are the ones this task names, and the invariants are taken from the
  repo's own frozen sources (`docs/plans/memo/ute-p0-20261121/04-SEAMS.md:47-64` P1–P5,
  `08-CENTRE-COMPOSITION.md:22-38`, `06-CAPABILITY-CONTRACT.md:48`), not invented.

## 1. Invariant table (the design's claims, then the break)

Verdict vocabulary: **DEFENDED** — a control exists and an arm attempts the break; **PARTIAL** —
the stated scope survives but a narrower claim does not (see findings); **BROKEN** — no control.

### 1.1 Admission

| id | invariant (source) | control (file:line) | arm that attempts the break | verdict |
| --- | --- | --- | --- | --- |
| A-1 | No binding ⇒ refuse; never fall through to the composition provider (`04-SEAMS.md:34-35`, `08-CENTRE-COMPOSITION.md:33-38`) | `packages/runtime/src/plugin/vnext/admission.ts:381-396` (no binding), `:420-428` (unknown axis) | `ADM-3`, `ADM-4`, `ADM-44`, `ADM-44b`; probe **A1/A2/A14** | **DEFENDED** |
| A-2 | The tool vocabulary and axes are closed; an unlisted name is not admitted by default | `admission.ts:86-153` (`CENTRE_TOOL_NAMES`, `HOST_CAPABILITY_TOOL_NAMES`, `TOOL_AXES`), `:427-428` | `ADM-31` (15 names pinned both ways), `ADM-91`, `ADM-4`; probe **A2** | **DEFENDED** |
| A-3 | Deny wins over allow, ask and any receipt | `member-io-policy/src/path-rules.ts` precedence; `team-services/src/fs.ts:281-285`, `:966-980` | `ADM-7`, `ADM-159`, `ADM-170`, `ADM-157` | **DEFENDED** |
| A-4 | `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction`; a compiled answer that omits an axis does not inherit the ceiling (`04-SEAMS.md:59` P1) | `member-io-policy/src/compile.ts`, `admission.ts:398-424`; per-tool restriction applied before the ceiling (`admission.ts:520-575`) | `ADM-29/30/39`; probe **A11** (partial `perTool` ⇒ `ADMISSION_AXIS_UNSUPPORTED`) | **DEFENDED** |
| A-5 | Every admitted call writes a durable authority fact **before** the body | `centre-install.mjs:216-223` (`recordAdmission` first, then the in-memory map), `fact-ledger.mjs:132-137`, `:126` | `ADM-27`, `ADM-35`, `ADM-41`, `ADM-83`, `SLICE-7/12`; probe **B1/B2** (sink throws ⇒ deny) | **PARTIAL** — see **SEC-01** (no `fsync`; process-crash durable, power-loss not) |
| A-6 | One `callId` ⇒ at most one admission; a replay is refused before the body | `fact-ledger.mjs:120-127` (`LEDGER_REPLAY`), `admission-port.mjs:1012-1024`, `:1055-1063` | `ADM-10/11/13/14/15`, `ADM-20`, `ADM-38`, `ADM-80`; `SLICE-11/13` | **DEFENDED** |
| A-7 | An `ask` is never promoted to `allow` | `admission.ts:545-560` (ask stays ask), `admission-port.mjs:1006-1023` | `ADM-6`, `ADM-19`, `SLICE-16` | **DEFENDED** |

### 1.2 Provider / OS boundary

| id | invariant | control (file:line) | arm | verdict |
| --- | --- | --- | --- | --- |
| P-1 | A governed Member's native body resolves the **Member's own** mounted provider realm, not the inherited base provider (`vnext-fs-slice` leg description) | `packages/runtime/src/plugin/vnext/realm-lane.mjs` (mount by host module identity); `agent-bindings.mjs:1797-1866` | `REALM-1…REALM-12` (esp. `REALM-6` silent half-mount, `REALM-8` no fallback, `REALM-10` uncovered surface refused); `ADM-100/101/102`; `SLICE-1` (different definition object, same `execute` function source) | **DEFENDED** |
| P-2 | The provider re-checks the **live** compiled lane and the resolved (canonical) path, independently of admission | `team-services/src/fs.ts:257-375`, `provider-capabilities.ts:357-446` | `ADM-110` (bounds at centre **and** resolved path), `ADM-157` (revoked after grant), `SLICE-2/3/5/6`; probe **P3–P5** | **DEFENDED** |
| P-3 | Path containment includes symlink/hardlink aliasing; an out-of-lane read is refused **before** the provider is called | `provider-capabilities.ts:294-345` (`PATH_SYMLINK_ESCAPE`), `fs.ts:322-374` | `SLICE-3/6`, `ADM-110`; `OS-2` (kernel denies the out-of-allow read on a capable host) | **DEFENDED** |
| P-4 | Process execution needs the **declared execution authority** + a ready executor; a path lane never grants process authority (`admission.ts:16-34`) | `admission.ts:458-520`; `subprocess.ts:1440-1540` (declared shell class, receipt for ask, `deny` before any receipt) | `ADM-18/24/125/126/127/128/129/130/131/133`; probe **A5–A9** | **DEFENDED** |
| P-5 | OS enforcement is **measured**, not assumed: Landlock ABI + a confined payload failing outside the allow set and succeeding inside it; `network: deny` needs a real netns proof | `tests/world-factory/lib/a5sf-env-capability.mjs`; `vnext-os-probe.test.mjs:66-160`; `web.ts:269-345` | `OS-1/2/3`, `SLICE-28`, `ADM-66/70`; probe-less (kernel) but the required leg runs both controls | **DEFENDED on a capable host; ENV-LIMITED on the hosted runner** (`ENV-LIMITED-CAPABILITY-20261123.md`) |
| P-6 | A tool whose required faces are not all bound is refused **whole**, not partially confined (`04-SEAMS.md:60` P2) | `realm-lane.mjs` (surface coverage), `admission.ts:398-424` | `REALM-10`, `ADM-35`, `ADM-128` | **DEFENDED** |
| P-7 | No second provider execution channel (no family body, wrapper, or legacy fallback) | `ute-cut-closure.mjs`; no `packages/*/src` family bodies | `ute-cut-closure --check` → `deleted=148 prodRefs=0 distResiduals=0 dupNames=0`; `REALM-8` | **DEFENDED for the retired families**; see **SEC-03** for host-capability tools |

### 1.3 Settlement

| id | invariant | control (file:line) | arm | verdict |
| --- | --- | --- | --- | --- |
| S-1 | One physical execution ⇒ one canonical record; the transition graph is enforced by the store | `settlement/execution-settlement.ts:530-539` (`LEGAL_TRANSITIONS`), `:1015-1022` | `ADM-21`, `ADM-27`, probe **S1/S2** | **DEFENDED** |
| S-2 | `REFUSED` is a **pre-body** state: it cannot be back-filled after the body started | `execution-settlement.ts:530-539` (`RUNNING` has no `REFUSED` edge), `:1096-1114` (`dispatch`/`bodyOutcome` must be `not-started`) | `ADM-121`; probe **S1** (`ILLEGAL_TRANSITION`), **S2** (record stays `RUNNING`) | **DEFENDED** |
| S-3 | `REFUSED` cannot contradict a recorded `allow` except through a durable, already-written recheck deny | `execution-settlement.ts:1026-1062` (`recheckDenyOf` must be on disk) | `ADM-119` (positive), `ADM-120` (negative 1), `ADM-123` (crash window), `ADM-124` (deny write fails ⇒ still no run); probe **S3** (`SETTLEMENT_ADMISSION_MISMATCH`) | **DEFENDED** |
| S-4 | A crash between emit and return leaves `UNKNOWN`, never success | `execution-settlement.ts:590-599` (recovery constants), `:1580-1600` (record validation), `dispatch-settlement.ts:713-762` (fallback to `UNKNOWN`) | `ADM-23`, `ADM-84`; probe **S4/S5/S6** (`UNKNOWN`, both missing-evidence and state) | **DEFENDED** |
| S-5 | The terminal write is `fsync`'d before the call returns | `execution-settlement.ts:70-80`, the writer lock + temp/rename path | `ADM-84` (open record after crash), `ADM-123` | **DEFENDED** |
| S-6 | Cross-wiring is refused: a settlement can only carry facts about its own execution id | `execution-settlement.ts:932-940` (`assertSameExecution`), `:887` (root/instance identity) | `ADM-43`, `ADM-119`; the store's own validation | **DEFENDED** |
| S-7 | No terminal-success claim with unproven effects | `execution-settlement.ts:1079-1090` (`COMPLETED` rejects `unknown`/`possible`), `:1096-1114` | `ADM-160` (post-body refusal is `FAILED`, never `REFUSED`), probe **S1–S6** | **DEFENDED** |

### 1.4 Control

| id | invariant | control (file:line) | arm | verdict |
| --- | --- | --- | --- | --- |
| C-1 | One Control service adjudicates every ask; no second approval state machine | `packages/runtime/control/service.ts` (the only writer of `control-decision-recorded`, `:318`), `admission-port.mjs:257` | `ADM-50`, `ADM-112`, `ADM-149` | **DEFENDED** |
| C-2 | The grant is one-shot and bound to member / call / binding / generation; a structural copy is not a grant | `member-io-policy/src/invocation.ts` (branded binder); `admission-port.mjs:791-805` | `ADM-10/11/12/13`, `ADM-20` | **DEFENDED** |
| C-3 | `deny`, `expired`, `fault` are distinct refusals; an unreadable answer is a refusal | `admission-port.mjs:749-772` | `ADM-47/48/49` | **DEFENDED** |
| C-4 | The approval is re-validated at the guard / consumption; revocation kills an outstanding grant | `admission.ts:576-588` (recheck), `member-io-policy` epoch rules | `ADM-19`, `ADM-12`, `ADM-157` | **DEFENDED** |
| C-5 | A Stop/close abandons a pending ask durably; a late allow cannot execute | `control/service.ts:4698-4862` (`inlineAbortCascade`), `admission-port.mjs:773-787` (post-wait stop check) | `ADM-57`, `ADM-61`, `d4:ask-stopped`, `d2:stop`; probes **B3/B4/B5**, **L1/L2** | **DEFENDED** |
| C-6 | Officer routing is a Control **leg**, not a new authority | `alpha6-ask-case.mjs:95-143`, `review-wake-delivery.mjs`, `ADM-149` | `ADM-149/150/151/152/153`; live `d4:routed-wake` + seven sub-judges | **DEFENDED** |

### 1.5 Stop

| id | invariant | control (file:line) | arm | verdict |
| --- | --- | --- | --- | --- |
| T-1 | Stop is the **host's own** signal; there is no second stop mechanism | `admission-port.mjs:405-429` (reads `exec.signal`; one `AbortController` for centre close only), `control/service.ts:4698-4862` | `ADM-56/57/113`; the code has exactly one stop input (`ownSignalOf`) | **DEFENDED** |
| T-2 | Stop before the body ⇒ recorded refusal, `not-started`, never an execution | `admission-port.mjs:435-451`, `:1080-1092`; `dispatch-settlement.ts:713-762` | `ADM-56/58`, `SLICE-21`, `d2:stop` | **DEFENDED** |
| T-3 | Stop is durable and non-replaying across cold start | `execution-settlement.ts` (durable record + recovery), `fact-ledger.mjs` | `ADM-113` (fresh reader), `ADM-84`, `d4:sticky-stop`, `d4:duplicate-route` | **DEFENDED** |
| T-4 | Stop beats a pending approval and a late approval | `admission-port.mjs:721-737` (signal to the ONE wait bridge), `:773-787` (post-wait stop check), `control/service.ts:4721-4735`, `:4755-4795` | `ADM-57/61`, `d4:ask-stopped`; probes **B3–B5** (pre-aborted) and **L1/L2** (abort during wait, approval then resolves `allow`) | **DEFENDED** |
| T-5 | In-flight Stop is recorded at its real phase; an unprovable outcome is `UNKNOWN`, not success | `dispatch-settlement.ts:815-850` (`body-aborted-without-terminal-observation` ⇒ `UNKNOWN`), `execution-settlement.ts:1096-1114` | `ADM-160`, `ADM-23` | **DEFENDED** |

## 2. The seven demanded attacks, attempted

Probes were run against the **built** modules in this worktree (`packages/runtime/dist/...`), which
match `packages/*/src` at this head (the dist is rebuilt by `place-dist-glue` in the gate set). They
are throwaway files under `/tmp` and are **not committed**.

### ATK-1 — an allow without admission

Probe (`probe-admission.mjs`): 15 adversarial calls through `admit()` — no binding, unknown name,
MCP with unset network, `run_code`, five process shapes (no authorization, allow-without-execution,
deny, no ready executor, fs-lanes-only), out-of-lane read, partial `perTool`, missing locator,
unset-network web, host capability unbound and bound.

```
PASS A1 no binding refuses everything: got="ADMISSION_NO_BINDING"
PASS A2 unclassified tool is not admitted by default: got="ADMISSION_TOOL_UNBOUND"
PASS A3 MCP with unset network is not admitted: got="NETWORK_DENY"
PASS A4 PTC is refused by ruling: got="ADMISSION_PTC_UNAVAILABLE"
PASS A5 process with no authorization is refused: got="ADMISSION_EXECUTION_UNAUTHORIZED"
PASS A6 process with allow but no execution block is refused: got="ADMISSION_EXECUTION_UNAUTHORIZED"
PASS A7 process with deny is refused even with a ready executor: got="ADMISSION_EXECUTION_DENIED"
PASS A8 process with no ready executor is refused: got="ADMISSION_EXECUTOR_UNAVAILABLE"
PASS A9 process with a path-only lane does not inherit fs authority: got="ADMISSION_EXECUTION_UNAUTHORIZED"
PASS A10 read outside the lane is refused: got="LANE_DENY"
PASS A11 perTool partial answer does not inherit the ceiling: got="ADMISSION_AXIS_UNSUPPORTED"
PASS A12 missing locator is refused: got="ADMISSION_NO_LOCATOR"
PASS A13 web_fetch with unset network is refused: got="NETWORK_DENY"
PASS A14 host capability still needs a binding: got="ADMISSION_NO_BINDING"
PASS A15 host capability is admitted for a bound agent (stated limit): got="allow"
SUMMARY 15/15 probes behaved as the invariant requires
```

**Verdict: DEFENDED for governed rows.** The only "allow without a lane" is A15, a host capability
with no managed I/O face — the design's declared scope, reported as **SEC-03**. An ungoverned row
(the only true "no centre" path) is a separate, labelled product mode — **SEC-04**.

### ATK-2 — an admission without a durable fact

Probe (`probe-admission-port.mjs`) installs the real admission point with a durable sink that throws
`disk full`, then calls the in-lane read:

```
PASS B1 a failed durable admission write cannot yield an allow: verdict={"kind":"deny","reason":"ADMISSION_LEDGER_UNWRITABLE: record failed for \"adhoc-1\" (disk full); the call is refused rather than run on an unreadable or unwritable record"}
PASS B2 the refusal is the named fault, not a silent pass: reason=ADMISSION_LEDGER_UNWRITABLE...
```

Code order confirms it: `centre-install.mjs:220-225` calls `recordAdmission(fact)` **before**
`admissions.set`, and `admission-port.mjs` `commit()` wraps the record; a throw becomes
`refuseFault`. **Verdict: DEFENDED for process crash;** the `fsync` caveat is **SEC-01**.

### ATK-3 — a settlement that back-fills `REFUSED` after the body started

Probe (`probe-settlement.mjs`) creates a real store, records an `allow`, enters `RUNNING`, then tries
`settle(REFUSED)`:

```
PASS S1 a REFUSED terminal after RUNNING is refused by the store: code=ILLEGAL_TRANSITION
PASS S2 the record is still RUNNING (no back-fill): state=RUNNING
PASS S3 REFUSED cannot cite a recorded allow without a durable deny: code=SETTLEMENT_ADMISSION_MISMATCH
```

The graph has no `RUNNING → REFUSED` edge (`execution-settlement.ts:530-539`) and `REFUSED` requires
`dispatch/bodyOutcome = not-started` (`:1096-1114`). The corresponding required arm is `ADM-121`.
**Verdict: DEFENDED.**

### ATK-4 — a Stop that loses to a pending approval

Two probes. First, the Stop has already landed and the approval port then resolves `allow`:

```
PASS B3 a Stop already landed beats the approval (deny)
PASS B4 the Stop has its own code, not a generic fault: reason=ADMISSION_STOPPED...
PASS B5 no grant is minted for a stopped call: bindCalls=0
```

Second, and harder: the Stop lands **while the approval is pending**, and the reviewer's `allow`
arrives afterwards (`probe-late-approval.mjs`):

```
PASS L1 an approval that resolves after the Stop cannot execute: {"kind":"deny","reason":"ADMISSION_STOPPED: ... nothing that arrives after it may authorize this call"}
PASS L2 no grant is minted: bindCalls=0
```

That exercises `admission-port.mjs:776-787` (the post-wait `closed || stoppedOf(exec)` check) and the
Control wait bridge's durable abandon (`control/service.ts:4755-4795`). Required arms `ADM-57`,
`ADM-61`; live `d4:ask-stopped` and `d2:stop`. **Verdict: DEFENDED.**

### ATK-5 — a provider effect outside the compiled lane

Probe (`probe-receipt.mjs`) mints a real `write` receipt after a consumed grant and attacks it:
outside any execution scope, twice inside one scope, and reopened for a second execution:

```
PASS P2 a receipt used outside ANY execution scope is refused: code=RECEIPT_NOT_IN_SCOPE
PASS P3 the first effect is authorized
PASS P4 the SAME receipt cannot authorize a second effect: code=RECEIPT_REUSED
PASS P5 the receipt cannot be reopened for another execution: error=a closed or unknown receipt cannot open an execution scope
```

Beyond the receipt, the provider re-evaluates the **live** lane and the **resolved** path
(`team-services/src/fs.ts:322-374`, `provider-capabilities.ts:364-446`): `deny` is checked before any
receipt; a live lane that no longer covers the target refuses; the receipt's own `bounds` are a second
ceiling. Arms: `ADM-110`, `ADM-155/156/158/159/161/170`, `SLICE-2/3/5/6`, `REALM-8/10`.
**Verdict: DEFENDED for managed fs/web/process faces.** Host-capability tools are **SEC-03**.

### ATK-6 — a receipt reused across executions

Covered by ATK-5 P4/P5 and `ADM-158` (a completed execution's receipt is closed; the scope is gone)
and `ADM-155` (cross-call reuse refused). The structural reason: pending receipts are keyed by the
**host execution object** (`approved-ask-receipt.ts:800-812`), the scope is an `AsyncLocalStorage`
opened only in `runWithApprovedAskExecutionScope` and closed in `finally` (`:827-846`), and the
receipt is single-use (`state.used`, `:875-878`, `:995`, `:1113`). **Verdict: DEFENDED.**

### ATK-7 — a second authority (a path that reaches a provider without the centre)

Static trace, not a probe:

- The only admission point is installed by `installMemberCentre` (`centre-install.mjs:218`), and
  `installMemberExecution` is the only caller (`member-execution.mjs:26`). There is no product code
  that calls a managed Provider directly: the host's `ToolsService.execute` is the only dispatch
  (`08-CENTRE-COMPOSITION.md:22`, `pre-dispatch-abort.mjs:22-27`), and the member's realm is the
  member's provider (`REALM-8` no fallback).
- The surviving PTC escalation row **does** open its own Control request (`live/ptc-escalation-row.mjs:416`),
  but it is unreachable for a Member because `run_code` is refused before the body
  (`admission.ts:431-457`: "Refusing the TOOL before the body is what makes the escalation path
  unreachable"), measured by `ADM-76/79/87`.
- The retired family bodies are gone: `ute-cut-closure --check` → `prodRefs=0 distResiduals=0
  dupNames=0` (148 sources deleted).
- **Residual, reported not fixed:** host-capability tools (**SEC-03**) and ungoverned rows
  (**SEC-04**). Neither is a second *centre*; both are declared ways to have no centre for that
  effect.

**Verdict: DEFENDED within the governed product surface; two declared boundaries.**

### ATK-8 — an `UNKNOWN` reported as a terminal success

Probe `probe-settlement.mjs` kills an unfinished `RUNNING` record and reopens the store:

```
PASS S4 an unfinished execution recovers as UNKNOWN: after=UNKNOWN
PASS S5 recovery never fabricates COMPLETED: state=UNKNOWN
PASS S6 recovery names the missing evidence: missing=["terminal-observation","host-result","backend-receipt","effect-evidence"]
```

`ADM-23`/`ADM-84` are the required arms. The dispatch wrapper's fallback writes `UNKNOWN` when even
the truthful terminal write is refused (`dispatch-settlement.ts:733-762`). One nuance, stated rather
than hidden: when a body **returns** but its effects are unobservable, the store refuses `COMPLETED`
and settles `UNKNOWN` while the model-facing value is still the body's own value
(`dispatch-settlement.ts:884-905`). That is the host's result, not a centre "success" claim — the
durable record remains `UNKNOWN`. **Verdict: DEFENDED.**

## 3. Findings (severity + `file:line`; **dispositions added in round 114 — see the table above**)

### SEC-01 — the admission fact is not `fsync`'d (Low, durability) — **FIXED (round 114)**

`packages/runtime/src/plugin/vnext/fact-ledger.mjs:126` appends with `appendFileSync(...)` and never
fsyncs the file or its directory. The settlement store, by contrast, documents and performs an fsync
before returning (`packages/runtime/settlement/execution-settlement.ts:70-80`). Consequences:

- **Process crash / SIGKILL:** safe. The data is in the kernel page cache; `SLICE-12/13` and
  `ADM-80` prove the second reader sees it. This is the documented threat model.
- **Machine crash / power loss:** not safe. A provider effect can be made stable (the fs provider
  fsyncs its own write) while the admission line is still in page cache. After reboot the ledger has
  no record for that `callId`, so a host retry with the same id would be admitted again — one
  physical effect, two admissions, no replay refusal. The window is narrow and requires a machine
  crash, but the claim in `08-CENTRE-COMPOSITION.md:36` ("durable") is stronger than the control.

Severity **Low** (machine-crash only; the process-crash model is proven). Suggested fix (separate
round, with its own arm): fsync the ledger file (and directory on create) before `record()` returns,
and add a crash-injection arm that fails the fsync and asserts the call is refused.

> **Disposition (round 114, 2026-11-25) — FIXED.** The suggested fix was implemented exactly, with the
> policy made explicit: **fsync-before-return** (one file fsync per record, one directory fsync when the
> append creates the file — no batching window). Security is fail-closed: a refused file fsync rolls the
> bytes back and throws `LEDGER_NOT_DURABLE`; a refused directory fsync throws
> `LEDGER_DIRECTORY_NOT_DURABLE` and unlinks the un-durable name; a refused close throws
> `LEDGER_CLOSE_FAILED`; a failed rollback throws `LEDGER_UNRECOVERABLE`. The in-memory admission is
> registered AFTER the durable append, so `has()`/`observe()` never answer KNOWN for an un-fsynced
> fact, and settlement (which opens only after `record()` returns) is never opened for one. Arms
> `SEC-01a` (SIGKILLed writer), `SEC-01b` (authority boundary, including the real centre + store),
> `SEC-01c` (byte-identical JSONL, replay rule unchanged), `SEC-01d` (file/dir/close/io refusals) in
> `packages/runtime/test/vnext-admission.test.mjs`. Remaining bound: a physical power cut is not
> injectable in-process (see §4).

### SEC-02 — the d4 evidence README contradicts the machine verdict (Low, evidence integrity) — **FIXED, history retained (round 114)**

`dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md:104-133` states `d4:routed-wake` is
**REFUTED**, with `case-created` / `wake-delivered` marked ❌ and "0 facts". The machine artifacts in
the same tree (`d4/results.json`, and the candidate gate's
`.../2026-11-24T17-17-46-158Z/verdict.json`) record all seven routed sub-judges **PROVEN** on both
hosts. A reviewer who reads the area's own README instead of the `results.json` would sign C6 off as
unproven — the opposite of the measurement. This is an evidence-integrity defect, not a runtime one.
Severity **Low** (it can mislead a merge/sign-off decision; it cannot change runtime behaviour).
Not fixed here (evidence-only round); recorded so the C6 sign-off in `C1-C18-SIGNOFF.md` §6 is
explicitly using the machine artifacts.

> **Disposition (round 114, 2026-11-25) — FIXED, history retained.** The README was corrected to the
> `results.json` truth (`d4:routed-wake` PROVEN, all seven sub-judges PROVEN; `overall` stays BLOCKED
> only for the separately-declared `d4:ask-execute-process`) with a dated correction banner and the
> round-87/88 text explicitly marked `[HISTORICAL]` — nothing was deleted. The machine check is
> `tests/checks/d4-evidence-consistency.test.mjs` (head equality with `probe-digest.json`, judge-set
> equality, verdict equality, `overall` equality, and no current-tense REFUTED about a PROVEN judge
> outside a historical block). Mutation control: the arm is RED on the pre-correction README and GREEN
> after. This makes the same drift a gate failure next time instead of a silent inversion.

### SEC-03 — host-capability tools have no managed I/O lane (Low, scope boundary) — **DECLARED (round 114, no behaviour change)**

`packages/runtime/src/plugin/vnext/admission.ts:143-153` admits `subagent`, `send_message`,
`interrupt_agent`, `skill` and the 15 `team_*` names on `team.control`/host authority with **no fs
or net lane** (probe A15). Their effects are performed by host services, so the centre's lane
algebra does not bound them. This is by design for C15/C16 (`06-CAPABILITY-CONTRACT.md:49-50`) and
the tool names are closed (A-2), but the broad statement "every provider effect is inside the
compiled lane" is **not** true of this surface. Severity **Low** (declared product boundary, not a
bypass of the managed faces); a hostile-code model must treat these as capabilities outside the
sandbox.

> **Disposition (round 114, 2026-11-25) — DECLARED, no behaviour change.** The boundary is now
> discoverable from the status surfaces: `CAPABILITY-MATRIX-C.md` row **C-host-capability** (and the
> DECLARED UNCOVERED BOUNDARY status in its vocabulary) and the single acceptance table's
> **row 35** in `D-ACCEPTANCE-REPORT.md`. Both state plainly that these tools are admitted on
> `team.control`/host authority with **no managed fs/net lane**, that their effects are host services,
> and that they are **never** counted as PROVEN for confinement. No admit/deny behaviour changed; this
> is the wording-and-discoverability half of SEC-03 only.

### SEC-04 — ungoverned rows are outside every invariant (Informational, declared boundary) — **DECLARED (unchanged)**

`packages/runtime/src/plugin/vnext/agent-bindings.mjs:1880-1891`: a row that sets no
`centreStatePath` is allowed to run under DSH's own permission model and is labelled
`{ mode: 'ungoverned', uteProtected: false }` with an observation. A **governed** row without a
confined provider is refused whole (`memberAdmissionGate`, `ADM-44b`). This is a correct,
fail-closed split — but a reader who treats "the product" as "everything the binary can run" would
be wrong. Severity **Informational**; no fix proposed (changing it is a product-scope decision).

**No finding was found in the managed Admission / Provider-OS / Settlement / Control / Stop paths
that is BROKEN at this head.** The two real defects (SEC-01, SEC-02) are a durability gap outside the
proven crash model and an evidence-integrity defect; both are fixes for a separate round with their
own arms, and neither was patched here.

## 4. What was NOT attempted (and why)

- **A real hostile plugin** that imports `node:fs` directly: out of the stated threat model; see §6.
- **A real-machine power-loss test**: would need a hypervisor-level cut; the `fsync` gap is read from
  the code instead, and named as SEC-01.
- **A second `ToolsService`/executor registration**: the realm lane refuses a duplicate claim
  (`REALM-3`) and rc.5 allows one executor per scope (round-112 evidence), so there is no second
  dispatch to attack without patching the host — forbidden by CORE PATCH BUDGET = 0.
- **The candidate gate itself**: re-running it is ~84 min and is not one of this round's gates; its
  last verdict is bound to `41d579119` and the product diff since then is empty (see the sign-off
  §3).

## 5. Gate relationship (so a green gate is not misread)

| evidence layer | required? | what a green means here |
| --- | --- | --- |
| `ute-vnext-a1` node:test leg + migrated vitest | **yes** | the MECHANISM arms above ran at the merge gate |
| `candidate-acceptance` (d/d2/d3/d4) | **no** (owner ruling; `knownNonRequired`) | DEV-LIVE only; never upgrades a row |
| `ci-pr-gate --full` | yes | the whole required layer set is green at this head |

A pass of the candidate gate is not a security proof: it is a live observation layer, and its single
`KNOWN_REFUTED` (`d4:ask-execute-process`) is an **approved** product-scope decision, not a red that
was converted.

## 6. What would still be needed for a hostile-code threat model

This generation's controls assume the *model* is adversarial and the *process* is trusted product
code. For hostile code in the same process (a malicious plugin, a compromised dependency, or a
Team-authored tool body — the last is already refused by `REALM-1`, `MODULE_NOT_HOST`), the
following are **not** provided and would each need its own design + arms:

1. **A process boundary for the member's tool bodies.** In-process code can `import('node:fs')` and
   ignore every guard, receipt and lane. The only real boundary today is the OS sandbox for
   *spawned processes* (Landlock / netns), and it is not applied to the Member's own Node execution.
   A worker process with the compiled policy, and IPC instead of in-process calls, is the minimum.
2. **A trusted computing base smaller than the whole product.** The centre, the ledger and the
   settlement store run in the same address space as the code they govern; a hostile module can
   rewrite the store or the receipt's `WeakMap` state. Signing the journal, or moving it to a
   separate privileged service, would be required.
3. **`fsync`-before-effect ordering for the admission fact** (SEC-01), plus a crash-injection arm. — **CLOSED round 114** (fsync-before-return; arms `SEC-01a…d`).
4. **A managed lane (or an explicit "no lane" capability type) for host-capability tools** (SEC-03) —
   **still declared**: the boundary is named in the matrix/status table, but no lane exists or is
   claimed, so `skill`/`subagent` effects remain outside the ceiling.
5. **Coverage of the host agent loop's `tools.execute` caller on rc.5.** `pre-dispatch-abort.mjs:22-27`
   states the product does not own that call site; a pre-dispatch cancellation in a real rc.5 turn
   is therefore unobserved by the centre (the A1 slice hands the batch to the observer, the real
   agent loop does not). That is a `CORE_SEAM_BLOCKER`-class gap for full pre-dispatch settlement,
   not a fix this round.
6. **An independent oracle for OS effects.** `OS-2/3` are good kernel controls, but they are the
   product's own probe; a hostile-code model wants an external verifier that the sandbox was
   actually applied to the process that made the effect.

## 7. Verdict

For the product surface this generation claims to govern — a bound Member's managed tool calls
through the one admission point, the member realm's providers, the settlement store and the one
Control service — **no invariant in the five areas is BROKEN at this head**. Eight adversarial
attacks were attempted; seven are defended in code and by an existing arm, the eighth
(UNKNOWN-as-success) is defended with the nuance recorded.

**As of round 114 (2026-11-25) the two defects are FIXED and the two boundaries stay DECLARED:**
**SEC-01** (admission fact not fsync'd) is fixed by the fsync-before-return policy and its four arms;
**SEC-02** (stale d4 README inverting the routed-wake verdict) is fixed with history retained and a
new machine consistency check. **SEC-03** (host-capability tools have no managed lane) and **SEC-04**
(ungoverned rows) are named so they cannot be mistaken for controls, now including the matrix row and
the single acceptance table row for SEC-03. **No finding remains open.** A hostile-code threat model is
**not** met by this generation; §6 lists what it would take (and §6 item 3, the fsync ordering, is now
closed).
