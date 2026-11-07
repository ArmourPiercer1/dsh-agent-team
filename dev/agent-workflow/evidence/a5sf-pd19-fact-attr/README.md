# PD-19 — a guard fact names the TOOL CALL it was decided for

**Task** `task/pd19-fact-attr-20261113` · base `origin/master` @ `d590d58a0` (#666)
· draft PR first line `PD19-FACT-ATTR` · **not merged**, no settle.
**CORE PATCH BUDGET = 0**: `packages/**` (our packages only) + our tests + this evidence.
Upstream, the pinned host checkout and every `docs/plans/finished/` contract are untouched.
**Boots: 0** (`DEV-LIVE` count = 0). No listener, no socket, no port in the 3180 family, no
`tests/homes/**`, no `DSH_HOME`; the pinned host tree was read only through `import` (the REAL
`@deepseek-ai/dsh-tools` / `@deepseek-ai/dsh-tool-fs` 0.2.0-rc.2 @ `639ed01539`).

---

## 1. 真伪判定 — "never designed in", not "field exists but left null"

The starting claim was that `tool` / `toolName` / `callId` are `null` on every fact. The measured
tree says something slightly different, and the difference matters:

1. **The schema has no `tool`, no `toolName`, and no `callId` field at all.**
   `GuardConsultFact` (`packages/runtime/team-services/src/guard-observability.ts:78`) declares
   exactly `schema / realm / memberIdentity / toolBindingIdentity / policyRevision / method /
   locator / decision / decidedBy / sequence / observedAt` (+ optional `annotations`). A projection
   that reads `fact.tool`, `fact.toolName` or `fact.callId` from a pre-PD-19 fact gets `undefined`
   (or `null` after `?? null`); those keys do not exist in the file. So this was **not** a field
   that was designed and then forgotten — the JOIN KEY was never designed into the record.
2. **The one tool-shaped field that DOES exist is deliberately `null` on the Member ceiling realm.**
   `GuardConsultContext.toolBindingIdentity` is `string | null`; the Member realm constructs it
   `null` on purpose (`packages/runtime/team-services/src/install.ts:431` and `:509`) because the
   ceiling is not a tool binding. The binding realm fills it
   (`packages/runtime/team-services/src/install.ts:743`, `:766`). So `toolBindingIdentity: null` on
   a `realm: "member"` fact is correct, not a hole.
3. **The guards never receive a call identity.** `createMemberFsGuard` (`fs.ts:106`),
   `createMemberSubprocessGuard` (`subprocess.ts:945`) and `evaluateLocatorAccess`
   (`member-io-policy/src/provider-capabilities.ts:299`) decide on `(method, locator, lane)` only.
   There is no parameter to pass a call id through, and adding one would have changed the guard
   signature used by every face.
4. **The tool plane DOES have the identity.** The pinned `@deepseek-ai/dsh-tools` carries
   `ToolExecutionInput.callId` / `.name` (`tests/deepseek-harness-test-use/packages/core/tools/src/index.ts:327`)
   and exposes the `tools/execute` waterfall with the full `ToolExecution`
   (`…/index.ts:164`, `ToolExecution extends ToolExecutionInput` at `:393`). Our own U6 shadow row
   already reads `exec?.callId` through that same seam
   (`packages/runtime/src/plugin/live/center-shadow-row.mjs:206`). The missing layer was therefore
   **the carrier between the tool dispatch and the guard consultation**, not the tool plane.

**Verdict**: the gap is real and it is a **missing design element** ("never designed in"), not a
dropped value. One spelling note: the brief also names `toolName`. That is the **Control/approval scope** spelling
(`dev/agent-workflow/evidence/a5sf-r3/aligned-chain.jsonl` uses `scope.toolName`), while the R3
`call` row and the guard fact use `tool`. PD-19 writes `tool` so the fact joins the existing R3 call
row directly; it does not add a second alias for the same string.

The named evidence file in the task brief
(`dev/agent-workflow/evidence/a5sf-pd16-search/runs/boot01/guard-facts.json`) does **not** exist on
this base; the merged live records with the same shape are
`dev/agent-workflow/evidence/a5sf-search-live/runs/2026-11-04T23-18-01-066Z/guard-facts.json`
(7 facts, `method/spawn`, `toolBindingIdentity:null`) and
`dev/agent-workflow/evidence/a5sf-live-member/runs/boot01/guard-facts.json` (4 facts). Both show the
same absent join key. The exact path cited by the brief is recorded as an evidence-path discrepancy,
not silently renamed.

---

## 2. What changed, and why it is not a second policy source

Two product files (plus the generated dist mirror) and one host-free test:

| file | change |
| --- | --- |
| `packages/runtime/team-services/src/guard-observability.ts` | adds the optional `tool` / `callId` fact fields, an **attribution-only** `AsyncLocalStorage` carrier, and `attachGuardToolCallAttribution(ctx)` (the `tools/execute` wrapper) |
| `packages/runtime/team-services/src/install.ts` | attaches that wrapper **only when `onGuardConsult` is supplied**, after every realm mounted; detaches in `dispose()` |
| `tests/world-factory/a5sf-pd19-fact-attribution.test.mjs` | the 7 host-free arms FA1–FA7 |

The carrier is populated from the registry's own dispatch:

```
tools/execute (exec: ToolExecution, next)  ──►  ALS.run({tool: exec.name, callId: exec.callId}, next)
                                                        │
confined Provider method → guard(method, locator) ──────┤ (async context preserved)
                                                        ▼
                                   observeGuard copies the store into the fact
```

Why this cannot be a second policy source:

- **No decision path reads it.** `observeGuard` is the ONLY reader
  (`guard-observability.ts:285`); it reads the store after the SAME
  `guard(method, hostPath, annotations)` call and copies it into the fact it was already writing.
  `fs.ts`, `subprocess.ts`, `web.ts` and `terminal.ts` never mention the carrier (pinned by FA7).
- **No new authority, compiler, lane or code.** There is no second `compileEffectiveIo`, no second
  guard, no new `TeamIoDenial` code, no approval path. The two fields are strings/null.
- **The default path is untouched.** The wrapper is attached only when a fact observer is installed;
  with no observer there is no listener at all, so the legacy row stays byte-identical (the same
  default-preserving law the existing P2 seam documents).
- **Fail-closed transport is unchanged.** An unwritable sink still refuses the call with
  `GUARD_OBSERVATION_FAILED`; attribution is recorded before that refusal like every other field.
- **The listener is inert by construction.** It calls `next()` exactly once, returns its value
  untouched, never mutates `exec` (not even `exec.signal`), and never throws on its own. A dispatch
  without a usable `name`/`callId` runs **unattributed** (`null`), never with a synthetic id.

Note on the existing TA5 sentence in `a5sf-tool-axis.test.mjs` ("no per-call multiplexer, no
`AsyncLocalStorage`"): that sentence forbids an ALS **used to route a call to a realm**. PD-19 uses
an ALS only to LABEL an already-decided consultation. The provider/realm selection is still the
compiled closure; FA7 pins that no guard module reads the carrier.

## 3. Backward compatibility

- Old facts simply do not have the keys. `assertFact` accepts **absence** and **`null`**, and only
  rejects a present non-string / blank value (`guard-observability.ts:431-439`). FA5 writes an
  old-format record, a new record with values, and a new record with `null`, then reads all three
  through `readGuardConsultFile`.
- New facts add two keys; the strict reader tolerates them (it is a validator, not a closed-set
  matcher). Existing consumers project the fields they need (`fact.method`, `fact.decision`, …) and
  are unaffected. `a5sf-p2-seam`'s "reader returns transported facts unchanged" arm still passes.
- The emitter writes `tool: null, callId: null` when there is no dispatch in scope, rather than
  omitting the keys. That is deliberate: the honest absence is part of the record and the
  conformance criteria can tell "old file" (absent) from "new fact, no tool call" (`null`).

## 4. Host-free evidence (C1)

`node --test tests/world-factory/a5sf-pd19-fact-attribution.test.mjs` — **7/7 pass, 0 boots**.
The tool calls are dispatched through the REAL `@deepseek-ai/dsh-tools` registry over the REAL
`mountMemberA5sfRealm` + `attachA5sfNativeToolModules` product path and the REAL pinned
`@deepseek-ai/dsh-tool-fs`.

| arm | measured |
| --- | --- |
| FA1 | an allowed native `read` produces facts with `tool:"read"`, `callId:"pd19-call-allow-1"`, plus `realm:"member"`, the Member identity and `policyRevision`; `decision:"allow"` / `decidedBy:"ALLOW"` |
| FA2 | an out-of-lane `read` is refused; its one deny fact carries the same `tool` + `callId`, `decidedBy:"IO_READ_DENIED"`, and the bytes never appear |
| FA3 | two overlapping dispatches keep their own ids; no fact carries the other call's id (concurrency-safe carrier, not a "last call" global) |
| FA4 | a direct confined-Provider read (no tool dispatch) records `tool:null`, `callId:null` — no fabricated identity, decision unchanged |
| FA5 | old-format fact (no keys) parses; `null` parses; `tool: 7` is refused `CONSULT_FILE_INVALID` |
| FA6 | the narrower binding realm's fact also carries `tool:"read"` + the same `callId`, alongside `toolBindingIdentity:"dsh.fs/read"` |
| FA7 | structural: no guard module reads the carrier; exactly the accessor + one fact read site exist |

**What this does NOT prove**: no live Host boot was spent, so it does not prove the live Member
preset's `grep`/`read` dispatch reaches this listener in the real Host process; that is a `DEV-LIVE`
question and is stated as such below.

## 5. Gates (this tree)

| gate | result | log |
| --- | --- | --- |
| a5sf family (`node --test tests/world-factory/a5sf-*.test.mjs`) | **PASS** 579 tests, 573 pass, 0 fail, 6 skipped | `a5sf-family.log` |
| runtime package tests (`pnpm --filter @dsh-agent-team/runtime test`) | 5993 pass / 3 fail; the same 5 files / 3 tests fail on a clean `origin/master` checkout (pre-existing environment/latency failures: `a4pr0a` source-scan, `u7-f-native-output-schema` pristine-path, `a5-globoff` K7 timeout, `a5rbn` N3 timeout, `a5sf-os-runner` network-deny backend) | `runtime-tests.log`, `baseline-5files.log` |
| `pnpm -r typecheck` | **PASS** | `typecheck.log` |
| eslint (changed TS) | **PASS** (0 errors; the `.mjs` test is in the repo's eslint-ignore surface) | `eslint.log` |
| `check-artifacts-committed` | **PASS** (1973 compared, 106 glue; staged tree matches) | `artifacts.log` |
| `doc-checks` | **PASS** | `doc-checks.log` |
| register tests | **PASS** (part of the a5sf family; register untouched) | `a5sf-family.log` |
| `ci-pr-gate --only state-freshness` | **PASS** | `state-freshness.log` |

The runtime-suite baseline comparison is the honest part: those 3 failures are **not** introduced by
this change. They reproduce with `origin/master` product sources in the main checkout and are
environment/latency-shaped (two 5 s timeouts, a pinned-path check that expects the checkout at
`packages/runtime/…/tests/…`, and a Landlock network-deny probe that this kernel answers differently).

## 6. The gap that remains, and what a grader may say

PD-19 removes the structural reason the join was impossible, but it does not make every fact
attributable:

1. **Pre-PD-19 evidence is unchanged and still unattributable.** Facts in
   `a5sf-search-live/`, `a5sf-live-member/`, `a5sf-fs-devlive/`, etc. have no `tool`/`callId`;
   a grader MUST NOT claim those facts correspond to a specific tool call. They can only be joined
   by timestamp/locator inference, which is what PD-19 exists to stop.
2. **A new fact with `tool:null` / `callId:null` is explicitly unattributed.** It was emitted
   outside any `tools/execute` context (a host-side service read, a direct Provider call, a
   post-teardown call). A grader MUST NOT name a call for it.
3. **One call can produce several facts.** `read` consults `stat` and `readText`; `bash` consults
   `spawn` and `spawn:write`. `callId` names the CALL, not a 1:1 fact; several facts sharing one
   `callId` are the expected shape, and a denial is attributed to the same id.
4. **The live half is not measured here.** The listener is attached by the same product install path
   the live row uses, and it is scope-filtered to the Member's agent context, but the real Host's
   preset/glue dispatch is a `DEV-LIVE` question. This lane spent **0 boots** and does not claim the
   live half.

## 7. The one sentence

**Today, for a PD-19-shaped fact (`tool` and `callId` non-null), YES — you can go from one fact to
"which tool call was refused"; for every pre-PD-19 fact, and for any new fact whose attribution is
`null`, NO — the missing layer was the tool-dispatch→guard carrier, and PD-19 adds it without
touching the decision.**
